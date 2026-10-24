'use strict';

// Question IDs transcribed from the verified original Tool1V1.1 workbook.
// This helper validates writes only; it never changes answers or recalculates legacy data.
const QUESTION_IDS = Object.freeze([
  'S1_Q1', 'S1_Q2', 'S1_Q3', 'S1_Q4', 'S1_Q5', 'S1_Q6',
  'S2_Q1', 'S2_Q2', 'S2_Q3', 'S2_Q4', 'S2_Q5', 'S2_Q6',
  'S3_Q1', 'S3_Q2', 'S3_Q3', 'S3_Q4', 'S3_Q5',
  'S4_Q1', 'S4_Q2', 'S4_Q3',
  'S5_Q1', 'S5_Q2', 'S5_Q3', 'S5_Q4', 'S5_Q5', 'S5_Q6', 'S5_Q7',
  'S5_Q8', 'S5_Q9', 'S5_Q10', 'S5_Q11', 'S5_Q12', 'S5_Q13', 'S5_Q14',
  'S6_Q1', 'S6_Q2', 'S6_Q3', 'S6_Q4', 'S6_Q5', 'S6_Q6', 'S6_Q7',
  'S6_Q8', 'S6_Q9', 'S6_Q10',
  'S7_Q1', 'S7_Q2', 'S7_Q3', 'S7_Q4',
  'S8_Q1', 'S8_Q2', 'S8_Q3', 'S8_Q4', 'S8_Q5', 'S8_Q6', 'S8_Q7',
  'S9_Q1', 'S9_Q2', 'S9_Q3', 'S9_Q4', 'S9_Q5', 'S9_Q6', 'S9_Q7',
]);
const idSet = new Set(QUESTION_IDS);
const META_KEY = '__hcg_bid';
const own = (object, key) => Object.prototype.hasOwnProperty.call(object, key);
const record = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const fail = (status, code, msg) => ({ ok: false, status, code, msg });

function versionOf(raw, stored = false) {
  let answers = raw;
  if (stored && typeof answers === 'string') {
    try { answers = JSON.parse(answers); } catch { return { valid: false }; }
  }
  if (!record(answers)) return { valid: false };
  if (!own(answers, META_KEY)) return { valid: true, version: 1, answers };
  const meta = answers[META_KEY];
  if (!record(meta) || !own(meta, 'version') || ![1, 2].includes(meta.version)) {
    return { valid: false };
  }
  return { valid: true, version: meta.version, answers };
}

function validateV2(answers, totalScore) {
  if (Object.keys(answers).some(key => /^S\d+_Q\d+$/.test(key) && !idSet.has(key))) {
    return fail(400, 'BID_UNKNOWN_QUESTION', 'This evaluation contains an unsupported question.');
  }
  let sum = 0n;
  for (const id of QUESTION_IDS) {
    const entry = answers[id];
    if (!own(answers, id) || !record(entry)
      || !own(entry, 'answer') || ![null, 'Yes', 'No'].includes(entry.answer)
      || !own(entry, 'value') || typeof entry.value !== 'number'
      || !Number.isFinite(entry.value) || !Number.isInteger(entry.value)) {
      return fail(400, 'BID_INVALID_ANSWERS', 'Version 2 requires all 62 questions with valid answers and integer values.');
    }
    if (entry.answer === null && entry.value !== 0) {
      return fail(400, 'BID_UNANSWERED_VALUE', 'An unanswered question must have a value of zero.');
    }
    // BigInt sums the actual integer values exactly, including negative values
    // and manually adjusted No answers. No sign or original-weight constraint.
    sum += BigInt(entry.value);
  }
  if (typeof totalScore !== 'number' || !Number.isInteger(totalScore)
    || totalScore < -2147483648 || totalScore > 2147483647) {
    return fail(400, 'BID_INVALID_TOTAL', 'The total score must be an integer within the database score range.');
  }
  if (sum !== BigInt(totalScore)) {
    return fail(400, 'BID_TOTAL_MISMATCH', 'The total score does not match the sum of all assigned values.');
  }
  return { ok: true, version: 2 };
}

function validateBidWrite({ incomingAnswers, totalScore, existingAnswers, isCreate = false }) {
  // Only invoke for PUT after authentication, row existence and ownership checks.
  const incoming = versionOf(incomingAnswers);
  if (!isCreate) {
    const existing = versionOf(existingAnswers, true);
    if (!existing.valid) {
      return fail(409, 'BID_STORED_VERSION_INVALID', 'The saved scoring version cannot be verified. Reload or contact the administrator.');
    }
    if (existing.version === 2 && (!incoming.valid || incoming.version !== 2)) {
      return fail(409, 'BID_VERSION_CONFLICT', 'This evaluation uses scoring version 2. Reload this page before saving.');
    }
    if (existing.version === 1 && incoming.valid && incoming.version === 2) {
      return fail(409, 'BID_VERSION_CONFLICT', 'Create a new evaluation to use scoring version 2. Existing evaluations keep their scoring version.');
    }
  }
  if (!incoming.valid) {
    return fail(400, 'BID_VERSION_INVALID', 'The answers or scoring version are invalid or unsupported.');
  }
  // Legacy payloads, scores, extra metadata and historical signed values pass through.
  return incoming.version === 2
    ? validateV2(incoming.answers, totalScore)
    : { ok: true, version: 1 };
}

module.exports = { QUESTION_IDS, META_KEY, versionOf, validateBidWrite };
