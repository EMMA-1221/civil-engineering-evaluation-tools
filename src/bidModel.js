import { bidQuestions } from './bidQuestions.js';

export const LEGACY_VERSION = 1;
export const CURRENT_VERSION = 2;
export const BID_METADATA_KEY = '__hcg_bid';

const questions = Object.values(bidQuestions).flatMap(section => section.questions);
const questionById = new Map(questions.map(question => [question.id, question]));
const currentIds = questions.map(question => question.id);
const legacyIds = [
  'S1_Q1', 'S1_Q2', 'S1_Q3', 'S1_Q4', 'S1_Q5', 'S1_Q6',
  'S2_Q1', 'S2_Q2', 'S2_Q3', 'S2_Q4', 'S2_Q5', 'S2_Q6',
  'S7_Q1', 'S7_Q2', 'S7_Q3', 'S7_Q4',
];
const isRecord = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const hasOwn = (object, key) => Object.prototype.hasOwnProperty.call(object, key);

function assertVersion(version) {
  if (version !== LEGACY_VERSION && version !== CURRENT_VERSION) {
    throw new Error('This evaluation uses an unsupported scoring version. It cannot be edited or saved.');
  }
}

function asNumber(value, label) {
  const decimal = typeof value === 'string' && /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(value.trim());
  if ((typeof value !== 'number' && !decimal)
    || !Number.isFinite(Number(value)) || !Number.isInteger(Number(value))) {
    throw new Error(`${label} is not a valid integer. The evaluation cannot be saved.`);
  }
  return Number(value);
}

export function getQuestionIds(version = CURRENT_VERSION) {
  assertVersion(version);
  return [...(version === LEGACY_VERSION ? legacyIds : currentIds)];
}

export function isLegacy(model) {
  assertVersion(model.version);
  return model.version === LEGACY_VERSION;
}

export function isQuestionEditable(model, questionId) {
  return getQuestionIds(model.version).includes(questionId);
}

export function createAnswers(version = CURRENT_VERSION) {
  return Object.fromEntries(getQuestionIds(version).map(id => [id, { answer: null, value: 0 }]));
}

export function createBidModel() {
  return { version: CURRENT_VERSION, answers: createAnswers(), savedTotal: 0, dirty: false, metadata: {} };
}

export function hydrateBid(rawAnswers, savedTotal) {
  let parsed = rawAnswers;
  if (typeof parsed === 'string') {
    try {
      parsed = JSON.parse(parsed);
    } catch {
      throw new Error('The saved answers are not valid JSON. This evaluation cannot be edited or saved.');
    }
  }
  if (!isRecord(parsed)) {
    throw new Error('The saved answers are invalid. This evaluation cannot be edited or saved.');
  }

  let version = LEGACY_VERSION;
  let metadata = {};
  if (hasOwn(parsed, BID_METADATA_KEY)) {
    if (!isRecord(parsed[BID_METADATA_KEY])) {
      throw new Error('The saved scoring version is invalid. This evaluation cannot be edited or saved.');
    }
    metadata = { ...parsed[BID_METADATA_KEY] };
    version = metadata.version;
  }
  assertVersion(version);
  if (version === CURRENT_VERSION && Object.keys(parsed)
    .some(key => /^S\d+_Q\d+$/.test(key) && !questionById.has(key))) {
    throw new Error('The saved evaluation contains an unsupported question. It cannot be edited or saved.');
  }

  // Keep unknown data and explicit legacy N/A answers, without extending a
  // legacy evaluation to questions that were not present in its scoring model.
  const answers = Object.fromEntries(Object.entries(parsed)
    .filter(([key]) => key !== BID_METADATA_KEY)
    .map(([key, value]) => [key, isRecord(value) ? { ...value } : value]));
  for (const id of getQuestionIds(version)) {
    if (version === CURRENT_VERSION) {
      const entry = answers[id];
      if (!isRecord(entry) || ![null, 'Yes', 'No'].includes(entry.answer)
        || typeof entry.value !== 'number' || !Number.isFinite(entry.value) || !Number.isInteger(entry.value)
        || (entry.answer === null && entry.value !== 0)) {
        throw new Error('The saved evaluation contains incomplete or invalid scoring data. It cannot be edited or saved.');
      }
    }
    if (!hasOwn(answers, id)) answers[id] = { answer: null, value: 0 };
    const entry = answers[id];
    if (entry !== null && !isRecord(entry)) {
      throw new Error('A saved answer is invalid. This evaluation cannot be edited or saved.');
    }
    if (entry) {
      if (!hasOwn(entry, 'value')) entry.value = 0;
      asNumber(entry.value, 'An assigned value');
    }
  }
  const model = { version, answers, savedTotal: asNumber(savedTotal, 'The saved total'), dirty: false, metadata };
  if (version === CURRENT_VERSION && calculateScore(model) !== model.savedTotal) {
    throw new Error('The saved total does not match the saved answers. This evaluation cannot be edited or saved.');
  }
  return model;
}

function updateAnswer(model, questionId, nextEntry) {
  if (!isQuestionEditable(model, questionId)) return model;
  const previous = model.answers[questionId] || { answer: null, value: 0 };
  if (previous.answer === nextEntry.answer && Object.is(previous.value, nextEntry.value)) return model;
  return { ...model, answers: { ...model.answers, [questionId]: nextEntry }, dirty: true };
}

export function selectAnswer(model, questionId, answer) {
  if (answer !== 'Yes' && answer !== 'No') throw new Error('Choose Yes or No.');
  if (!isQuestionEditable(model, questionId)) return model;
  const previous = model.answers[questionId] || { answer: null, value: 0 };
  if (previous.answer === answer) return updateAnswer(model, questionId, { ...previous, answer: null, value: 0 });
  const value = isLegacy(model)
    ? (previous.value ?? 0)
    : questionById.get(questionId).defaultWeight * (answer === 'Yes' ? 1 : -1);
  return updateAnswer(model, questionId, { ...previous, answer, value });
}

export function adjustAnswer(model, questionId, delta) {
  if (delta !== 1 && delta !== -1) throw new Error('Assigned values can be adjusted by one point at a time.');
  if (!isQuestionEditable(model, questionId)) return model;
  const previous = model.answers[questionId];
  if (previous?.answer !== 'Yes' && previous?.answer !== 'No') return model;
  return updateAnswer(model, questionId, { ...previous, value: asNumber(previous.value, 'The assigned value') + delta });
}

export function restoreDefault(model, questionId) {
  if (!isQuestionEditable(model, questionId)) return model;
  const previous = model.answers[questionId] || { answer: null, value: 0 };
  if (isLegacy(model)) return updateAnswer(model, questionId, { ...previous, answer: null, value: 0 });
  const value = previous.answer === 'Yes' ? questionById.get(questionId).defaultWeight
    : previous.answer === 'No' ? -questionById.get(questionId).defaultWeight : 0;
  return updateAnswer(model, questionId, { ...previous, value });
}

export function resetAnswers(model) {
  assertVersion(model.version);
  return { ...model, answers: { ...model.answers, ...createAnswers(model.version) }, dirty: true };
}

export function calculateScore(model) {
  assertVersion(model.version);
  if (isLegacy(model) && !model.dirty) return asNumber(model.savedTotal, 'The saved total');
  return getQuestionIds(model.version).reduce((total, id) => {
    const entry = model.answers[id];
    const included = entry?.answer === 'Yes' || (!isLegacy(model) && entry?.answer === 'No');
    return included ? total + asNumber(entry.value, 'An assigned value') : total;
  }, 0);
}

export function serializeAnswers(model) {
  assertVersion(model.version);
  const answers = Object.fromEntries(Object.entries(model.answers)
    .filter(([key]) => key !== BID_METADATA_KEY)
    .map(([key, value]) => [key, isRecord(value) ? { ...value } : value]));
  return { ...answers, [BID_METADATA_KEY]: { ...model.metadata, version: model.version } };
}
