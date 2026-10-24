import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  DEFAULT_PRODUCTIVITY_FACTOR_IDS,
  PRODUCTIVITY_FACTORS,
  PRODUCTIVITY_FACTOR_IDS,
  PRODUCTIVITY_WORKBOOK_SHA256,
} from '../src/productivityFactors.js';
import {
  MAX_PRODUCTIVITY_WEEKS,
  calculateProductivityAnalysis,
  calculateProductivityWeek,
  createProductivityAnalysis,
  formatProductivityPercent,
  getDefaultPresetName,
  hydrateProductivityAnalysis,
  parseProductivityPercent,
  resetProductivityAnalysis,
  resizeProductivityWeeks,
  serializeProductivityAnalysis,
  setSelectedProductivityFactors,
} from '../src/productivityModel.js';

const fixture = JSON.parse(readFileSync(new URL('./fixtures/productivity-workbook.json', import.meta.url), 'utf8'));
const close = (actual, expected, tolerance = 1e-9) => assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} does not match ${expected}`);

function workbookExample(mode) {
  const source = fixture.examples[mode];
  const model = createProductivityAnalysis({ totalWeeks: source.planned.length, selectedFactorIds: source.selectedFactorIds });
  model.planned = [...source.planned];
  model.change = [...source.change];
  for (const [id, values] of Object.entries(source.factors)) model.factors[id] = [...values];
  return model;
}

test('the complete 19-factor catalog matches independently extracted workbook cells', () => {
  assert.equal(PRODUCTIVITY_FACTORS.length, 19);
  assert.equal(new Set(PRODUCTIVITY_FACTOR_IDS).size, 19);
  assert.equal(PRODUCTIVITY_WORKBOOK_SHA256, fixture.source.sha256);
  assert.deepEqual(PRODUCTIVITY_FACTORS, fixture.factorCatalog);
  for (const factor of PRODUCTIVITY_FACTORS) for (const severity of ['minor', 'moderate', 'severe']) {
    assert.ok(Object.is(factor[severity], Number(factor.sourceRaw[severity])), `${factor.id} ${severity} must use the exact source double.`);
  }
  const owner = PRODUCTIVITY_FACTORS.find(factor => factor.id === 'owner_furnished');
  assert.deepEqual([owner.minor, owner.moderate, owner.severe], [0.043, 0.111, 0.179]);
  assert.equal(PRODUCTIVITY_FACTORS.find(factor => factor.id === 'second_shift').minor, -0.05);
  const sequence = PRODUCTIVITY_FACTORS.find(factor => factor.id === 'out_of_sequence');
  assert.ok(sequence.moderate > sequence.severe, 'Preserve the source values instead of sorting severity coefficients.');
});

for (const mode of ['proactive', 'retroactive']) {
  test(`${mode}: all five workbook weeks and the independent cached Excel total reconcile`, () => {
    const source = fixture.examples[mode];
    assert.equal(source.planned.length, 5);
    assert.deepEqual(source.weekLabels, ['week 10', 'week 11', 'week 12', 'week 13', 'week 14']);
    const result = calculateProductivityAnalysis(workbookExample(mode), mode);
    result.weeks.forEach((week, index) => {
      close(week.revisedHours, source.expected.revised[index]);
      close(week.totalFactor, source.expected.totalFactors[index]);
      close(week.loss, source.expected.weeklyLoss[index]);
    });
    close(result.totalLoss, source.expected.totalLoss);
    assert.equal(result.totalPlanned, 9900);
    assert.equal(result.totalChange, 100);
    assert.equal(result.totalRevised, 10000);
  });
}

test('calculation mode is explicit and never changes the stored input document', () => {
  const model = workbookExample('proactive');
  const original = structuredClone(model);
  close(calculateProductivityAnalysis(model, 'proactive').totalLoss, 1958);
  close(calculateProductivityAnalysis(model, 'retroactive').totalLoss, 1492.7601923900179);
  assert.deepEqual(model, original);
  assert.throws(() => calculateProductivityAnalysis(model), /proactive or retroactive/);
  assert.throws(() => calculateProductivityAnalysis(model, 'other'), /proactive or retroactive/);
  assert.equal(Object.hasOwn(serializeProductivityAnalysis(model), 'mode'), false);
});

test('dynamic factor selection retains removed inputs but counts only selected factors', () => {
  let model = createProductivityAnalysis({ totalWeeks: 1 });
  model.planned[0] = 100;
  model.factors.overmanning[0] = 0.22;
  model.factors.owner_furnished[0] = 0.043;
  close(calculateProductivityAnalysis(model, 'proactive').totalLoss, 22);
  model = setSelectedProductivityFactors(model, ['overmanning', 'owner_furnished']);
  close(calculateProductivityAnalysis(model, 'proactive').totalLoss, 26.3);
  model = setSelectedProductivityFactors(model, []);
  assert.equal(calculateProductivityAnalysis(model, 'proactive').totalLoss, 0);
  assert.equal(model.factors.owner_furnished[0], 0.043);
  const reloaded = hydrateProductivityAnalysis(serializeProductivityAnalysis(model));
  model = setSelectedProductivityFactors(reloaded, ['owner_furnished']);
  close(calculateProductivityAnalysis(model, 'proactive').totalLoss, 4.3);
  assert.throws(() => setSelectedProductivityFactors(model, ['owner_furnished', 'owner_furnished']), /more than once/);
  assert.throws(() => setSelectedProductivityFactors(model, ['unknown']), /Unknown productivity/);
});

test('each week can independently use a preset, no impact, or an exact custom coefficient', () => {
  const model = createProductivityAnalysis({ totalWeeks: 3, selectedFactorIds: ['owner_furnished'] });
  model.planned = [100, 100, 100];
  model.factors.owner_furnished = [0.043, 0, 0.11123456789];
  close(calculateProductivityWeek(model, 0, 'proactive').loss, 4.3);
  assert.equal(calculateProductivityWeek(model, 1, 'proactive').loss, 0);
  close(calculateProductivityWeek(model, 2, 'proactive').loss, 11.123456789);
  assert.equal(getDefaultPresetName('owner_furnished', 0.043), 'minor');
  assert.equal(getDefaultPresetName('owner_furnished', 0.111), 'moderate');
  assert.equal(getDefaultPresetName('owner_furnished', 0.179), 'severe');
  assert.equal(getDefaultPresetName('owner_furnished', 0), 'none');
  assert.equal(getDefaultPresetName('owner_furnished', 0.11123456789), 'custom');
});

test('negative change orders, negative factors, and negative revised hours follow the source formulas', () => {
  const model = createProductivityAnalysis({ totalWeeks: 2, selectedFactorIds: ['second_shift'] });
  model.planned = [100, 10];
  model.change = [-20, -20];
  model.factors.second_shift = [-0.05, 0.1];
  const proactive = calculateProductivityAnalysis(model, 'proactive');
  assert.deepEqual(proactive.weeks.map(row => row.revisedHours), [80, -10]);
  assert.deepEqual(proactive.weeks.map(row => row.loss), [-4, -1]);
  close(calculateProductivityWeek(model, 0, 'retroactive').loss, 80 - 80 / 0.95);
  close(calculateProductivityWeek(model, 1, 'retroactive').loss, -10 + 10 / 1.1);
});

test('retroactive rejects its division-by-zero singularity while preserving the workbook formula below -100%', () => {
  const model = createProductivityAnalysis({ totalWeeks: 1, selectedFactorIds: ['second_shift'] });
  model.planned[0] = 100;
  model.factors.second_shift[0] = -1;
  assert.throws(() => calculateProductivityAnalysis(model, 'retroactive'), /cannot equal -100%/);
  for (const value of [-1.01, -1.2, -2]) {
    model.factors.second_shift[0] = value;
    assert.equal(calculateProductivityAnalysis(model, 'retroactive').totalLoss, 100 - 100 / (1 + value));
    assert.equal(calculateProductivityAnalysis(model, 'proactive').totalLoss, 100 * value);
  }
});

test('totals sum unrounded weekly results and serialization preserves coefficient precision', () => {
  const model = createProductivityAnalysis({ totalWeeks: 2, selectedFactorIds: ['owner_furnished'] });
  model.planned = [1, 1];
  model.factors.owner_furnished = [0.004, 0.004];
  assert.equal(calculateProductivityAnalysis(model, 'proactive').totalLoss, 0.008);
  model.factors.owner_furnished[0] = 0.11123456789123;
  const serialized = serializeProductivityAnalysis(model);
  assert.equal(serialized.factors.owner_furnished[0], 0.11123456789123);
  assert.equal(typeof serialized.factors.owner_furnished[0], 'number');
  assert.deepEqual(hydrateProductivityAnalysis(JSON.parse(JSON.stringify(serialized))), serialized);
});

test('reset and resize use the exact project duration rather than the old hard-coded 14 weeks', () => {
  const original = workbookExample('proactive');
  const snapshot = structuredClone(original);
  const extended = resizeProductivityWeeks(original, MAX_PRODUCTIVITY_WEEKS);
  assert.equal(extended.totalWeeks, 52);
  assert.deepEqual(extended.planned.slice(0, 5), original.planned);
  assert.ok(extended.planned.slice(5).every(value => value === 0));
  const shortened = resizeProductivityWeeks(extended, 2);
  assert.deepEqual(shortened.planned, original.planned.slice(0, 2));
  const reset = resetProductivityAnalysis(shortened);
  assert.equal(reset.totalWeeks, 2);
  assert.deepEqual(reset.selectedFactorIds, original.selectedFactorIds);
  assert.ok(reset.planned.every(value => value === 0));
  assert.ok(Object.values(reset.factors).every(values => values.length === 2 && values.every(value => value === 0)));
  assert.deepEqual(original, snapshot);
  for (const count of [0, 53, 1.5, Infinity, 'bad']) assert.throws(() => resizeProductivityWeeks(original, count));
  assert.throws(() => calculateProductivityWeek(original, 5, 'proactive'), /outside/);
});

test('legacy API rows map all three original columns without converting fractions to percentages', () => {
  const model = hydrateProductivityAnalysis({
    project: { total_weeks: 2 },
    weeks: [
      { week_number: 2, planned_work_hours: '200.00', change_order_hours: '-10', overmanning: '0.22', stacking_of_trades: '0.28', overtime_5_10: '0.05' },
      { week_number: 1, planned_work_hours: 100, change_order_hours: null, overmanning: null, stacking_of_trades: 0.24, overtime_5_10: 0 },
    ],
  });
  assert.deepEqual(model.selectedFactorIds, DEFAULT_PRODUCTIVITY_FACTOR_IDS);
  assert.deepEqual(model.planned, [100, 200]);
  assert.deepEqual(model.change, [0, -10]);
  assert.deepEqual(model.factors.stacking_of_trades, [0.24, 0.28]);
  assert.deepEqual(model.factors.overtime_5_10, [0, 0.05]);
  assert.deepEqual(model.factors.owner_furnished, [0, 0]);
  close(calculateProductivityAnalysis(model, 'proactive').totalLoss, 128.5);
  assert.throws(() => hydrateProductivityAnalysis({ project: { total_weeks: 1 }, weeks: [{ week_number: 1 }, { week_number: 1 }] }), /unique/);
  assert.throws(() => hydrateProductivityAnalysis({ project: { total_weeks: 1 }, weeks: [{ week_number: 2 }] }), /within/);
  assert.throws(() => hydrateProductivityAnalysis({ project: { total_weeks: 2 }, weeks: [{ week_number: 1 }] }), /missing one or more/);
  assert.throws(() => hydrateProductivityAnalysis({ project: { total_weeks: 1 }, weeks: [] }), /missing one or more/);
});

test('legacy shared context aliases migrate without carrying a stale 14-week reset', () => {
  const model = hydrateProductivityAnalysis({ planned: [100], change: [-10], factors: { overmanning: [0.22], stacking: [0.28], overtime: [0.05] } });
  assert.equal(model.totalWeeks, 1);
  assert.equal(model.factors.stacking_of_trades[0], 0.28);
  assert.equal(model.factors.overtime_5_10[0], 0.05);
  close(calculateProductivityAnalysis(model, 'proactive').totalLoss, 49.5);
  assert.equal(resetProductivityAnalysis(model).planned.length, 1);
  assert.throws(() => hydrateProductivityAnalysis({ planned: [0], change: [0], factors: { stacking: [0.24], stacking_of_trades: [0.28] } }), /duplicated/);
});

test('percentage inputs convert display units once, retain signs and reject incomplete or nonfinite values', () => {
  assert.equal(parseProductivityPercent('4.3'), 0.043);
  assert.equal(parseProductivityPercent(' 4.3% '), 0.043);
  assert.equal(parseProductivityPercent('-5'), -0.05);
  assert.equal(parseProductivityPercent(''), 0);
  assert.equal(parseProductivityPercent('0'), 0);
  assert.equal(formatProductivityPercent(0.043), '4.3');
  assert.equal(formatProductivityPercent(0.28000000000000003), '28');
  for (const value of ['-', '.', '%', '4.3abc', '4,3', 'Infinity', NaN, Infinity, null, false]) {
    assert.throws(() => parseProductivityPercent(value), /finite number/);
  }
});

test('unknown versions, missing selected data, invalid numbers and overflow are rejected', () => {
  const model = createProductivityAnalysis({ totalWeeks: 1 });
  assert.throws(() => hydrateProductivityAnalysis({ ...model, version: 3 }), /version/);
  assert.throws(() => hydrateProductivityAnalysis({ ...model, factors: {} }), /exactly/);
  assert.throws(() => serializeProductivityAnalysis({ ...model, planned: [NaN] }), /finite/);
  assert.throws(() => serializeProductivityAnalysis({ ...model, change: [Infinity] }), /finite/);
  assert.throws(() => hydrateProductivityAnalysis({ ...model, factors: { ...model.factors, invented: [0] } }), /exactly/);
  assert.throws(() => hydrateProductivityAnalysis({ ...model, planned: [0, 1] }), /exactly/);
  assert.throws(() => serializeProductivityAnalysis({ ...model, factors: { ...model.factors, owner_furnished: Array(1) } }), /finite/);
  const missingUnselected = structuredClone(model);
  delete missingUnselected.factors.owner_furnished;
  assert.throws(() => hydrateProductivityAnalysis(missingUnselected), /exactly/);
  for (const raw of ['', '0', null, undefined, false, Infinity, NaN]) {
    assert.throws(() => hydrateProductivityAnalysis({ ...model, planned: [raw] }), /finite/);
    assert.throws(() => hydrateProductivityAnalysis({ ...model, factors: { ...model.factors, owner_furnished: [raw] } }), /finite/);
  }
  assert.throws(() => hydrateProductivityAnalysis({ ...model, totalWeeks: '1' }), /number/);
  assert.throws(() => hydrateProductivityAnalysis({ ...model, unexpected: true }), /exactly/);
  model.planned[0] = 1e308;
  model.factors.overmanning[0] = 2;
  assert.throws(() => calculateProductivityAnalysis(model, 'proactive'), /finite/);
});
