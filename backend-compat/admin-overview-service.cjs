'use strict';

const { augmentProductivityRows } = require('./productivity-v2-service.cjs');

// Explicit projections keep passwords, answer JSON and weekly inputs out of the overview.
const ADMIN_USER_SQL = 'SELECT id, role FROM users WHERE id = ? LIMIT 1';
const ADMIN_BIDS_SQL = `SELECT b.id, b.bid_name, b.bid_location, b.user_id,
  b.total_score, b.created_at, b.updated_at, u.username, u.email
  FROM bids b LEFT JOIN users u ON b.user_id = u.id
  ORDER BY b.updated_at DESC, b.id DESC`;
const ADMIN_PRODUCTIVITY_SQL = `SELECT project_id, project_name, user_id, username, email,
  total_weeks, total_proactive_loss, total_retroactive_loss, created_at, updated_at
  FROM v_productivity_loss_summary ORDER BY updated_at DESC, project_id DESC`;

function positiveId(raw) {
  const value = typeof raw === 'string' && /^\d+$/.test(raw) ? Number(raw) : raw;
  return Number.isSafeInteger(value) && value > 0 ? value : null;
}

function requiredId(raw) {
  const value = positiveId(raw);
  if (value === null) throw new Error('Invalid saved metadata ID.');
  return value;
}

function nullableNumber(raw) {
  if (raw === null || raw === undefined) return null;
  if (typeof raw !== 'number' && (typeof raw !== 'string' || !raw.trim())) {
    throw new Error('Invalid saved numeric metadata.');
  }
  const value = Number(raw);
  if (!Number.isFinite(value)) throw new Error('Invalid saved numeric metadata.');
  return value;
}

function nullableText(raw) {
  return typeof raw === 'string' ? raw : null;
}

function dateString(raw) {
  if (raw === null || raw === undefined || raw === '') return null;
  if (!(raw instanceof Date) && typeof raw !== 'string') return null;
  const value = new Date(raw);
  return Number.isFinite(value.getTime()) ? value.toISOString() : null;
}

function owner(row) {
  return { id: requiredId(row.user_id), username: nullableText(row.username), email: nullableText(row.email) };
}

function bidMetadata(row) {
  if (typeof row.bid_name !== 'string') throw new Error('Invalid saved project name.');
  return { id: requiredId(row.id), name: row.bid_name.trim() || 'Untitled project', location: nullableText(row.bid_location),
    owner: owner(row), createdAt: dateString(row.created_at), updatedAt: dateString(row.updated_at),
    totalScore: nullableNumber(row.total_score) };
}

function productivityMetadata(row) {
  if (typeof row.project_name !== 'string') throw new Error('Invalid saved project name.');
  const totalWeeks = nullableNumber(row.total_weeks);
  if (totalWeeks !== null && (!Number.isInteger(totalWeeks) || totalWeeks < 1 || totalWeeks > 52)) {
    throw new Error('Invalid saved project duration.');
  }
  return { id: requiredId(row.project_id), name: row.project_name.trim() || 'Untitled project', owner: owner(row),
    createdAt: dateString(row.created_at), updatedAt: dateString(row.updated_at), totalWeeks,
    proactiveLoss: nullableNumber(row.total_proactive_loss), retroactiveLoss: nullableNumber(row.total_retroactive_loss),
    modelVersion: row.model_version, revision: row.revision };
}

function registerAdminOverviewRoute(app, { db, authenticateToken }) {
  if (typeof authenticateToken !== 'function' || typeof db?.query !== 'function') {
    throw new Error('Admin overview requires authentication and a database connection.');
  }
  app.get('/admin/overview', authenticateToken, async (req, res) => {
    res.set('Cache-Control', 'no-store');
    const id = positiveId(req.user?.id);
    if (id === null) return res.status(401).json({ msg: 'Sign in to continue.', code: 'AUTH_REQUIRED' });
    try {
      // JWT role claims and request bodies are deliberately ignored. A removed or
      // demoted account must not retain access using a previously issued token.
      const [users] = await db.query(ADMIN_USER_SQL, [id]);
      if (users.length !== 1 || positiveId(users[0].id) !== id || users[0].role !== 'admin') {
        return res.status(403).json({ msg: 'Administrator access is required.', code: 'ADMIN_ACCESS_DENIED' });
      }
      const [[bidRows], [productivityRows]] = await Promise.all([
        db.query(ADMIN_BIDS_SQL), db.query(ADMIN_PRODUCTIVITY_SQL),
      ]);
      const compatibleRows = await augmentProductivityRows(db, productivityRows);
      const bids = bidRows.map(bidMetadata);
      const productivity = compatibleRows.map(productivityMetadata);
      const projectOwners = new Set([...bids, ...productivity].map(project => project.owner.id)).size;
      return res.json({ generatedAt: new Date().toISOString(),
        summary: { bidProjects: bids.length, productivityProjects: productivity.length, projectOwners },
        bids, productivity });
    } catch {
      return res.status(500).json({ msg: 'The administrator overview could not be loaded. Please try again.', code: 'ADMIN_OVERVIEW_FAILED' });
    }
  });
}

module.exports = { registerAdminOverviewRoute, ADMIN_USER_SQL, ADMIN_BIDS_SQL, ADMIN_PRODUCTIVITY_SQL };
