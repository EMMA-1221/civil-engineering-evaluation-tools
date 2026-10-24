import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { bidQuestions } from '../src/bidQuestions.js';
import {
  LEGACY_VERSION, CURRENT_VERSION, createBidModel, hydrateBid, selectAnswer,
  adjustAnswer, restoreDefault, resetAnswers, calculateScore, serializeAnswers,
  getQuestionIds,
} from '../src/bidModel.js';

function freeze(value) {
  if (value && typeof value === 'object') {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
}

// Generated separately from the original XLSM's cells, expanded shared
// formulas and generic example. No product model was used to produce it.
const workbook = freeze(JSON.parse(readFileSync(new URL('./fixtures/bid-workbook.json', import.meta.url), 'utf8')));
const questions = workbook.sections.flatMap(section => section.questions);
const expectedCase = (question, answer) => question.cases.find(item => item.answer === answer);
const exampleAnswers = Object.fromEntries(questions.map(question => [question.id, {
  // The product intentionally uses two buttons; the source's N/A example
  // has a zero score, equivalent to an unanswered v2 contribution.
  answer: question.savedExample.answer === 'N/A' ? null : question.savedExample.answer,
  value: question.savedExample.score ?? 0,
}]));
const exampleV2 = () => hydrateBid({ ...serializeAnswers(createBidModel()), ...exampleAnswers }, workbook.golden.savedExampleTotal);

test('all 62 product question texts, section titles and C-column weights match the frozen workbook fixture', () => {
  assert.equal(workbook.source.sha256, 'c8f2d63ddad89089d609e30b0538a255b844024aa3db2d5ad9d5944f2417fc90');
  assert.equal(questions.length, 62);
  assert.deepEqual(Object.keys(bidQuestions), workbook.sections.map(section => section.id));
  for (const section of workbook.sections) {
    assert.equal(bidQuestions[section.id].title, section.title, section.titleCell);
    assert.equal(bidQuestions[section.id].questions.length, section.questions.length, section.id);
    for (const [index, expected] of section.questions.entries()) {
      const actual = bidQuestions[section.id].questions[index];
      assert.equal(actual.id, expected.id);
      assert.equal(actual.text, expected.text, expected.cells.text);
      assert.equal(actual.defaultWeight, expected.defaultWeight, expected.cells.weight);
      assert.equal(actual.sourceCell, expected.cells.weight.split('!')[1]);
    }
  }
});

test('every question matches independently evaluated Excel Yes, No and blank contributions', () => {
  for (const question of questions) {
    const blank = createBidModel();
    assert.equal(calculateScore(blank), expectedCase(question, null).totalContribution, question.cells.score);
    for (const answer of ['Yes', 'No']) {
      const selected = selectAnswer(blank, question.id, answer);
      assert.equal(selected.answers[question.id].value, expectedCase(question, answer).cellResult,
        `${question.cells.score}: ${answer}`);
      assert.equal(calculateScore(selected), expectedCase(question, answer).totalContribution);
      const cancelled = selectAnswer(selected, question.id, answer);
      assert.deepEqual(cancelled.answers[question.id], { answer: null, value: 0 });
      assert.equal(calculateScore(cancelled), expectedCase(question, null).totalContribution);
    }
  }
});

test('all 62 source N/A formula cases contribute zero; legacy N/A is retained and v2 has no N/A button action', () => {
  for (const question of questions) {
    assert.equal(expectedCase(question, 'N/A').cellResult, 0, question.normalFormula);
    const legacy = hydrateBid({ [question.id]: { answer: 'N/A', value: 0 } }, 0);
    assert.deepEqual(serializeAnswers(legacy)[question.id], { answer: 'N/A', value: 0 });
    assert.equal(calculateScore(legacy), 0);
    assert.throws(() => selectAnswer(createBidModel(), question.id, 'N/A'), /Choose Yes or No/);
  }
});

test('each source default supports signed +/-1 overrides and Default restoration without mutating the earlier state', () => {
  for (const question of questions) {
    for (const answer of ['Yes', 'No']) {
      const expected = expectedCase(question, answer).cellResult;
      const initial = freeze(selectAnswer(createBidModel(), question.id, answer));
      const increased = adjustAnswer(initial, question.id, 1);
      const decreased = adjustAnswer(initial, question.id, -1);
      assert.equal(calculateScore(increased), expected + 1, `${question.id}: increase`);
      assert.equal(calculateScore(decreased), expected - 1, `${question.id}: decrease`);
      assert.equal(initial.answers[question.id].value, expected);
      for (const changed of [increased, decreased]) {
        const restored = restoreDefault(changed, question.id);
        assert.equal(restored.answers[question.id].answer, answer);
        assert.equal(calculateScore(restored), expected, `${question.id}: Default`);
      }
    }
    const blank = createBidModel();
    assert.equal(adjustAnswer(blank, question.id, 1), blank);
    assert.equal(adjustAnswer(blank, question.id, -1), blank);
  }
});

test('the source saved manual example reproduces F3=43 with both positive and negative contributions', () => {
  assert.equal(workbook.golden.savedExampleTotal, 43);
  assert.equal(workbook.golden.savedExampleCachedTotal, 43);
  const model = exampleV2();
  assert.equal(model.version, CURRENT_VERSION);
  assert.equal(calculateScore(model), workbook.golden.savedExampleTotal);
  assert.equal(model.answers.S7_Q1.value, 26);
  const loadedAgain = hydrateBid(JSON.stringify(serializeAnswers(model)), workbook.golden.savedExampleTotal);
  assert.equal(calculateScore(loadedAgain), workbook.golden.savedExampleTotal);
});

test('restoring every saved example score to its C default produces the independent workbook total 10', () => {
  assert.equal(workbook.golden.defaultTotalForSavedAnswers, 10);
  const defaults = questions.reduce((model, question) => restoreDefault(model, question.id), exampleV2());
  assert.equal(calculateScore(defaults), workbook.golden.defaultTotalForSavedAnswers);
  for (const question of questions) {
    const source = expectedCase(question, question.savedExample.answer);
    assert.equal(defaults.answers[question.id].value, source.totalContribution, question.cells.weight);
  }
});

test('source F3 all-default totals are +/-149 and manual overrides are not capped at that number', () => {
  const yes = questions.reduce((model, question) => selectAnswer(model, question.id, 'Yes'), createBidModel());
  const no = questions.reduce((model, question) => selectAnswer(model, question.id, 'No'), createBidModel());
  assert.equal(calculateScore(yes), workbook.golden.allYesDefaultTotal);
  assert.equal(calculateScore(no), workbook.golden.allNoDefaultTotal);
  assert.equal(calculateScore(adjustAnswer(yes, questions[0].id, 1)), 150);
  assert.equal(calculateScore(adjustAnswer(no, questions[0].id, -1)), -150);
  const crossed = adjustAnswer(adjustAnswer(selectAnswer(createBidModel(), 'S1_Q1', 'No'), 'S1_Q1', 1), 'S1_Q1', 1);
  assert.equal(crossed.answers.S1_Q1.answer, 'No');
  assert.equal(calculateScore(crossed), 1);
});

test('Reset clears all source question blocks and selection after a manual override returns to the C default', () => {
  const reset = resetAnswers(exampleV2());
  assert.equal(calculateScore(reset), 0);
  assert.ok(questions.every(question => reset.answers[question.id].answer === null && reset.answers[question.id].value === 0));
  for (const question of questions) {
    const manual = adjustAnswer(selectAnswer(createBidModel(), question.id, 'Yes'), question.id, 1);
    const switched = selectAnswer(manual, question.id, 'No');
    assert.equal(switched.answers[question.id].value, expectedCase(question, 'No').cellResult);
  }
});

test('legacy scope matches the 16 unhidden source questions and preserves 43 instead of silently changing it to 52', () => {
  const visible = questions.filter(question => !question.hiddenInSavedView);
  assert.equal(visible.length, 16);
  assert.deepEqual(getQuestionIds(LEGACY_VERSION), visible.map(question => question.id));
  const legacyAnswers = Object.fromEntries(visible.map(question => [question.id, {
    answer: question.savedExample.answer, value: question.savedExample.score ?? 0,
  }]));
  const legacy = hydrateBid(legacyAnswers, workbook.golden.savedExampleTotal);
  assert.equal(legacy.version, LEGACY_VERSION);
  assert.equal(calculateScore(legacy), 43);
  assert.equal(calculateScore(hydrateBid(serializeAnswers(legacy), 43)), 43);
  const yesOnlyExample = visible.filter(question => question.savedExample.answer === 'Yes')
    .reduce((sum, question) => sum + question.savedExample.score, 0);
  assert.equal(yesOnlyExample, 52);
  assert.equal(calculateScore({ ...legacy, dirty: true }), yesOnlyExample);
  assert.deepEqual(serializeAnswers(legacy).S1_Q5, { answer: 'N/A', value: 0 });
});

test('source validation and shared-formula provenance remain explicit rather than treating hidden rows as absent', () => {
  assert.equal(questions.filter(question => question.hiddenInSavedView).length, 46);
  assert.equal(questions.filter(question => question.storedFormula).length, 55);
  assert.ok(workbook.sections[0].questions.every(question => question.answerValidation.includes('N/A')));
  assert.ok(workbook.sections.slice(1).every(section => section.questions.every(question => !question.answerValidation.includes('N/A'))));
  const adjusted = questions.find(question => question.id === 'S7_Q1');
  assert.equal(adjusted.storedFormula, null);
  assert.equal(adjusted.savedExample.score, 26);
  assert.equal(adjusted.defaultWeight, 5);
  assert.equal(workbook.formulaProvenance.totalCell, 'Factors!F3');
});
