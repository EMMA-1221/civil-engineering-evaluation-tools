import test from 'node:test';
import assert from 'node:assert/strict';
import schema from '../backend-compat/productivity-v2-schema.cjs';

function evidence(exists = false) {
  return {
    database: 'hcgway2',
    tables: [{ TABLE_NAME: 'productivity_loss_projects', ENGINE: 'InnoDB', TABLE_TYPE: 'BASE TABLE' },
      ...(exists ? [{ TABLE_NAME: 'productivity_loss_v2', ENGINE: 'InnoDB', TABLE_TYPE: 'BASE TABLE' }] : [])],
    columns: [{ TABLE_NAME: 'productivity_loss_projects', COLUMN_NAME: 'id', COLUMN_TYPE: 'int', IS_NULLABLE: 'NO', COLUMN_DEFAULT: null, EXTRA: 'auto_increment' },
      ...(exists ? Object.entries({ project_id: 'int', revision: 'int unsigned', document: 'json', updated_at: 'timestamp' }).map(([COLUMN_NAME, COLUMN_TYPE]) => ({
        TABLE_NAME: 'productivity_loss_v2', COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE: 'NO',
        COLUMN_DEFAULT: COLUMN_NAME === 'revision' ? '1' : COLUMN_NAME === 'updated_at' ? 'CURRENT_TIMESTAMP' : null,
        EXTRA: COLUMN_NAME === 'updated_at' ? 'DEFAULT_GENERATED on update CURRENT_TIMESTAMP' : '',
      })) : [])],
    primaryKeys: exists ? [{ COLUMN_NAME: 'project_id', SEQ_IN_INDEX: 1 }] : [],
    foreignKeys: exists ? [{ COLUMN_NAME: 'project_id', REFERENCED_TABLE_SCHEMA: 'hcgway2', REFERENCED_TABLE_NAME: 'productivity_loss_projects', REFERENCED_COLUMN_NAME: 'id', DELETE_RULE: 'CASCADE' }] : [],
  };
}

test('migration is additive and dry-run by default, with no blind IF NOT EXISTS or DROP', async () => {
  assert.equal(schema.productivityV2SchemaPlan(evidence()).action, 'create');
  assert.equal(schema.productivityV2SchemaPlan(evidence(true)).action, 'none');
  assert.doesNotMatch(schema.CREATE_PRODUCTIVITY_V2_SQL, /IF NOT EXISTS|DROP|ALTER|TRUNCATE/i);
  assert.match(schema.CREATE_PRODUCTIVITY_V2_SQL, /ON DELETE CASCADE/);
  const calls = [];
  const connection = schemaConnection(evidence(), calls);
  const result = await schema.prepareProductivityV2Schema(connection, 'hcgway2');
  assert.equal(result.applied, false); assert.equal(calls.some(sql => /^CREATE/.test(sql)), false);
});

test('preflight rejects wrong parent signedness, engines, existing columns, PK and FK cascade', () => {
  const wrongParent = evidence(); wrongParent.columns[0].COLUMN_TYPE = 'int unsigned';
  assert.throws(() => schema.productivityV2SchemaPlan(wrongParent), /parent/);
  for (const change of [
    data => { data.tables[1].ENGINE = 'MyISAM'; },
    data => { data.columns.find(row => row.COLUMN_NAME === 'document').COLUMN_TYPE = 'text'; },
    data => { data.columns.find(row => row.COLUMN_NAME === 'revision').IS_NULLABLE = 'YES'; },
    data => { data.columns.find(row => row.COLUMN_NAME === 'updated_at').COLUMN_DEFAULT = null; },
    data => { data.columns.push({ TABLE_NAME: 'productivity_loss_v2', COLUMN_NAME: 'unexpected', COLUMN_TYPE: 'int', IS_NULLABLE: 'NO' }); },
    data => { data.primaryKeys[0].COLUMN_NAME = 'revision'; },
    data => { data.foreignKeys[0].DELETE_RULE = 'RESTRICT'; },
    data => { data.foreignKeys[0].REFERENCED_TABLE_SCHEMA = 'other_database'; },
  ]) {
    const wrong = evidence(true); change(wrong); assert.throws(() => schema.productivityV2SchemaPlan(wrong));
  }
});

function schemaConnection(initial, calls, database = 'hcgway2') {
  let current = structuredClone(initial);
  return { query: async sql => {
    calls.push(sql.trim());
    if (sql.includes('information_schema.COLUMNS')) return [current.columns];
    if (sql.includes('information_schema.TABLES')) return [current.tables];
    if (sql.includes('information_schema.STATISTICS')) return [current.primaryKeys];
    if (sql.includes('information_schema.KEY_COLUMN_USAGE')) return [current.foreignKeys];
    if (sql === 'SELECT DATABASE() AS database_name') return [[{ database_name: database }]];
    if (sql === schema.CREATE_PRODUCTIVITY_V2_SQL) { current = evidence(true); return [{}]; }
    throw new Error('Unexpected migration statement');
  } };
}

test('explicit creation checks active database and re-inspects the exact resulting schema', async () => {
  const calls = [];
  const applied = await schema.prepareProductivityV2Schema(schemaConnection(evidence(), calls), 'hcgway2', { allowCreate: true });
  assert.equal(applied.applied, true); assert.equal(calls.filter(sql => sql.startsWith('CREATE TABLE')).length, 1);
  const wrongCalls = [];
  await assert.rejects(() => schema.prepareProductivityV2Schema(schemaConnection(evidence(), wrongCalls, 'other_database'), 'hcgway2', { allowCreate: true }), /active database/);
  assert.equal(wrongCalls.some(sql => /^CREATE/.test(sql)), false);
});
