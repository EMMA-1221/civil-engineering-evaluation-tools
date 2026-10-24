import test from 'node:test';
import assert from 'node:assert/strict';
import { bidQuestions } from '../src/bidQuestions.js';
import {
  LEGACY_VERSION, CURRENT_VERSION, BID_METADATA_KEY, createAnswers, createBidModel,
  hydrateBid, selectAnswer, adjustAnswer, restoreDefault, resetAnswers,
  calculateScore, serializeAnswers, getQuestionIds, isQuestionEditable,
} from '../src/bidModel.js';

function deepFreeze(value) {
  if (value && typeof value === 'object') {
    Object.values(value).forEach(deepFreeze);
    Object.freeze(value);
  }
  return value;
}

test('original workbook coverage is 62 questions, with all-Yes +149 and all-No -149', () => {
  assert.deepEqual(Object.values(bidQuestions).map(section => section.questions.length), [6, 6, 5, 3, 14, 10, 4, 7, 7]);
  const ids = getQuestionIds(CURRENT_VERSION);
  assert.equal(new Set(ids).size, 62);
  const yes = ids.reduce((model, id) => selectAnswer(model, id, 'Yes'), createBidModel());
  const no = ids.reduce((model, id) => selectAnswer(model, id, 'No'), createBidModel());
  assert.equal(calculateScore(yes), 149);
  assert.equal(calculateScore(no), -149);
  assert.equal(bidQuestions.section7.questions[0].defaultWeight, 5);
  assert.equal(bidQuestions.section7.questions[0].sourceCell, 'C64');
});

test('No uses the negative default; selecting the same answer clears it to blank zero', () => {
  const no = selectAnswer(createBidModel(), 'S1_Q2', 'No');
  assert.deepEqual(no.answers.S1_Q2, { answer: 'No', value: -2 });
  assert.equal(calculateScore(no), -2);
  const blank = selectAnswer(no, 'S1_Q2', 'No');
  assert.deepEqual(blank.answers.S1_Q2, { answer: null, value: 0 });
  assert.equal(calculateScore(blank), 0);
  assert.equal(adjustAnswer(blank, 'S1_Q2', 1), blank);
  const yes = selectAnswer(no, 'S1_Q2', 'Yes');
  assert.deepEqual(yes.answers.S1_Q2, { answer: 'Yes', value: 2 });
});

test('manual adjustments may cross zero without changing the selected answer; Default restores its signed base', () => {
  let model = selectAnswer(createBidModel(), 'S1_Q2', 'No');
  model = adjustAnswer(adjustAnswer(adjustAnswer(model, 'S1_Q2', 1), 'S1_Q2', 1), 'S1_Q2', 1);
  assert.deepEqual(model.answers.S1_Q2, { answer: 'No', value: 1 });
  assert.equal(calculateScore(model), 1);
  const restored = restoreDefault(model, 'S1_Q2');
  assert.deepEqual(restored.answers.S1_Q2, { answer: 'No', value: -2 });
  assert.equal(calculateScore(restored), -2);
  const reset = resetAnswers(restored);
  assert.equal(calculateScore(reset), 0);
  assert.ok(Object.values(reset.answers).every(entry => entry.answer === null && entry.value === 0));
});

test('unselected answers are zero and cannot be adjusted; transitions do not mutate earlier states', () => {
  const original = deepFreeze(createBidModel());
  assert.equal(calculateScore(original), 0);
  assert.equal(adjustAnswer(original, 'S1_Q1', -1), original);
  const selected = deepFreeze(selectAnswer(original, 'S1_Q1', 'Yes'));
  const changed = adjustAnswer(selected, 'S1_Q1', -1);
  assert.deepEqual(original.answers.S1_Q1, { answer: null, value: 0 });
  assert.deepEqual(selected.answers.S1_Q1, { answer: 'Yes', value: 1 });
  assert.deepEqual(changed.answers.S1_Q1, { answer: 'Yes', value: 0 });
  assert.notEqual(changed.answers, selected.answers);
});

test('legacy preserves the saved score, manual values, N/A and unknown keys across a versioned round trip', () => {
  const raw = deepFreeze({
    S1_Q1: { answer: 'Yes', value: 4 },
    S1_Q2: { answer: 'No', value: -2 },
    S1_Q5: { answer: 'N/A', value: 0 },
    S7_Q1: { answer: 'Yes', value: 26 },
    externalNote: { detail: 'retain this unknown data' },
  });
  const model = deepFreeze(hydrateBid(JSON.stringify(raw), 43));
  assert.equal(model.version, LEGACY_VERSION);
  assert.equal(getQuestionIds(model.version).length, 16);
  assert.equal(isQuestionEditable(model, 'S3_Q1'), false);
  assert.equal('S3_Q1' in model.answers, false);
  assert.equal(selectAnswer(model, 'S3_Q1', 'Yes'), model);
  assert.equal(calculateScore(model), 43);
  assert.deepEqual(model.answers.S7_Q1, { answer: 'Yes', value: 26 });
  const wire = serializeAnswers(model);
  assert.deepEqual(wire[BID_METADATA_KEY], { version: LEGACY_VERSION });
  const roundTrip = hydrateBid(wire, calculateScore(model));
  assert.equal(calculateScore(roundTrip), 43);
  assert.deepEqual(roundTrip.answers.S1_Q5, raw.S1_Q5);
  assert.deepEqual(roundTrip.answers.externalNote, raw.externalNote);
  assert.equal(calculateScore(hydrateBid(raw, 0)), 0);
  const changed = selectAnswer(model, 'S1_Q2', 'Yes');
  assert.deepEqual(changed.answers.S1_Q2, { answer: 'Yes', value: -2 });
  assert.equal(calculateScore(changed), 28);
  const resetOne = restoreDefault(model, 'S7_Q1');
  assert.deepEqual(resetOne.answers.S7_Q1, { answer: null, value: 0 });
});

test('the unchanged workbook sample is 43, while applying the legacy Yes-only rule to its explicit values is 52', () => {
  const values = [4, -2, 3, -1, 0, 3, 8, -2, 1, -4, 6, 1, 26, 0, 0, 0];
  const answers = ['Yes', 'No', 'Yes', 'No', 'N/A', 'Yes', 'Yes', 'No', 'Yes', 'No', 'Yes', 'Yes', 'Yes', null, null, null];
  const raw = Object.fromEntries(getQuestionIds(LEGACY_VERSION).map((id, i) => [id, { answer: answers[i], value: values[i] }]));
  assert.equal(values.reduce((total, value) => total + value, 0), 43);
  assert.equal(calculateScore(hydrateBid(raw, 43)), 43);
  // Marking it edited evaluates the existing legacy rule, without silently
  // replacing its persisted score on initial load.
  assert.equal(calculateScore({ ...hydrateBid(raw, 43), dirty: true }), 52);
});

test('v2 saves an object and round-trips manual overrides and unknown metadata', () => {
  let model = selectAnswer(createBidModel(), 'S3_Q1', 'No');
  model = adjustAnswer(model, 'S3_Q1', 1);
  model.metadata = { source: 'original workbook' };
  model.answers.extra = { note: 'keep' };
  const wire = serializeAnswers(model);
  assert.equal(typeof wire, 'object');
  assert.equal(wire[BID_METADATA_KEY].version, CURRENT_VERSION);
  const hydrated = hydrateBid(JSON.stringify(wire), calculateScore(model));
  assert.equal(hydrated.version, CURRENT_VERSION);
  assert.equal(calculateScore(hydrated), -3);
  assert.deepEqual(hydrated.answers.S3_Q1, { answer: 'No', value: -3 });
  assert.deepEqual(hydrated.answers.extra, { note: 'keep' });
  assert.equal(hydrated.metadata.source, 'original workbook');
});

test('malformed JSON and unknown or malformed version metadata fail closed', () => {
  assert.throws(() => hydrateBid('{bad', 0), /not valid JSON/);
  for (const metadata of [null, [], {}, { version: 3 }, { version: '2' }]) {
    assert.throws(() => hydrateBid({ [BID_METADATA_KEY]: metadata }, 0), /version/);
  }
  assert.throws(() => serializeAnswers({ version: 3, answers: {} }), /unsupported/);
  assert.throws(() => calculateScore({ version: 3, answers: {} }), /unsupported/);
  assert.throws(() => createAnswers(3), /unsupported/);
});

test('v2 incomplete or invalid scoring data fails closed instead of silently clearing saved work', () => {
  const valid = serializeAnswers(createBidModel());
  const missing = { ...valid };
  delete missing.S1_Q1;
  assert.throws(() => hydrateBid(missing, 0), /incomplete or invalid/);
  for (const entry of [
    { answer: null, value: 3 },
    { answer: 'N/A', value: 0 },
    { answer: 'Yes', value: '1' },
    { answer: 'No', value: -0.5 },
    { answer: 'No', value: Infinity },
  ]) {
    assert.throws(() => hydrateBid({ ...valid, S1_Q1: entry }, 0), /incomplete or invalid/);
  }
  assert.throws(() => hydrateBid({ ...valid, S99_Q1: { answer: 'Yes', value: 1 } }, 0), /unsupported question/);
});

test('legacy integer strings are preserved and counted numerically; invalid numbers do not silently become zero', () => {
  const raw = { S1_Q1: { answer: 'Yes', value: '4' }, S1_Q2: { answer: 'No', value: '-2' } };
  const model = hydrateBid(raw, '43.00');
  assert.equal(calculateScore(model), 43);
  assert.equal(model.answers.S1_Q1.value, '4');
  assert.equal(calculateScore(adjustAnswer(model, 'S1_Q1', 1)), 5);
  assert.equal(serializeAnswers(model).S1_Q2.value, '-2');
  for (const invalid of [true, false, '', ' ', null, NaN, Infinity, 'bad', '0x10', 0.5]) {
    assert.throws(() => hydrateBid(raw, invalid), /valid integer/);
    assert.throws(() => hydrateBid({ S1_Q1: { answer: 'Yes', value: invalid } }, 0), /valid integer/);
  }
});

test('v2 rejects a mismatched saved total instead of silently displaying a recalculated value', () => {
  const no = selectAnswer(createBidModel(), 'S1_Q2', 'No');
  const wire = serializeAnswers(no);
  assert.throws(() => hydrateBid(wire, 0), /saved total does not match/);
  assert.equal(calculateScore(hydrateBid(wire, '-2.00')), -2);
  const manuallyPositiveNo = adjustAnswer(adjustAnswer(adjustAnswer(no, 'S1_Q2', 1), 'S1_Q2', 1), 'S1_Q2', 1);
  assert.equal(calculateScore(hydrateBid(serializeAnswers(manuallyPositiveNo), 1)), 1);
  assert.throws(() => hydrateBid(serializeAnswers(manuallyPositiveNo), -1), /saved total does not match/);
  const legacy = { S1_Q2: { answer: 'No', value: -2 } };
  assert.equal(calculateScore(hydrateBid(legacy, 43)), 43);
});
