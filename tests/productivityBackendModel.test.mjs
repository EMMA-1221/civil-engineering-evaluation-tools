import test from 'node:test';
import assert from 'node:assert/strict';
import backend from '../backend-compat/productivity-v2-model.cjs';
import { PRODUCTIVITY_FACTOR_IDS as browserFactorIds } from '../src/productivityFactors.js';

const { PRODUCTIVITY_FACTOR_IDS, ProductivityValidationError, validateProductivityDocument, legacyToDocument } = backend;
const defaults = ['overmanning', 'stacking_of_trades', 'overtime_5_10'];

// Transcribed independently from the audited original ProductivityV1.6.xlsm.
// SHA-256: bc286a1caffeecfdf8f209b0c7f22ab1f87e8c8f448bc03626298c40c0526ec3
// Proactive/Retroactive B:F; rows 3 planned, 4 change, 8 overmanning,
// 9 stacking, 10 overtime, 11 total factors, 12 loss, and J1 total loss.
// This small fixture contains workbook examples only, without user/project data.
const workbookSample = {
  planned: [1400, 1700, 2200, 1800, 2800],
  change: [0, -100, 0, 200, 0],
  factors: {
    overmanning: [0.22, 0, 0, 0.22, 0],
    stacking_of_trades: [0.28000000000000003, 0, 0.24, 0, 0],
    overtime_5_10: [0.05, 0.05, 0, 0, 0.05],
  },
  revised: [1400, 1600, 2200, 2000, 2800],
  totalFactors: [0.55, 0.05, 0.24, 0.22, 0.05],
  proactiveLoss: [770.0000000000001, 80, 528, 440, 140],
  retroactiveLoss: [496.7741935483871, 76.19047619047615, 425.8064516129032, 360.655737704918, 133.33333333333348],
};

function mode(totalWeeks = 1, selectedFactorIds = defaults) {
  return {
    version: 2,
    totalWeeks,
    selectedFactorIds: [...selectedFactorIds],
    planned: Array(totalWeeks).fill(1000),
    change: Array(totalWeeks).fill(0),
    factors: Object.fromEntries(PRODUCTIVITY_FACTOR_IDS.map(id => [id, Array(totalWeeks).fill(0)])),
  };
}

function document(totalWeeks = 1) {
  return { version: 2, inputMode: 'separate', totalWeeks, modes: { proactive: mode(totalWeeks), retroactive: mode(totalWeeks) } };
}

function invalid(raw, match) {
  assert.throws(() => validateProductivityDocument(raw), error => {
    assert.ok(error instanceof ProductivityValidationError);
    assert.equal(error.name, 'ProductivityValidationError');
    assert.equal(error.status, 400);
    assert.equal(error.code, 'INVALID_PRODUCTIVITY_DOCUMENT');
    if (match) assert.match(error.message, match);
    return true;
  });
}

test('server factor allowlist matches all 19 original workbook factors', () => {
  assert.deepEqual(PRODUCTIVITY_FACTOR_IDS, browserFactorIds);
  assert.equal(PRODUCTIVITY_FACTOR_IDS.length, 19);
});

test('independent original workbook sample reproduces every week and both raw totals', () => {
  const sample = mode(5);
  sample.planned = [...workbookSample.planned];
  sample.change = [...workbookSample.change];
  for (const id of defaults) sample.factors[id] = [...workbookSample.factors[id]];
  const { summaries } = validateProductivityDocument({
    version: 2, inputMode: 'separate', totalWeeks: 5,
    modes: { proactive: sample, retroactive: structuredClone(sample) },
  });
  assert.equal(summaries.proactive.totalLoss, 1958);
  assert.equal(summaries.retroactive.totalLoss, 1492.760192390018);
  for (let index = 0; index < 5; index++) {
    assert.equal(summaries.proactive.weeks[index].revisedHours, workbookSample.revised[index]);
    assert.equal(summaries.proactive.weeks[index].totalFactors, workbookSample.totalFactors[index]);
    assert.equal(summaries.proactive.weeks[index].loss, workbookSample.proactiveLoss[index]);
    assert.equal(summaries.retroactive.weeks[index].loss, workbookSample.retroactiveLoss[index]);
  }
  assert.notEqual(summaries.retroactive.totalLoss, Number(summaries.retroactive.totalLoss.toFixed(2)));
});

test('raw coefficients, hours, and losses retain double precision', () => {
  const raw = document();
  for (const value of Object.values(raw.modes)) {
    value.selectedFactorIds = ['owner_furnished'];
    value.factors.owner_furnished[0] = 0.043;
  }
  let result = validateProductivityDocument(raw);
  assert.equal(result.summaries.proactive.totalLoss, 43);
  assert.equal(result.summaries.retroactive.totalLoss, 1000 - 1000 / 1.043);
  raw.modes.proactive.planned[0] = 123.45678901234567;
  raw.modes.proactive.change[0] = -0.12345678901234;
  raw.modes.proactive.factors.owner_furnished[0] = 0.04312345678901234;
  result = validateProductivityDocument(raw);
  assert.deepEqual(result.document, raw);
  assert.equal(result.summaries.proactive.weeks[0].loss,
    (123.45678901234567 - 0.12345678901234) * 0.04312345678901234);
  assert.notEqual(result.summaries.proactive.totalLoss, Number(result.summaries.proactive.totalLoss.toFixed(2)));
});

test('negative second-shift coefficients and negative hours are accepted without clamping', () => {
  const raw = document();
  for (const value of Object.values(raw.modes)) {
    value.selectedFactorIds = ['second_shift'];
    value.factors.second_shift[0] = -0.05;
  }
  const result = validateProductivityDocument(raw);
  assert.equal(result.summaries.proactive.totalLoss, -50);
  assert.equal(result.summaries.retroactive.totalLoss, 1000 - 1000 / 0.95);
  raw.modes.proactive.planned[0] = -100;
  raw.modes.proactive.change[0] = -10;
  assert.equal(validateProductivityDocument(raw).summaries.proactive.totalLoss, 5.5);
});

test('all 19 factors and all 52 weeks can be persisted as independently cloned modes', () => {
  const raw = document(52);
  raw.modes.proactive.selectedFactorIds = [...PRODUCTIVITY_FACTOR_IDS];
  for (const id of PRODUCTIVITY_FACTOR_IDS) raw.modes.proactive.factors[id].fill(0.01);
  const result = validateProductivityDocument(raw);
  assert.equal(result.summaries.proactive.weeks.length, 52);
  assert.equal(result.summaries.retroactive.totalLoss, 0);
  assert.deepEqual(result.document, raw);
  result.document.modes.proactive.factors.overmanning[0] = 7;
  result.document.modes.proactive.selectedFactorIds.pop();
  assert.equal(raw.modes.proactive.factors.overmanning[0], 0.01);
  assert.equal(raw.modes.proactive.selectedFactorIds.length, 19);
  assert.equal(result.document.modes.retroactive.factors.overmanning[0], 0);
});

test('factor sums follow the selected factor order and ignore unselected values', () => {
  const raw = document();
  const proactive = raw.modes.proactive;
  proactive.selectedFactorIds = ['overmanning', 'overtime_5_10', 'second_shift'];
  proactive.factors.overmanning[0] = 1e16;
  proactive.factors.overtime_5_10[0] = -1e16;
  proactive.factors.second_shift[0] = 1;
  proactive.factors.weather[0] = 999;
  assert.equal(validateProductivityDocument(raw).summaries.proactive.weeks[0].totalFactors, 1);
  proactive.selectedFactorIds = ['overmanning', 'second_shift', 'overtime_5_10'];
  assert.equal(validateProductivityDocument(raw).summaries.proactive.weeks[0].totalFactors, 0);
  proactive.selectedFactorIds = [];
  assert.equal(validateProductivityDocument(raw).summaries.proactive.totalLoss, 0);
});

test('shared mode requires deep strict equality, including selection order and signed zero', () => {
  const raw = document(2);
  raw.inputMode = 'shared';
  assert.deepEqual(validateProductivityDocument(raw).document, raw);
  raw.modes.retroactive.change[1] = 0.001;
  invalid(raw, /identical/);
  raw.modes.retroactive = structuredClone(raw.modes.proactive);
  raw.modes.retroactive.selectedFactorIds.reverse();
  invalid(raw, /identical/);
  raw.modes.retroactive = structuredClone(raw.modes.proactive);
  raw.modes.retroactive.factors.weather[0] = -0;
  invalid(raw, /identical/);
});

test('document structure, version, week counts, factors, and selections are strict', () => {
  for (const mutate of [
    raw => { raw.version = 1; },
    raw => { raw.inputMode = 'both'; },
    raw => { raw.totalWeeks = 0; },
    raw => { raw.totalWeeks = 53; },
    raw => { raw.totalWeeks = 1.5; },
    raw => { raw.totalWeeks = '1'; },
    raw => { raw.extra = true; },
    raw => { delete raw.modes.retroactive; },
    raw => { raw.modes.future = mode(); },
    raw => { raw.modes.proactive.version = 3; },
    raw => { raw.modes.proactive.totalWeeks = 2; },
    raw => { raw.modes.proactive.planned = []; },
    raw => { raw.modes.proactive.change.push(0); },
    raw => { delete raw.modes.proactive.factors.weather; },
    raw => { raw.modes.proactive.factors.unsupported = [0]; },
    raw => { raw.modes.proactive.factors.second_shift = []; },
    raw => { raw.modes.proactive.selectedFactorIds = ['weather', 'weather']; },
    raw => { raw.modes.proactive.selectedFactorIds = ['unknown']; },
    raw => { raw.modes.proactive.selectedFactorIds = null; },
    raw => { raw.modes.proactive.extra = true; },
  ]) {
    const raw = document();
    mutate(raw);
    invalid(raw);
  }
  for (const raw of [null, undefined, [], 'invalid', {}]) invalid(raw);
});

test('all weekly values require finite numbers; sparse arrays and decimal strings are rejected', () => {
  for (const value of [NaN, Infinity, -Infinity, '0.043', null, undefined, true]) {
    for (const field of ['planned', 'change', 'factor']) {
      const raw = document();
      const target = field === 'factor' ? raw.modes.retroactive.factors.weather : raw.modes.proactive[field];
      target[0] = value;
      invalid(raw, /finite number/);
    }
  }
  const raw = document();
  raw.modes.proactive.planned = Array(1);
  invalid(raw, /finite number/);
});

test('retroactive sums reject only the zero denominator and retain Excel behavior below -1', () => {
  for (const coefficient of [-1, -1.01, -1.5, -2]) {
    const raw = document();
    raw.modes.proactive.factors.overmanning[0] = coefficient;
    assert.equal(validateProductivityDocument(raw).summaries.proactive.totalLoss, 1000 * coefficient);
    raw.modes.retroactive.factors.overmanning[0] = coefficient;
    if (coefficient === -1) invalid(raw, /zero denominator/);
    else assert.equal(validateProductivityDocument(raw).summaries.retroactive.totalLoss,
      1000 - 1000 / (1 + coefficient));
  }
});

test('computed hours, factor sums, weekly losses, and total losses must remain finite', () => {
  for (const mutate of [
    raw => { raw.modes.proactive.planned[0] = Number.MAX_VALUE; raw.modes.proactive.change[0] = Number.MAX_VALUE; },
    raw => { raw.modes.proactive.factors.overmanning[0] = Number.MAX_VALUE; raw.modes.proactive.factors.overtime_5_10[0] = Number.MAX_VALUE; },
    raw => { raw.modes.proactive.factors.overmanning[0] = Number.MAX_VALUE; },
    raw => { raw.modes.proactive.planned.fill(Number.MAX_VALUE); raw.modes.proactive.factors.overmanning.fill(1); },
    raw => { raw.modes.retroactive.planned[0] = Number.MAX_VALUE; raw.modes.retroactive.factors.overmanning[0] = -0.5; },
  ]) {
    const raw = document(2);
    mutate(raw);
    invalid(raw, /finite number/);
  }
});

test('legacy DECIMAL rows map only the original three factors into independent mode copies', () => {
  const rows = [
    { week_number: 2, planned_work_hours: '200.00123456789', change_order_hours: '-10', overmanning: '0.22', stacking_of_trades: '0.28000000000000003', overtime_5_10: '0.05' },
    { week_number: '1', planned_work_hours: 100, change_order_hours: null, overmanning: null, stacking_of_trades: 0.24, overtime_5_10: 0 },
    { week_number: 3, planned_work_hours: null, change_order_hours: null, overmanning: null, stacking_of_trades: null, overtime_5_10: null },
  ];
  const raw = legacyToDocument({ total_weeks: '3' }, rows);
  assert.equal(raw.inputMode, 'separate');
  assert.deepEqual(raw.modes.proactive, raw.modes.retroactive);
  assert.deepEqual(raw.modes.proactive.selectedFactorIds, defaults);
  assert.deepEqual(raw.modes.proactive.planned, [100, 200.00123456789, 0]);
  assert.deepEqual(raw.modes.proactive.change, [0, -10, 0]);
  assert.deepEqual(raw.modes.proactive.factors.stacking_of_trades, [0.24, 0.28000000000000003, 0]);
  for (const id of PRODUCTIVITY_FACTOR_IDS.filter(id => !defaults.includes(id))) {
    assert.deepEqual(raw.modes.proactive.factors[id], [0, 0, 0]);
  }
  raw.modes.proactive.planned[0] = 7;
  raw.modes.proactive.factors.overmanning[0] = 1;
  raw.modes.proactive.selectedFactorIds.pop();
  assert.equal(raw.modes.retroactive.planned[0], 100);
  assert.equal(raw.modes.retroactive.factors.overmanning[0], 0);
  assert.deepEqual(raw.modes.retroactive.selectedFactorIds, defaults);
  assert.equal(rows[1].planned_work_hours, 100);
});

test('legacy conversion rejects corrupt week counts, duplicate rows, and invalid numeric values', () => {
  for (const total_weeks of [0, 53, 2.5, null, 'invalid']) {
    assert.throws(() => legacyToDocument({ total_weeks }, []), ProductivityValidationError);
  }
  for (const rows of [
    [],
    [{ week_number: 1 }, { week_number: 1 }],
    [{ week_number: 0 }],
    [{ week_number: 2 }],
    [{ week_number: 1, planned_work_hours: 'not a number' }],
    [{ week_number: 1, overmanning: Infinity }],
    [{ week_number: 1, overmanning: '0x10' }],
    [{ week_number: 1, overmanning: '' }],
    [{ week_number: 1, overmanning: -1 }],
  ]) assert.throws(() => legacyToDocument({ total_weeks: 1 }, rows), ProductivityValidationError);
});
