import test from 'node:test';
import assert from 'node:assert/strict';
import guard from '../backend-compat/hcg-bid-v2-validation.cjs';
import {
  createBidModel, selectAnswer, adjustAnswer, hydrateBid,
  calculateScore, serializeAnswers, getQuestionIds,
} from '../src/bidModel.js';

const createPayload = model => ({
  incomingAnswers: serializeAnswers(model),
  totalScore: calculateScore(model),
  isCreate: true,
});

test('frontend and backend agree on the full question set and default-score payloads', () => {
  const ids = getQuestionIds();
  assert.deepEqual(guard.QUESTION_IDS, ids);
  for (const answer of ['Yes', 'No']) {
    const model = ids.reduce((state, id) => selectAnswer(state, id, answer), createBidModel());
    assert.equal(guard.validateBidWrite(createPayload(model)).ok, true);
  }
});

test('frontend manual overrides survive validation, JSON persistence, and reopening', () => {
  let model = selectAnswer(createBidModel(), 'S1_Q2', 'No');
  for (let i = 0; i < 3; i++) model = adjustAnswer(model, 'S1_Q2', 1);
  const payload = createPayload(model);
  assert.equal(payload.totalScore, 1);
  assert.equal(guard.validateBidWrite(payload).ok, true);
  const reopened = hydrateBid(JSON.stringify(payload.incomingAnswers), payload.totalScore);
  assert.deepEqual(reopened.answers.S1_Q2, { answer: 'No', value: 1 });
  assert.equal(calculateScore(reopened), 1);
});

test('an old frontend cannot overwrite a saved new-model record', () => {
  const existingAnswers = JSON.stringify(serializeAnswers(createBidModel()));
  for (const incomingAnswers of [
    { S1_Q1: { answer: 'Yes', value: 4 } },
    { __hcg_bid: { answer: null, value: 0 } },
    { __hcg_bid: { version: 1 } },
  ]) {
    const result = guard.validateBidWrite({ existingAnswers, incomingAnswers, totalScore: 4 });
    assert.equal(result.status, 409);
    assert.equal(result.code, 'BID_VERSION_CONFLICT');
  }
});

test('the API rejects inconsistent scores, unanswered nonzero values, and incomplete questionnaires', () => {
  const payload = createPayload(createBidModel());
  assert.equal(guard.validateBidWrite({ ...payload, totalScore: 1 }).code, 'BID_TOTAL_MISMATCH');
  const nonzero = structuredClone(payload);
  nonzero.incomingAnswers.S1_Q1.value = 1;
  assert.equal(guard.validateBidWrite(nonzero).code, 'BID_UNANSWERED_VALUE');
  const missing = structuredClone(payload);
  delete missing.incomingAnswers.S9_Q7;
  assert.equal(guard.validateBidWrite(missing).code, 'BID_INVALID_ANSWERS');
});

test('earlier evaluations retain their saved score and cannot be silently upgraded', () => {
  const raw = { S1_Q1: { answer: 'Yes', value: 4 }, S1_Q5: { answer: 'N/A', value: 0 } };
  const model = hydrateBid(raw, 43);
  const wire = serializeAnswers(model);
  assert.equal(guard.validateBidWrite({ incomingAnswers: wire, existingAnswers: raw, totalScore: 43 }).ok, true);
  assert.equal(calculateScore(hydrateBid(wire, 43)), 43);
  assert.equal(guard.validateBidWrite({
    ...createPayload(createBidModel()), existingAnswers: raw, isCreate: false,
  }).status, 409);
});
