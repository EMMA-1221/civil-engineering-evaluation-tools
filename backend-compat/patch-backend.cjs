'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const BIDS = '// ==================== BIDS API ====================';
const PRODUCTIVITY = '// ==================== PRODUCTIVITY LOSS API ====================';
const MARKER = '// HCG_BID_V2_GUARD_V1';
const HELPER = 'hcg-bid-v2-validation.cjs';
const sha = data => crypto.createHash('sha256').update(data).digest('hex');

function replaceOne(source, needle, replacement, label) {
  if (source.split(needle).length !== 2) throw new Error(`Unexpected source: ${label} anchor must occur exactly once.`);
  return source.replace(needle, replacement);
}

function patchSource(source) {
  if (source.includes(MARKER)) {
    const post = source.includes('// HCG_BID_V2_POST_CHECK');
    const put = source.includes('// HCG_BID_V2_PUT_CHECK');
    if (!post || !put) throw new Error('A partial guard is present; manual review required.');
    return { changed: false, source, moduleType: /^\s*import\s/m.test(source) ? 'esm' : 'commonjs' };
  }
  const start = source.indexOf(BIDS);
  const end = source.indexOf(PRODUCTIVITY);
  if (start < 0 || end < start) throw new Error('Bid route boundaries were not found.');
  let bidRegion = source.slice(start, end);
  bidRegion = replaceOne(bidRegion,
    '    const [result] = await db.query(\n      "INSERT INTO bids',
    `    // HCG_BID_V2_POST_CHECK\n    const bidValidation = validateBidWrite({ incomingAnswers: answers, totalScore: total_score, isCreate: true });\n    if (!bidValidation.ok) {\n      return res.status(bidValidation.status).json({ msg: bidValidation.msg, code: bidValidation.code });\n    }\n\n    const [result] = await db.query(\n      "INSERT INTO bids`, 'POST insert');
  const putStart = bidRegion.indexOf('app.put("/bids/:id"');
  const deleteStart = bidRegion.indexOf('app.delete("/bids/:id"');
  if (putStart < 0 || deleteStart < putStart) throw new Error('PUT route boundaries were not found.');
  let put = bidRegion.slice(putStart, deleteStart);
  put = replaceOne(put, 'SELECT user_id FROM bids WHERE id = ?', 'SELECT user_id, answers FROM bids WHERE id = ?', 'PUT ownership read');
  put = replaceOne(put,
    '    await db.query(\n      "UPDATE bids SET',
    `    // HCG_BID_V2_PUT_CHECK: deliberately after the existing ownership check.\n    const bidValidation = validateBidWrite({ incomingAnswers: answers, totalScore: total_score, existingAnswers: bids[0].answers });\n    if (!bidValidation.ok) {\n      return res.status(bidValidation.status).json({ msg: bidValidation.msg, code: bidValidation.code });\n    }\n\n    await db.query(\n      "UPDATE bids SET`, 'PUT update');
  bidRegion = bidRegion.slice(0, putStart) + put + bidRegion.slice(deleteStart);
  const moduleType = /^\s*import\s/m.test(source) ? 'esm' : 'commonjs';
  const helperImport = moduleType === 'esm'
    ? `import bidV2Validation from './${HELPER}';\nconst { validateBidWrite } = bidV2Validation;`
    : `const { validateBidWrite } = require('./${HELPER}');`;
  const patched = source.slice(0, start) + `${MARKER}\n${helperImport}\n\n` + bidRegion + source.slice(end);
  return { changed: true, source: patched, moduleType };
}

function main() {
  const args = process.argv.slice(2);
  const apply = args.includes('--apply');
  const target = args.find(arg => !arg.startsWith('--'));
  const backupArgument = args.find(arg => arg.startsWith('--backup-dir='));
  if (!target) throw new Error('Usage: node patch-backend.cjs /absolute/backend/server.js [--apply --backup-dir=/private/backup/directory]');
  const absolute = path.resolve(target);
  if (fs.lstatSync(absolute).isSymbolicLink()) throw new Error('Refusing a symbolic-link server path.');
  const source = fs.readFileSync(absolute, 'utf8');
  const result = patchSource(source);
  const helper = fs.readFileSync(path.join(__dirname, HELPER));
  const helperTarget = path.join(path.dirname(absolute), HELPER);
  if (apply && !result.changed && (!fs.existsSync(helperTarget) || sha(fs.readFileSync(helperTarget)) !== sha(helper))) {
    throw new Error('The server is already marked patched but its helper is missing or differs; manual review required.');
  }
  if (apply && result.changed) {
    if (!backupArgument) throw new Error('Apply requires an explicit private --backup-dir outside the backend source directory.');
    const backupDirectory = path.resolve(backupArgument.slice('--backup-dir='.length));
    const relativeBackup = path.relative(path.dirname(absolute), backupDirectory);
    if (!relativeBackup.startsWith(`..${path.sep}`) && relativeBackup !== '..' && !path.isAbsolute(relativeBackup)) {
      throw new Error('The backup directory must be outside the backend source directory.');
    }
    if (!fs.statSync(backupDirectory).isDirectory()) throw new Error('The backup directory does not exist.');
    if (fs.existsSync(helperTarget) && sha(fs.readFileSync(helperTarget)) !== sha(helper)) {
      throw new Error('An unrelated helper already exists; refusing to overwrite it.');
    }
    // The credential-bearing original stays in a private external backup only.
    const backup = path.join(backupDirectory, `${path.basename(absolute)}.before-bid-v2-${Date.now()}`);
    fs.writeFileSync(backup, source, { flag: 'wx', mode: 0o600 });
    fs.writeFileSync(helperTarget, helper, { flag: fs.existsSync(helperTarget) ? 'w' : 'wx', mode: 0o644 });
    const temporary = `${absolute}.bid-v2-${process.pid}.tmp`;
    try {
      fs.writeFileSync(temporary, result.source, { flag: 'wx', mode: fs.statSync(absolute).mode & 0o777 });
      if (sha(fs.readFileSync(absolute)) !== sha(source)) throw new Error('The original server changed during preparation; refusing to replace it.');
      fs.renameSync(temporary, absolute);
    } finally { if (fs.existsSync(temporary)) fs.unlinkSync(temporary); }
  }
  console.log(JSON.stringify({ mode: apply ? 'apply' : 'dry-run', changed: result.changed,
    moduleType: result.moduleType, beforeSha256: sha(source), afterSha256: sha(result.source),
    helperSha256: sha(helper), restarted: false }));
}

module.exports = { patchSource };
if (require.main === module) { try { main(); } catch (error) { console.error(error.message); process.exitCode = 1; } }
