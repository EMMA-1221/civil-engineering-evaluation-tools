'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const MARKER = '// HCG_ADMIN_OVERVIEW_V1';
const ANCHOR = '// ==================== SERVER START ====================';
const HELPER = 'admin-overview-service.cjs';
const DEPENDENCIES = ['productivity-v2-service.cjs', 'productivity-v2-model.cjs'];
const REGISTRATION = 'registerAdminOverviewRoute(app, { db, authenticateToken });';
const sha = data => crypto.createHash('sha256').update(data).digest('hex');

function preamble(moduleType) {
  const dependency = moduleType === 'esm'
    ? `import adminOverviewCompatibility from './${HELPER}';`
    : `const adminOverviewCompatibility = require('./${HELPER}');`;
  return `${MARKER}\n${dependency}\nconst { registerAdminOverviewRoute } = adminOverviewCompatibility;\n${REGISTRATION}\n\n`;
}

function patchAdminSource(source) {
  const moduleType = /^\s*import\s/m.test(source) ? 'esm' : 'commonjs';
  if (source.split(ANCHOR).length !== 2) throw new Error('The server start anchor must occur exactly once.');
  if (source.split('registerProductivityV2Routes(app, { db, authenticateToken });').length !== 2) {
    throw new Error('The verified productivity v2 compatibility service must already be installed.');
  }
  const insertion = preamble(moduleType);
  if (source.includes(MARKER)) {
    if (source.split(MARKER).length !== 2 || !source.includes(`${insertion}${ANCHOR}`)
      || source.split(REGISTRATION).length !== 2 || /['"]\/admin\/overview['"]/.test(source)) {
      throw new Error('An incomplete or modified admin overview patch is present; manual review required.');
    }
    return { source, changed: false, moduleType };
  }
  if (/['"]\/admin\/overview['"]|registerAdminOverviewRoute|admin-overview-service\.cjs/.test(source)) {
    throw new Error('An unrecognized admin overview implementation already exists; refusing to replace it.');
  }
  return { source: source.replace(ANCHOR, `${insertion}${ANCHOR}`), changed: true, moduleType };
}

function regularFile(filename, label) {
  const stat = fs.lstatSync(filename);
  if (!stat.isFile() || stat.isSymbolicLink()) throw new Error(`${label} must be a regular file, not a symbolic link.`);
  return stat;
}

function main() {
  const args = process.argv.slice(2);
  if (args.some(value => value.startsWith('--') && value !== '--apply' && !value.startsWith('--backup-dir='))) {
    throw new Error('Unknown option. Only --apply and --backup-dir are supported.');
  }
  const targets = args.filter(value => !value.startsWith('--'));
  if (targets.length !== 1 || !path.isAbsolute(targets[0])) {
    throw new Error('Usage: node patch-admin-backend.cjs /absolute/server.js [--apply --backup-dir=/private/external/directory]');
  }
  const filename = fs.realpathSync(path.dirname(targets[0])) + path.sep + path.basename(targets[0]);
  const stat = regularFile(filename, 'Server source');
  const source = fs.readFileSync(filename, 'utf8');
  const patched = patchAdminSource(source);
  const helper = fs.readFileSync(path.join(__dirname, HELPER));
  const helperTarget = path.join(path.dirname(filename), HELPER);
  const dependencies = DEPENDENCIES.map(name => ({ name, data: fs.readFileSync(path.join(__dirname, name)) }));
  const apply = args.includes('--apply');
  if (apply) {
    for (const dependency of dependencies) {
      const target = path.join(path.dirname(filename), dependency.name);
      regularFile(target, dependency.name);
      if (sha(fs.readFileSync(target)) !== sha(dependency.data)) {
        throw new Error(`Installed ${dependency.name} differs from the reviewed dependency; manual review required.`);
      }
    }
    if (fs.existsSync(helperTarget)) {
      regularFile(helperTarget, HELPER);
      if (sha(fs.readFileSync(helperTarget)) !== sha(helper)) throw new Error('An existing admin helper differs; refusing to overwrite it.');
    } else if (!patched.changed) throw new Error('The marked admin overview patch is missing its runtime helper.');
    if (patched.changed) {
      const backupArgs = args.filter(value => value.startsWith('--backup-dir='));
      if (backupArgs.length !== 1) throw new Error('Apply requires one private external --backup-dir.');
      const directory = fs.realpathSync(path.resolve(backupArgs[0].slice('--backup-dir='.length)));
      const relative = path.relative(path.dirname(filename), directory);
      const backupStat = fs.statSync(directory);
      if ((!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative))
        || !backupStat.isDirectory()) throw new Error('Backup directory must be an existing directory outside the backend source directory.');
      if (backupStat.mode & 0o077) throw new Error('The credential-bearing original requires a private backup directory (mode 0700).');
      const backup = path.join(directory, `${path.basename(filename)}.before-admin-overview-${Date.now()}`);
      fs.writeFileSync(backup, source, { flag: 'wx', mode: 0o600 });
      if (!fs.existsSync(helperTarget)) fs.writeFileSync(helperTarget, helper, { flag: 'wx', mode: 0o644 });
      const temporary = `${filename}.admin-overview-${process.pid}.tmp`;
      try {
        fs.writeFileSync(temporary, patched.source, { flag: 'wx', mode: stat.mode & 0o777 });
        if (sha(fs.readFileSync(filename)) !== sha(source)) throw new Error('Server source changed during preparation; refusing replacement.');
        fs.renameSync(temporary, filename);
      } finally { if (fs.existsSync(temporary)) fs.unlinkSync(temporary); }
    }
  }
  console.log(JSON.stringify({ mode: apply ? 'apply' : 'dry-run', changed: patched.changed,
    moduleType: patched.moduleType, beforeSha256: sha(source), afterSha256: sha(patched.source),
    helperSha256: { [HELPER]: sha(helper), ...Object.fromEntries(dependencies.map(item => [item.name, sha(item.data)])) },
    schemaChanged: false, restarted: false }));
}

module.exports = { patchAdminSource };
if (require.main === module) { try { main(); } catch (error) { console.error(error.message); process.exitCode = 1; } }
