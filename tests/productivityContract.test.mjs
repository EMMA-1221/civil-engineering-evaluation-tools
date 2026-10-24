import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import { PRODUCTIVITY_FACTOR_IDS, PRODUCTIVITY_FACTORS } from '../src/productivityFactors.js';
import { createProductivityAnalysis, calculateProductivityAnalysis } from '../src/productivityModel.js';
import { createProductivityDocument, serializeProductivityDocument, updateProductivityMode } from '../src/productivityDocument.js';

const require = createRequire(import.meta.url);
const server = require('../backend-compat/productivity-v2-model.cjs');
const fixture = JSON.parse(await readFile(new URL('./fixtures/productivity-workbook.json', import.meta.url), 'utf8'));

test('frontend and backend agree on every supported factor ID and exact 52-week document', () => {
  assert.deepEqual(server.PRODUCTIVITY_FACTOR_IDS, PRODUCTIVITY_FACTOR_IDS);
  let document = createProductivityDocument(52);
  for (const mode of ['proactive', 'retroactive']) {
    const analysis = createProductivityAnalysis({ totalWeeks: 52, selectedFactorIds: PRODUCTIVITY_FACTOR_IDS });
    analysis.planned = Array.from({ length: 52 }, (_, i) => 100 + i / 100);
    analysis.change = Array.from({ length: 52 }, (_, i) => i % 2 ? -2.5 : 3.75);
    for (const factor of PRODUCTIVITY_FACTORS) analysis.factors[factor.id] = Array(52).fill(factor.minor);
    document = updateProductivityMode(document, mode, analysis);
  }
  const wire = JSON.parse(JSON.stringify(serializeProductivityDocument(document)));
  const validated = server.validateProductivityDocument(wire);
  assert.deepEqual(validated.document, wire);
  for (const mode of ['proactive', 'retroactive']) {
    const front = calculateProductivityAnalysis(wire.modes[mode], mode);
    assert.equal(validated.summaries[mode].totalLoss, front.totalLoss);
    front.weeks.forEach((week, index) => assert.equal(validated.summaries[mode].weeks[index].loss, week.loss));
  }
});

test('unselected custom values survive the API document but do not enter either total', () => {
  const document = createProductivityDocument(4);
  document.modes.proactive.planned[0] = 1000;
  document.modes.proactive.factors.owner_furnished[0] = 0.043;
  const first = server.validateProductivityDocument(serializeProductivityDocument(document));
  assert.equal(first.document.modes.proactive.factors.owner_furnished[0], 0.043);
  assert.equal(first.summaries.proactive.totalLoss, 0);
  document.modes.proactive.selectedFactorIds.push('owner_furnished');
  const second = server.validateProductivityDocument(serializeProductivityDocument(document));
  assert.equal(second.summaries.proactive.totalLoss, 43);
  assert.equal(second.summaries.retroactive.totalLoss, 0);
});

test('percentage precision and negative defaults agree across frontend/server', () => {
  const document = createProductivityDocument(1);
  for (const mode of ['proactive', 'retroactive']) {
    const analysis = document.modes[mode];
    analysis.selectedFactorIds = ['owner_furnished', 'second_shift'];
    analysis.planned[0] = 1000; analysis.change[0] = -100;
    analysis.factors.owner_furnished[0] = 0.043;
    analysis.factors.second_shift[0] = -0.05;
  }
  const serverResult = server.validateProductivityDocument(serializeProductivityDocument(document));
  for (const mode of ['proactive', 'retroactive']) {
    assert.equal(serverResult.summaries[mode].totalLoss, calculateProductivityAnalysis(document.modes[mode], mode).totalLoss);
  }
  assert.ok(Math.abs(serverResult.summaries.proactive.totalLoss - (-6.3)) < 1e-12);
});

test('both sides reject incomplete or coerced canonical data', () => {
  const incomplete = createProductivityDocument(1);
  delete incomplete.modes.proactive.factors.turnover;
  assert.throws(() => serializeProductivityDocument(incomplete));
  assert.throws(() => server.validateProductivityDocument(incomplete));
  const text = createProductivityDocument(1);
  text.modes.retroactive.planned[0] = '100';
  assert.throws(() => serializeProductivityDocument(text));
  assert.throws(() => server.validateProductivityDocument(text));
});

test('both original workbook sheets retain their cached weekly results through the complete API contract', () => {
  let document = createProductivityDocument(5);
  for (const mode of ['proactive', 'retroactive']) {
    const example = fixture.examples[mode];
    const analysis = createProductivityAnalysis({ totalWeeks: 5, selectedFactorIds: example.selectedFactorIds });
    analysis.planned = [...example.planned]; analysis.change = [...example.change];
    for (const [id, values] of Object.entries(example.factors)) analysis.factors[id] = [...values];
    document = updateProductivityMode(document, mode, analysis);
  }
  const wire = JSON.parse(JSON.stringify(serializeProductivityDocument(document)));
  const validated = server.validateProductivityDocument(wire);
  for (const mode of ['proactive', 'retroactive']) {
    const expected = fixture.examples[mode].expected;
    assert.ok(Math.abs(validated.summaries[mode].totalLoss - expected.totalLoss) < 1e-9);
    validated.summaries[mode].weeks.forEach((week, index) => {
      assert.equal(week.revisedHours, expected.revised[index]);
      assert.ok(Math.abs(week.totalFactors - expected.totalFactors[index]) < 1e-14);
      assert.ok(Math.abs(week.loss - expected.weeklyLoss[index]) < 1e-9);
    });
  }
});
