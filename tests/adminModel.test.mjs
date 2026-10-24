import test from 'node:test';
import assert from 'node:assert/strict';
import { filterAdminProjects, parseAdminOverview } from '../src/adminModel.js';

const owner = (id, username, email = null) => ({ id, username, email });
const project = (id, name, account, updatedAt = '2026-10-24T10:00:00Z') => ({ id, name, owner: account, createdAt: '2026-10-23T10:00:00Z', updatedAt });
const example = () => ({
  generatedAt: '2026-10-24T12:00:00Z',
  summary: { bidProjects: 999, productivityProjects: 999, projectOwners: 999 },
  bids: [project(1, 'Hospital North', owner(4, 'Emma', 'emma@example.com'))],
  productivity: [project(1, 'Library', owner(5, 'Hanna', 'hanna@example.com'), '2026-10-24T11:00:00Z'), project(2, 'Hospital South', owner(4, 'Emma', 'emma@example.com'))],
});

test('admin overview derives honest counts from both verified project lists and shared owners', () => {
  const data = parseAdminOverview(example());
  assert.equal(data.projects.length, 3);
  assert.deepEqual(data.summary, { bidProjects: 1, productivityProjects: 2, projectOwners: 2 });
  assert.equal(data.projects[0].name, 'Library');
  assert.equal(data.projects.filter(item => item.id === 1).length, 2, 'IDs are scoped by tool');
});

test('admin overview rejects partial, malformed and duplicate results instead of showing empty success', () => {
  const bad = [null, {}, { ...example(), productivity: undefined }, { ...example(), generatedAt: 'yesterday' }];
  for (const change of [
    { id: '../2' }, { name: null }, { owner: { id: 0, username: 'Emma', email: null } },
    { owner: { id: 4, username: { display: 'Emma' }, email: null } }, { updatedAt: 'not a date' },
  ]) {
    const value = example(); value.bids[0] = { ...value.bids[0], ...change }; bad.push(value);
  }
  const duplicates = example(); duplicates.bids.push({ ...duplicates.bids[0] }); bad.push(duplicates);
  for (const value of bad) assert.throws(() => parseAdminOverview(value), /could not be verified/);
});

test('empty verified overview and unrecorded dates have explicit safe states', () => {
  const data = parseAdminOverview({ generatedAt: '2026-10-24T12:00:00Z', bids: [], productivity: [] });
  assert.deepEqual(data.projects, []);
  assert.deepEqual(data.summary, { bidProjects: 0, productivityProjects: 0, projectOwners: 0 });
  const missingDate = example(); missingDate.bids[0].createdAt = null; missingDate.bids[0].updatedAt = null;
  assert.equal(parseAdminOverview(missingDate).projects.at(-1).updatedAt, null);
});

test('admin search combines project or owner search with the selected tool without mutating data', () => {
  const data = parseAdminOverview(example());
  assert.equal(filterAdminProjects(data.projects, ' HOSPITAL ').length, 2);
  assert.equal(filterAdminProjects(data.projects, 'EMMA@EXAMPLE', 'productivity').length, 1);
  assert.equal(filterAdminProjects(data.projects, 'hanna', 'bid').length, 0);
  assert.equal(filterAdminProjects(data.projects, '', 'productivity').length, 2);
  assert.equal(filterAdminProjects(data.projects, '', 'unknown').length, 0);
  assert.equal(data.projects.length, 3);
});
