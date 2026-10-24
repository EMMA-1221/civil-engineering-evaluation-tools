'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const MARKER = '// HCG_PRODUCTIVITY_V2_COMPAT_V1';
const START = '// ==================== PRODUCTIVITY LOSS API ====================';
const END = '// ==================== SERVER START ====================';
const HELPERS = ['productivity-v2-model.cjs', 'productivity-v2-service.cjs'];
const sha = data => crypto.createHash('sha256').update(data).digest('hex');

function one(source, needle, replacement, label) {
  if (source.split(needle).length !== 2) throw new Error(`Unexpected source: ${label} anchor must occur exactly once.`);
  return source.replace(needle, replacement);
}

function wrapRoute(source, method, route, write) {
  const signature = `app.${method}('${route}', authenticateToken, async (req, res) => {`;
  const start = source.indexOf(signature);
  if (start < 0 || source.split(signature).length !== 2) throw new Error(`Missing or duplicate legacy ${method} ${route}.`);
  const end = source.indexOf('\n});', start);
  if (end < 0) throw new Error(`Missing legacy route end: ${route}.`);
  const helper = write ? 'withLegacyProductivityWrite' : 'withLegacyProductivityReadGuard';
  const replacement = `app.${method}('${route}', authenticateToken, ${helper}(db, async (req, res${write ? ', db' : ''}) => {`;
  return source.slice(0, start) + replacement + source.slice(start + signature.length, end) + '\n}));' + source.slice(end + '\n});'.length);
}

function patchProductivitySource(source) {
  const moduleType = /^\s*import\s/m.test(source) ? 'esm' : 'commonjs';
  if (source.includes(MARKER)) {
    if (!source.includes('registerProductivityV2Routes(app, { db, authenticateToken });')
      || !source.includes('const compatibleProductivityLosses = await augmentProductivityRows(db, productivityLosses);')
      || (source.match(/withLegacyProductivityWrite\(db, async \(req, res, db\)/g) || []).length !== 4
      || (source.match(/withLegacyProductivityReadGuard\(db, async \(req, res\)/g) || []).length !== 2) {
      throw new Error('A partial productivity compatibility patch is present; manual review required.');
    }
    return { source, changed: false, moduleType };
  }
  const start = source.indexOf(START);
  const end = source.indexOf(END, start);
  if (start < 0 || end < start) throw new Error('Productivity route boundaries were not found.');
  let region = source.slice(start, end);
  region = one(region, '    const [productivityLosses] = await db.query(query, params);',
    '    const [productivityLosses] = await db.query(query, params);\n    const compatibleProductivityLosses = await augmentProductivityRows(db, productivityLosses);', 'project list read');
  region = one(region, '      productivityLosses,', '      productivityLosses: compatibleProductivityLosses,', 'project list response');
  for (const [method, route] of [
    ['put', '/productivity-losses/:id/weeks/:weekNumber'],
    ['put', '/productivity-losses/:id/weeks'],
    ['delete', '/productivity-losses/:id'],
    ['patch', '/productivity-losses/:id/weeks-count'],
  ]) region = wrapRoute(region, method, route, true);
  for (const route of ['/productivity-losses/:id', '/productivity-losses/:id/summary']) {
    region = wrapRoute(region, 'get', route, false);
  }
  const dependency = moduleType === 'esm'
    ? "import productivityV2Compatibility from './productivity-v2-service.cjs';"
    : "const productivityV2Compatibility = require('./productivity-v2-service.cjs');";
  const preamble = `${MARKER}\n${dependency}\nconst { registerProductivityV2Routes, withLegacyProductivityWrite,\n  withLegacyProductivityReadGuard, augmentProductivityRows } = productivityV2Compatibility;\nregisterProductivityV2Routes(app, { db, authenticateToken });\n\n`;
  return { source: source.slice(0, start) + preamble + region + source.slice(end), changed: true, moduleType };
}

function main() {
  const args = process.argv.slice(2);
  const target = args.find(value => !value.startsWith('--'));
  if (!target) throw new Error('Usage: node patch-productivity-backend.cjs /absolute/server.js [--apply --backup-dir=/private/external/directory]');
  const apply = args.includes('--apply');
  const filename = path.resolve(target);
  if (fs.lstatSync(filename).isSymbolicLink()) throw new Error('Refusing a symbolic-link server path.');
  const source = fs.readFileSync(filename, 'utf8');
  const patched = patchProductivitySource(source);
  const helpers = HELPERS.map(name => ({ name, data: fs.readFileSync(path.join(__dirname, name)) }));
  if (apply) {
    for (const helper of helpers) {
      const destination = path.join(path.dirname(filename), helper.name);
      if (fs.existsSync(destination) && sha(fs.readFileSync(destination)) !== sha(helper.data)) {
        throw new Error(`An existing ${helper.name} differs; explicit update review required.`);
      }
      if (!patched.changed && !fs.existsSync(destination)) throw new Error('The server is already marked patched but a runtime helper is missing.');
    }
    if (patched.changed) {
      const backupArg = args.find(value => value.startsWith('--backup-dir='));
      if (!backupArg) throw new Error('Apply requires a private external --backup-dir.');
      const backupDirectory = fs.realpathSync(path.resolve(backupArg.slice('--backup-dir='.length)));
      const relative = path.relative(fs.realpathSync(path.dirname(filename)), backupDirectory);
      if (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative)) throw new Error('Backup directory must be outside the backend source directory.');
      if (!fs.statSync(backupDirectory).isDirectory()) throw new Error('Backup directory does not exist.');
      const backup = path.join(backupDirectory, `${path.basename(filename)}.before-productivity-v2-${Date.now()}`);
      fs.writeFileSync(backup, source, { flag: 'wx', mode: 0o600 });
      for (const helper of helpers) {
        const destination = path.join(path.dirname(filename), helper.name);
        if (!fs.existsSync(destination)) fs.writeFileSync(destination, helper.data, { flag: 'wx', mode: 0o644 });
      }
      const temporary = `${filename}.productivity-v2-${process.pid}.tmp`;
      try {
        fs.writeFileSync(temporary, patched.source, { flag: 'wx', mode: fs.statSync(filename).mode & 0o777 });
        if (sha(fs.readFileSync(filename)) !== sha(source)) throw new Error('Server source changed during preparation; refusing replacement.');
        fs.renameSync(temporary, filename);
      } finally { if (fs.existsSync(temporary)) fs.unlinkSync(temporary); }
    }
  }
  console.log(JSON.stringify({ mode: apply ? 'apply' : 'dry-run', changed: patched.changed,
    moduleType: patched.moduleType, beforeSha256: sha(source), afterSha256: sha(patched.source),
    helperSha256: Object.fromEntries(helpers.map(helper => [helper.name, sha(helper.data)])),
    schemaChanged: false, restarted: false }));
}

module.exports = { patchProductivitySource };
if (require.main === module) { try { main(); } catch (error) { console.error(error.message); process.exitCode = 1; } }
