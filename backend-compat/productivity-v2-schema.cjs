'use strict';

// Importing this module opens no DB connection and performs no migration.
// An explicit allowCreate:true call can add the reviewed table; it never alters
// old tables or drops retained version-2 data.
const CREATE_PRODUCTIVITY_V2_SQL = `CREATE TABLE productivity_loss_v2 (
  project_id INT NOT NULL,
  revision INT UNSIGNED NOT NULL DEFAULT 1,
  document JSON NOT NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (project_id),
  CONSTRAINT fk_productivity_v2_project FOREIGN KEY (project_id)
    REFERENCES productivity_loss_projects (id) ON DELETE CASCADE
) ENGINE=InnoDB`;

async function inspectProductivityV2Schema(connection, database) {
  const [columns] = await connection.query(`SELECT TABLE_NAME, COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE, COLUMN_DEFAULT, EXTRA
    FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME IN (?, ?)
    ORDER BY TABLE_NAME, ORDINAL_POSITION`, [database, 'productivity_loss_projects', 'productivity_loss_v2']);
  const [tables] = await connection.query(`SELECT TABLE_NAME, ENGINE, TABLE_TYPE FROM information_schema.TABLES
    WHERE TABLE_SCHEMA = ? AND TABLE_NAME IN (?, ?)`, [database, 'productivity_loss_projects', 'productivity_loss_v2']);
  const [primaryKeys] = await connection.query(`SELECT COLUMN_NAME, SEQ_IN_INDEX FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND INDEX_NAME = 'PRIMARY' ORDER BY SEQ_IN_INDEX`,
  [database, 'productivity_loss_v2']);
  const [foreignKeys] = await connection.query(`SELECT k.COLUMN_NAME, k.REFERENCED_TABLE_SCHEMA, k.REFERENCED_TABLE_NAME,
    k.REFERENCED_COLUMN_NAME, r.DELETE_RULE FROM information_schema.KEY_COLUMN_USAGE k
    JOIN information_schema.REFERENTIAL_CONSTRAINTS r ON r.CONSTRAINT_SCHEMA = k.CONSTRAINT_SCHEMA
      AND r.TABLE_NAME = k.TABLE_NAME AND r.CONSTRAINT_NAME = k.CONSTRAINT_NAME
    WHERE k.TABLE_SCHEMA = ? AND k.TABLE_NAME = ? AND k.REFERENCED_TABLE_NAME IS NOT NULL`,
  [database, 'productivity_loss_v2']);
  return { database, columns, tables, primaryKeys, foreignKeys };
}

function productivityV2SchemaPlan(evidence) {
  const parent = evidence.tables.find(row => row.TABLE_NAME === 'productivity_loss_projects');
  const parentId = evidence.columns.find(row => row.TABLE_NAME === 'productivity_loss_projects' && row.COLUMN_NAME === 'id');
  if (!parent || parent.ENGINE?.toLowerCase() !== 'innodb' || parent.TABLE_TYPE !== 'BASE TABLE'
    || !parentId || parentId.COLUMN_TYPE.toLowerCase() !== 'int' || parentId.IS_NULLABLE !== 'NO') {
    throw new Error('The parent project table does not match the reviewed signed INT/InnoDB schema.');
  }
  const target = evidence.tables.find(row => row.TABLE_NAME === 'productivity_loss_v2');
  const columns = evidence.columns.filter(row => row.TABLE_NAME === 'productivity_loss_v2');
  if (!target) {
    if (columns.length || evidence.primaryKeys.length || evidence.foreignKeys.length) throw new Error('Inconsistent v2 schema metadata.');
    return { action: 'create', sql: CREATE_PRODUCTIVITY_V2_SQL };
  }
  if (target.ENGINE?.toLowerCase() !== 'innodb' || target.TABLE_TYPE !== 'BASE TABLE') throw new Error('Existing v2 table has an unexpected engine/type.');
  const expected = { project_id: 'int', revision: 'int unsigned', document: 'json', updated_at: 'timestamp' };
  if (columns.length !== 4 || columns.some(row => expected[row.COLUMN_NAME] !== row.COLUMN_TYPE.toLowerCase() || row.IS_NULLABLE !== 'NO')
    || !columns.find(row => row.COLUMN_NAME === 'updated_at')?.EXTRA?.toLowerCase().includes('on update current_timestamp')) {
    throw new Error('Existing v2 columns differ from the reviewed schema; refusing an implicit migration.');
  }
  const defaultValue = name => columns.find(row => row.COLUMN_NAME === name)?.COLUMN_DEFAULT;
  const timestampDefault = String(defaultValue('updated_at')).toLowerCase().replace(/\(\)$/, '');
  if (String(defaultValue('revision')) !== '1' || timestampDefault !== 'current_timestamp'
    || defaultValue('project_id') !== null || defaultValue('document') !== null) {
    throw new Error('Existing v2 column defaults differ from the reviewed schema.');
  }
  if (evidence.primaryKeys.length !== 1 || evidence.primaryKeys[0].COLUMN_NAME !== 'project_id') throw new Error('Existing v2 primary key is invalid.');
  const foreign = evidence.foreignKeys;
  if (foreign.length !== 1 || foreign[0].COLUMN_NAME !== 'project_id'
    || foreign[0].REFERENCED_TABLE_SCHEMA !== evidence.database
    || foreign[0].REFERENCED_TABLE_NAME !== 'productivity_loss_projects' || foreign[0].REFERENCED_COLUMN_NAME !== 'id'
    || foreign[0].DELETE_RULE !== 'CASCADE') throw new Error('Existing v2 foreign key/cascade is invalid.');
  return { action: 'none', sql: null };
}

async function prepareProductivityV2Schema(connection, database, { allowCreate = false } = {}) {
  const evidence = await inspectProductivityV2Schema(connection, database);
  const plan = productivityV2SchemaPlan(evidence);
  if (!allowCreate || plan.action === 'none') return { ...plan, applied: false };
  const [current] = await connection.query('SELECT DATABASE() AS database_name');
  if (current.length !== 1 || current[0].database_name !== database) throw new Error('The active database does not match the reviewed migration destination.');
  // CREATE TABLE is additive DDL (autocommit). Never hide differences behind IF NOT EXISTS.
  await connection.query(CREATE_PRODUCTIVITY_V2_SQL);
  const after = productivityV2SchemaPlan(await inspectProductivityV2Schema(connection, database));
  if (after.action !== 'none') throw new Error('The additive table creation did not verify.');
  return { action: 'create', applied: true };
}

module.exports = { CREATE_PRODUCTIVITY_V2_SQL, inspectProductivityV2Schema,
  productivityV2SchemaPlan, prepareProductivityV2Schema };
