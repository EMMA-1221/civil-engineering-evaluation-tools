'use strict';

const crypto = require('node:crypto');
const {
  PRODUCTIVITY_FACTOR_IDS, validateProductivityDocument, legacyToDocument,
} = require('./productivity-v2-model.cjs');

const V2_TABLE = 'productivity_loss_v2';
const DEFAULT_FACTOR_IDS = ['overmanning', 'stacking_of_trades', 'overtime_5_10'];
const LEGACY_INPUT_SQL = `SELECT week_number, planned_work_hours, change_order_hours,
  overmanning, stacking_of_trades, overtime_5_10
  FROM productivity_loss_weeks WHERE project_id = ? ORDER BY week_number`;

class ProductivityHttpError extends Error {
  constructor(status, code, msg) { super(msg); this.status = status; this.code = code; }
}
const conflict = (code, msg) => new ProductivityHttpError(409, code, msg);
const invalid = msg => new ProductivityHttpError(400, 'INVALID_PRODUCTIVITY_REQUEST', msg);

function sendFailure(res, error) {
  return res.status(error.status || 500).json({
    msg: error.status ? error.message : 'The productivity request could not be completed.',
    code: error.code && error.status ? error.code : 'PRODUCTIVITY_SERVER_ERROR',
  });
}

function projectId(raw) {
  const value = typeof raw === 'string' && /^\d+$/.test(raw) ? Number(raw) : raw;
  if (!Number.isSafeInteger(value) || value < 1) throw invalid('Project ID is invalid.');
  return value;
}

function expectedRevision(raw) {
  if (!Number.isInteger(raw) || raw < 0 || raw > 4294967295) {
    throw invalid('expectedRevision must be a nonnegative supported integer.');
  }
  return raw;
}

async function ownedProject(connection, id, user, lock = false) {
  const [projects] = await connection.query(
    `SELECT * FROM productivity_loss_projects WHERE id = ?${lock ? ' FOR UPDATE' : ''}`, [id],
  );
  if (!projects.length) throw new ProductivityHttpError(404, 'PRODUCTIVITY_NOT_FOUND', 'Project not found.');
  const project = projects[0];
  if (user.role !== 'admin' && project.user_id !== user.id) {
    throw new ProductivityHttpError(403, 'PRODUCTIVITY_ACCESS_DENIED', 'Access denied.');
  }
  return project;
}

async function transaction(pool, operation, readOnly = false) {
  const connection = await pool.getConnection();
  try {
    if (readOnly) await connection.query('START TRANSACTION READ ONLY');
    else await connection.beginTransaction();
    const result = await operation(connection);
    if (readOnly) await connection.rollback();
    else await connection.commit();
    return result;
  } catch (error) {
    try { await connection.rollback(); } catch { /* Preserve the original safe error. */ }
    throw error;
  } finally { connection.release(); }
}

async function storedVersion(connection, id) {
  const [rows] = await connection.query(
    `SELECT project_id, revision, document, updated_at FROM ${V2_TABLE} WHERE project_id = ?`, [id],
  );
  return rows[0] || null;
}

function decodeStored(row) {
  try {
    if (!Number.isInteger(row.revision) || row.revision < 1 || row.revision > 4294967295) throw new Error('revision');
    const raw = typeof row.document === 'string' ? JSON.parse(row.document) : row.document;
    return validateProductivityDocument(raw);
  } catch {
    throw conflict('PRODUCTIVITY_STORED_DOCUMENT_INVALID', 'The saved productivity version or inputs cannot be verified.');
  }
}

async function legacyImport(connection, project) {
  const [weeks] = await connection.query(LEGACY_INPUT_SQL, [project.id]);
  let document;
  try { document = legacyToDocument(project, weeks); }
  catch { throw conflict('PRODUCTIVITY_LEGACY_INPUTS_INVALID', 'The legacy weekly inputs are incomplete or invalid and cannot be imported.'); }
  const fingerprint = crypto.createHash('sha256').update(JSON.stringify(document)).digest('hex');
  return { document, fingerprint };
}

function v2Project(project, validated, revision, updatedAt) {
  return { ...project, total_weeks: validated.document.totalWeeks,
    total_proactive_loss: validated.summaries.proactive.totalLoss,
    total_retroactive_loss: validated.summaries.retroactive.totalLoss,
    model_version: 2, revision, ...(updatedAt ? { updated_at: updatedAt } : {}) };
}

function emptyDocument(totalWeeks) {
  if (!Number.isInteger(totalWeeks) || totalWeeks < 1 || totalWeeks > 52) throw invalid('Total weeks must be between 1 and 52.');
  const mode = () => ({ version: 2, totalWeeks, selectedFactorIds: [...DEFAULT_FACTOR_IDS],
    planned: Array(totalWeeks).fill(0), change: Array(totalWeeks).fill(0),
    factors: Object.fromEntries(PRODUCTIVITY_FACTOR_IDS.map(id => [id, Array(totalWeeks).fill(0)])) });
  return { version: 2, inputMode: 'separate', totalWeeks,
    modes: { proactive: mode(), retroactive: mode() } };
}

function registerProductivityV2Routes(app, { db, authenticateToken }) {
  app.get('/productivity-losses/:id/v2', authenticateToken, async (req, res) => {
    try {
      const result = await transaction(db, async connection => {
        const project = await ownedProject(connection, projectId(req.params.id), req.user);
        const stored = await storedVersion(connection, project.id);
        if (stored) {
          const validated = decodeStored(stored);
          return { project: v2Project(project, validated, stored.revision, stored.updated_at),
            document: validated.document, revision: stored.revision, isLegacy: false };
        }
        const imported = await legacyImport(connection, project);
        return { project, document: imported.document, revision: 0, isLegacy: true,
          legacyFingerprint: imported.fingerprint };
      }, true);
      res.json(result);
    } catch (error) { sendFailure(res, error); }
  });

  app.post('/productivity-losses-v2', authenticateToken, async (req, res) => {
    try {
      const { project_name, description, total_weeks, document } = req.body || {};
      if (typeof project_name !== 'string' || !project_name.trim() || project_name.trim().length > 255) {
        throw invalid('Project name is required and must not exceed 255 characters.');
      }
      if (description !== undefined && description !== null && (typeof description !== 'string' || description.length > 10000)) {
        throw invalid('Project description is invalid.');
      }
      const validated = validateProductivityDocument(document === undefined ? emptyDocument(total_weeks === undefined ? 14 : total_weeks) : document);
      if (total_weeks !== undefined && total_weeks !== validated.document.totalWeeks) throw invalid('Total weeks must match the document.');
      const result = await transaction(db, async connection => {
        const [created] = await connection.query(
          'INSERT INTO productivity_loss_projects (user_id, project_name, description, total_weeks) VALUES (?, ?, ?, ?)',
          [req.user.id, project_name.trim(), description || null, validated.document.totalWeeks],
        );
        await connection.query(`INSERT INTO ${V2_TABLE} (project_id, revision, document) VALUES (?, 1, ?)`,
          [created.insertId, JSON.stringify(validated.document)]);
        return { project_id: created.insertId, revision: 1, document: validated.document };
      });
      res.json(result);
    } catch (error) { sendFailure(res, error); }
  });

  app.put('/productivity-losses/:id/v2', authenticateToken, async (req, res) => {
    try {
      const result = await transaction(db, async connection => {
        // Parent row lock serializes old-client writes, first imports and v2 saves.
        const project = await ownedProject(connection, projectId(req.params.id), req.user, true);
        const requested = expectedRevision(req.body?.expectedRevision);
        const stored = await storedVersion(connection, project.id);
        if (stored) {
          decodeStored(stored);
          if (requested !== stored.revision) throw conflict('PRODUCTIVITY_REVISION_CONFLICT', 'This project changed. Reload it before saving.');
        } else {
          if (requested !== 0) throw conflict('PRODUCTIVITY_REVISION_CONFLICT', 'Reload the legacy project before importing it.');
          const imported = await legacyImport(connection, project);
          if (typeof req.body?.expectedLegacyFingerprint !== 'string'
            || req.body.expectedLegacyFingerprint !== imported.fingerprint) {
            throw conflict('PRODUCTIVITY_IMPORT_CONFLICT', 'The legacy inputs changed or were not loaded. Reload them before saving.');
          }
        }
        const validated = validateProductivityDocument(req.body?.document);
        if (requested === 4294967295) throw conflict('PRODUCTIVITY_REVISION_EXHAUSTED', 'This project cannot accept another revision. Contact the administrator.');
        const next = requested + 1;
        if (stored) {
          const [updated] = await connection.query(
            `UPDATE ${V2_TABLE} SET revision = ?, document = ? WHERE project_id = ? AND revision = ?`,
            [next, JSON.stringify(validated.document), project.id, requested],
          );
          if (updated.affectedRows !== 1) throw conflict('PRODUCTIVITY_REVISION_CONFLICT', 'This project changed. Reload it before saving.');
        } else {
          await connection.query(`INSERT INTO ${V2_TABLE} (project_id, revision, document) VALUES (?, 1, ?)`,
            [project.id, JSON.stringify(validated.document)]);
        }
        // Preserve original parent/week data as the rollback/import snapshot.
        return { revision: next, document: validated.document,
          project: v2Project(project, validated, next) };
      });
      res.json(result);
    } catch (error) { sendFailure(res, error); }
  });

  app.delete('/productivity-losses/:id/v2', authenticateToken, async (req, res) => {
    try {
      const result = await transaction(db, async connection => {
        const project = await ownedProject(connection, projectId(req.params.id), req.user, true);
        const requested = expectedRevision(req.body?.expectedRevision);
        const stored = await storedVersion(connection, project.id);
        if (!stored) throw conflict('PRODUCTIVITY_LEGACY_PROJECT', 'Use the legacy project delete action for an unconverted project.');
        decodeStored(stored);
        if (requested !== stored.revision) throw conflict('PRODUCTIVITY_REVISION_CONFLICT', 'This project changed. Reload it before deleting.');
        await connection.query('DELETE FROM productivity_loss_projects WHERE id = ?', [project.id]);
        return { success: true, project_id: project.id };
      });
      res.json(result);
    } catch (error) { sendFailure(res, error); }
  });
}

function withLegacyProductivityWrite(pool, handler) {
  return async (req, res) => {
    try {
      const captured = await transaction(pool, async connection => {
        const project = await ownedProject(connection, projectId(req.params.id), req.user, true);
        if (await storedVersion(connection, project.id)) {
          throw conflict('PRODUCTIVITY_V2_RELOAD_REQUIRED', 'This project uses the new productivity model. Reload it before editing.');
        }
        // Defer the old handler's JSON until the same-connection transaction commits.
        const capture = { status: 200, body: undefined, sent: false };
        const deferred = { status(code) { capture.status = code; return deferred; },
          json(body) { capture.body = body; capture.sent = true; return deferred; } };
        await handler(req, deferred, connection);
        if (!capture.sent) throw new Error('Legacy route did not return a response.');
        if (capture.status >= 400) {
          const error = new ProductivityHttpError(capture.status, 'PRODUCTIVITY_LEGACY_WRITE_FAILED', 'The legacy productivity update failed.');
          error.legacyResponse = capture;
          throw error;
        }
        return capture;
      });
      res.status(captured.status).json(captured.body);
    } catch (error) {
      if (error.legacyResponse) return res.status(error.legacyResponse.status).json(error.legacyResponse.body);
      sendFailure(res, error);
    }
  };
}

function withLegacyProductivityReadGuard(pool, handler) {
  return async (req, res) => {
    try {
      const project = await ownedProject(pool, projectId(req.params.id), req.user);
      if (await storedVersion(pool, project.id)) {
        throw conflict('PRODUCTIVITY_V2_RELOAD_REQUIRED', 'This project uses the new productivity model. Reload it in the updated application.');
      }
      return await handler(req, res);
    } catch (error) { sendFailure(res, error); }
  };
}

async function augmentProductivityRows(pool, rows) {
  if (!rows.length) return [];
  const ids = rows.map(row => projectId(row.project_id));
  const v2ById = new Map();
  for (let offset = 0; offset < ids.length; offset += 500) {
    const chunk = ids.slice(offset, offset + 500);
    const [storedRows] = await pool.query(
      `SELECT project_id, revision, document, updated_at FROM ${V2_TABLE} WHERE project_id IN (${chunk.map(() => '?').join(',')})`, chunk,
    );
    for (const stored of storedRows) v2ById.set(stored.project_id, stored);
  }
  return rows.map(row => {
    const stored = v2ById.get(row.project_id);
    if (!stored) return { ...row, model_version: 1, revision: 0 };
    const validated = decodeStored(stored);
    return v2Project(row, validated, stored.revision, stored.updated_at);
  });
}

module.exports = { registerProductivityV2Routes, withLegacyProductivityWrite,
  withLegacyProductivityReadGuard, augmentProductivityRows, emptyDocument,
  ProductivityHttpError, LEGACY_INPUT_SQL };
