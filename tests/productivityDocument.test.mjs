import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import test from 'node:test';
import {
  calculateProductivityDocument,
  createProductivityDocument,
  hasProductivityValuesAfter,
  hydrateProductivityDocument,
  resetProductivityMode,
  resizeProductivityDocument,
  serializeProductivityDocument,
  updateProductivityMode,
} from '../src/productivityDocument.js';
import { hydrateProductivityAnalysis } from '../src/productivityModel.js';

const { validateProductivityDocument, legacyToDocument } = createRequire(import.meta.url)('../backend-compat/productivity-v2-model.cjs');

test('separate methods have independent arrays on create, hydration and update', () => {
  const source = createProductivityDocument(3, 'separate');
  assert.notEqual(source.modes.proactive, source.modes.retroactive);
  assert.notEqual(source.modes.proactive.planned, source.modes.retroactive.planned);
  assert.notEqual(source.modes.proactive.factors.overmanning, source.modes.retroactive.factors.overmanning);
  const nextInput = structuredClone(source.modes.proactive);
  nextInput.planned[0] = 100;
  nextInput.factors.overmanning[0] = 0.22;
  const updated = updateProductivityMode(source, 'proactive', nextInput);
  assert.equal(updated.modes.proactive.planned[0], 100);
  assert.equal(updated.modes.retroactive.planned[0], 0);
  assert.equal(source.modes.proactive.planned[0], 0);
  nextInput.planned[0] = 999;
  assert.equal(updated.modes.proactive.planned[0], 100);
  const reloaded = hydrateProductivityDocument(JSON.stringify(updated));
  reloaded.modes.proactive.factors.overmanning[0] = 0.5;
  assert.equal(reloaded.modes.retroactive.factors.overmanning[0], 0);
  assert.equal(updated.modes.proactive.factors.overmanning[0], 0.22);
});

test('shared updates synchronize both methods without creating reference aliases', () => {
  let document = createProductivityDocument(2, 'shared');
  const input = structuredClone(document.modes.retroactive);
  input.planned = [100, 200];
  input.change = [-10, 0];
  input.factors.overmanning = [0.22, 0];
  document = updateProductivityMode(document, 'retroactive', input);
  assert.deepEqual(document.modes.proactive, document.modes.retroactive);
  assert.notEqual(document.modes.proactive, document.modes.retroactive);
  assert.notEqual(document.modes.proactive.planned, document.modes.retroactive.planned);
  assert.notEqual(document.modes.proactive.factors.overmanning, document.modes.retroactive.factors.overmanning);
  input.planned[0] = 999;
  assert.equal(document.modes.proactive.planned[0], 100);
  const totals = calculateProductivityDocument(document);
  assert.equal(totals.proactive.totalLoss, 19.8);
  assert.ok(Math.abs(totals.retroactive.totalLoss - (90 - 90 / 1.22)) < 1e-10);
});

test('inconsistent shared inputs are rejected, including hidden unselected values', () => {
  const changedHours = createProductivityDocument(1, 'shared');
  changedHours.modes.retroactive.change[0] = -10;
  assert.throws(() => hydrateProductivityDocument(changedHours), /shared inputs do not match/);
  const changedHiddenFactor = createProductivityDocument(1, 'shared');
  changedHiddenFactor.modes.retroactive.factors.owner_furnished[0] = 0.043;
  assert.throws(() => hydrateProductivityDocument(changedHiddenFactor), /shared inputs do not match/);
  assert.throws(() => serializeProductivityDocument(changedHiddenFactor), /shared inputs do not match/);
});

for (const inputMode of ['separate', 'shared']) {
  test(`${inputMode}: resizing uses the same exact duration for both methods`, () => {
    let document = createProductivityDocument(5, inputMode);
    const nextInput = structuredClone(document.modes.proactive);
    nextInput.planned = [100, 200, 300, 400, 500];
    nextInput.factors.owner_furnished[4] = 0.111;
    document = updateProductivityMode(document, 'proactive', nextInput);
    const snapshot = structuredClone(document);
    const larger = resizeProductivityDocument(document, 52);
    assert.equal(larger.totalWeeks, 52);
    for (const mode of ['proactive', 'retroactive']) {
      assert.equal(larger.modes[mode].totalWeeks, 52);
      assert.equal(larger.modes[mode].planned.length, 52);
      assert.ok(Object.values(larger.modes[mode].factors).every(values => values.length === 52));
      assert.ok(larger.modes[mode].planned.slice(5).every(value => value === 0));
    }
    const smaller = resizeProductivityDocument(larger, 2);
    assert.equal(smaller.totalWeeks, 2);
    assert.equal(smaller.modes.proactive.planned.length, 2);
    assert.equal(smaller.modes.retroactive.planned.length, 2);
    assert.deepEqual(document, snapshot);
    if (inputMode === 'shared') assert.deepEqual(smaller.modes.proactive, smaller.modes.retroactive);
    for (const count of [0, 53, 2.5, NaN]) assert.throws(() => resizeProductivityDocument(document, count));
  });
}

test('separate reset clears only the requested method and preserves exact weeks and selection', () => {
  const document = createProductivityDocument(3, 'separate');
  document.modes.proactive.planned[0] = 100;
  document.modes.retroactive.planned[0] = 200;
  document.modes.proactive.selectedFactorIds = ['owner_furnished'];
  document.modes.proactive.factors.owner_furnished[2] = 0.111;
  const reset = resetProductivityMode(document, 'proactive');
  assert.equal(reset.totalWeeks, 3);
  assert.deepEqual(reset.modes.proactive.planned, [0, 0, 0]);
  assert.deepEqual(reset.modes.proactive.selectedFactorIds, ['owner_furnished']);
  assert.equal(reset.modes.proactive.factors.owner_furnished[2], 0);
  assert.deepEqual(reset.modes.retroactive, document.modes.retroactive);
  assert.equal(document.modes.proactive.planned[0], 100);
});

test('shared reset synchronizes both methods while keeping the chosen duration', () => {
  let document = createProductivityDocument(5, 'shared');
  const input = structuredClone(document.modes.proactive);
  input.planned[4] = 900;
  document = updateProductivityMode(document, 'proactive', input);
  const reset = resetProductivityMode(document, 'retroactive');
  assert.equal(reset.totalWeeks, 5);
  assert.deepEqual(reset.modes.proactive, reset.modes.retroactive);
  assert.deepEqual(reset.modes.proactive.planned, [0, 0, 0, 0, 0]);
  assert.notEqual(reset.modes.proactive.planned, reset.modes.retroactive.planned);
  assert.equal(document.modes.proactive.planned[4], 900);
});

test('shrink warnings include both methods, changes and unselected hidden factor arrays', () => {
  const empty = createProductivityDocument(5, 'separate');
  assert.equal(hasProductivityValuesAfter(empty, 2), false);
  for (const mode of ['proactive', 'retroactive']) {
    for (const field of ['planned', 'change', 'hidden']) {
      const document = structuredClone(empty);
      if (field === 'hidden') document.modes[mode].factors.owner_furnished[4] = -0.043;
      else document.modes[mode][field][4] = -10;
      assert.equal(hasProductivityValuesAfter(document, 2), true, `${mode} ${field}`);
      assert.equal(hasProductivityValuesAfter(document, 5), false);
    }
  }
  const keptOnly = structuredClone(empty);
  keptOnly.modes.retroactive.planned[1] = 100;
  assert.equal(hasProductivityValuesAfter(keptOnly, 2), false);
});

test('serialization validates the inactive retroactive formula instead of quietly coercing an error to zero', () => {
  const document = createProductivityDocument(1, 'separate');
  document.modes.proactive.planned[0] = 100;
  document.modes.proactive.factors.overmanning[0] = 0.22;
  document.modes.retroactive.planned[0] = 100;
  document.modes.retroactive.selectedFactorIds = ['second_shift'];
  document.modes.retroactive.factors.second_shift[0] = -1;
  const snapshot = structuredClone(document);
  assert.throws(() => serializeProductivityDocument(document), /cannot equal -100%/);
  assert.deepEqual(document, snapshot);
  document.modes.retroactive.factors.second_shift[0] = -0.05;
  const output = serializeProductivityDocument(document);
  assert.equal(output.modes.retroactive.factors.second_shift[0], -0.05);
  assert.equal(typeof output.modes.proactive.factors.overmanning[0], 'number');
});

test('a copied legacy input snapshot becomes independent canonical modes in the outer server envelope', () => {
  const legacy = {
    project: { total_weeks: 2 },
    weeks: [
      { week_number: 1, planned_work_hours: '100.00', change_order_hours: '-10.00', overmanning: '0.22', stacking_of_trades: '0.28', overtime_5_10: '0.05' },
      { week_number: 2, planned_work_hours: '200.00', change_order_hours: '0.00', overmanning: '0.00', stacking_of_trades: '0.00', overtime_5_10: '0.05' },
    ],
  };
  const single = hydrateProductivityAnalysis(legacy);
  const envelope = hydrateProductivityDocument({ version: 2, inputMode: 'separate', totalWeeks: 2, modes: { proactive: single, retroactive: single } });
  assert.deepEqual(envelope.modes.proactive, envelope.modes.retroactive);
  assert.notEqual(envelope.modes.proactive, envelope.modes.retroactive);
  assert.notEqual(envelope.modes.proactive.factors.stacking_of_trades, envelope.modes.retroactive.factors.stacking_of_trades);
  const reloaded = hydrateProductivityDocument(JSON.stringify(serializeProductivityDocument(envelope)));
  assert.deepEqual(reloaded, envelope);
  assert.deepEqual(Object.keys(reloaded).sort(), ['inputMode', 'modes', 'totalWeeks', 'version']);
  const next = structuredClone(reloaded.modes.proactive);
  next.change[0] = 10;
  const changed = updateProductivityMode(reloaded, 'proactive', next);
  assert.equal(changed.modes.retroactive.change[0], -10);
  assert.equal(legacy.weeks[0].change_order_hours, '-10.00');
});

test('invalid outer versions, missing or extra modes, and mismatched week counts are rejected', () => {
  const document = createProductivityDocument(2, 'separate');
  assert.throws(() => hydrateProductivityDocument({ ...document, version: 3 }), /unsupported format/);
  assert.throws(() => hydrateProductivityDocument({ ...document, inputMode: 'other' }), /unsupported format/);
  assert.throws(() => hydrateProductivityDocument({ ...document, modes: { proactive: document.modes.proactive } }), /Both/);
  assert.throws(() => hydrateProductivityDocument({ ...document, modes: { ...document.modes, other: document.modes.proactive } }), /Both/);
  assert.throws(() => hydrateProductivityDocument({ ...document, totalWeeks: 3 }), /week counts/);
  assert.throws(() => updateProductivityMode(document, 'other', document.modes.proactive), /valid analysis/);
  assert.throws(() => updateProductivityMode(document, 'proactive', createProductivityDocument(3).modes.proactive), /duration/);
});

test('frontend documents round-trip unchanged through the independent server contract in either input mode', () => {
  for (const inputMode of ['separate', 'shared']) {
    let document = createProductivityDocument(2, inputMode);
    const proactive = structuredClone(document.modes.proactive);
    proactive.planned = [100, 200];
    proactive.change = [-10, 20];
    proactive.selectedFactorIds = ['owner_furnished', 'second_shift'];
    proactive.factors.owner_furnished = [0.043, 0.111];
    proactive.factors.second_shift = [-0.05, 0.17];
    document = updateProductivityMode(document, 'proactive', proactive);
    if (inputMode === 'separate') {
      const retroactive = structuredClone(document.modes.retroactive);
      retroactive.planned = [500, 400];
      retroactive.change = [0, -100];
      retroactive.factors.overmanning = [0.22, 0];
      document = updateProductivityMode(document, 'retroactive', retroactive);
    }
    const serialized = serializeProductivityDocument(document);
    const server = validateProductivityDocument(JSON.parse(JSON.stringify(serialized)));
    assert.deepEqual(server.document, serialized);
    const frontend = calculateProductivityDocument(serialized);
    for (const mode of ['proactive', 'retroactive']) {
      assert.equal(server.summaries[mode].totalLoss, frontend[mode].totalLoss);
      server.summaries[mode].weeks.forEach((week, index) => {
        assert.equal(week.revisedHours, frontend[mode].weeks[index].revisedHours);
        assert.equal(week.totalFactors, frontend[mode].weeks[index].totalFactor);
        assert.equal(week.loss, frontend[mode].weeks[index].loss);
      });
    }
  }
});

test('legacy conversion and malformed canonical inputs agree with the independent server boundary', () => {
  const project = { total_weeks: '1' };
  const rows = [{ week_number: 1, planned_work_hours: '100.00', change_order_hours: '-10.00', overmanning: '0.22', stacking_of_trades: '0.28', overtime_5_10: '0.05' }];
  const single = hydrateProductivityAnalysis({ project, weeks: rows });
  const frontend = hydrateProductivityDocument({ version: 2, inputMode: 'separate', totalWeeks: 1, modes: { proactive: single, retroactive: single } });
  assert.deepEqual(frontend, legacyToDocument(project, rows));
  assert.throws(() => hydrateProductivityAnalysis({ project: { total_weeks: 2 }, weeks: rows }), /missing/);
  assert.throws(() => legacyToDocument({ total_weeks: 2 }, rows), /every project week/);
  const variants = [
    value => { value.modes.retroactive.planned[0] = ''; },
    value => { value.modes.retroactive.change[0] = '0'; },
    value => { delete value.modes.retroactive.factors.owner_furnished; },
    value => { value.modes.proactive.factors.owner_furnished[0] = null; },
    value => { value.modes.proactive.extra = 0; },
    value => { value.modes.proactive.totalWeeks = '1'; },
  ];
  for (const change of variants) {
    const malformed = structuredClone(frontend);
    change(malformed);
    assert.throws(() => serializeProductivityDocument(malformed));
    assert.throws(() => validateProductivityDocument(malformed));
  }
});
