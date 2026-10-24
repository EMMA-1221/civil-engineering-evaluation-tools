'use strict';

const { isDeepStrictEqual } = require('node:util');

// IDs transcribed from ProductivityV1.6.xlsm, Factors!B:D. Keep this server
// allowlist independent of the browser bundle and its calculation code.
const PRODUCTIVITY_FACTOR_IDS = Object.freeze([
  'overmanning', 'overtime_5_10', 'overtime_6_10', 'second_shift',
  'stacking_of_trades', 'out_of_sequence', 'weather', 'owner_furnished',
  'access_constraints', 'beneficial_occupancy', 'loss_of_learning',
  'change_order_processing', 'absenteeism', 'turnover',
  'dilution_of_supervision', 'design_complete', 'ae_coordination',
  'ae_support', 'manpower_shortage',
]);
const DEFAULT_FACTOR_IDS = Object.freeze(['overmanning', 'stacking_of_trades', 'overtime_5_10']);
const factorIds = new Set(PRODUCTIVITY_FACTOR_IDS);
const own = (object, key) => Object.prototype.hasOwnProperty.call(object, key);

class ProductivityValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ProductivityValidationError';
    this.status = 400;
    this.code = 'INVALID_PRODUCTIVITY_DOCUMENT';
  }
}

function fail(message) {
  throw new ProductivityValidationError(message);
}

function record(value, label) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)
    || ![Object.prototype, null].includes(Object.getPrototypeOf(value))) {
    fail(`${label} must be an object.`);
  }
}

function exactKeys(value, keys, label) {
  record(value, label);
  if (Reflect.ownKeys(value).length !== keys.length || keys.some(key => !own(value, key))) {
    fail(`${label} must contain exactly: ${keys.join(', ')}.`);
  }
}

function finite(value, label) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    fail(`${label} must be a finite number.`);
  }
  return value;
}

function weekCount(value, label) {
  if (!Number.isInteger(value) || value < 1 || value > 52) {
    fail(`${label} must be an integer from 1 to 52.`);
  }
  return value;
}

function numericArray(value, totalWeeks, label) {
  if (!Array.isArray(value) || value.length !== totalWeeks) {
    fail(`${label} must contain exactly ${totalWeeks} weekly numbers.`);
  }
  return Array.from({ length: totalWeeks }, (_, index) => finite(value[index], `${label}[${index}]`));
}

function validateMode(raw, totalWeeks, label) {
  exactKeys(raw, ['version', 'totalWeeks', 'selectedFactorIds', 'planned', 'change', 'factors'], label);
  if (raw.version !== 2 || raw.totalWeeks !== totalWeeks) {
    fail(`${label} must use version 2 and the document's totalWeeks.`);
  }
  if (!Array.isArray(raw.selectedFactorIds)) fail(`${label}.selectedFactorIds must be an array.`);
  const seen = new Set();
  const selectedFactorIds = Array.from(raw.selectedFactorIds, id => {
    if (!factorIds.has(id) || seen.has(id)) {
      fail(`${label}.selectedFactorIds must contain unique supported factor IDs.`);
    }
    seen.add(id);
    return id;
  });
  exactKeys(raw.factors, PRODUCTIVITY_FACTOR_IDS, `${label}.factors`);
  return {
    version: 2,
    totalWeeks,
    selectedFactorIds,
    planned: numericArray(raw.planned, totalWeeks, `${label}.planned`),
    change: numericArray(raw.change, totalWeeks, `${label}.change`),
    factors: Object.fromEntries(PRODUCTIVITY_FACTOR_IDS.map(id => [
      id, numericArray(raw.factors[id], totalWeeks, `${label}.factors.${id}`),
    ])),
  };
}

function summarize(mode, calculation) {
  let totalLoss = 0;
  const weeks = Array.from({ length: mode.totalWeeks }, (_, index) => {
    const revisedHours = finite(mode.planned[index] + mode.change[index], `${calculation} revised hours`);
    let totalFactors = 0;
    // VBA accumulates the selected factor rows in their worksheet order.
    for (const id of mode.selectedFactorIds) {
      totalFactors = finite(totalFactors + mode.factors[id][index], `${calculation} total factors`);
    }
    // Excel permits custom negative factors, including sums below -1. Only
    // the zero denominator is undefined; all other computed values must be finite.
    if (calculation === 'retroactive' && 1 + totalFactors === 0) {
      fail(`retroactive week ${index + 1} total factors must not produce a zero denominator.`);
    }
    // Original Excel VBA in SelectFactors and SelectFactorsR. Display formats
    // never round stored values; keep the retroactive subtraction expression.
    const loss = finite(calculation === 'proactive'
      ? revisedHours * totalFactors
      : revisedHours - revisedHours / (1 + totalFactors), `${calculation} estimated loss`);
    totalLoss = finite(totalLoss + loss, `${calculation} total loss`);
    return { revisedHours, totalFactors, loss };
  });
  return { weeks, totalLoss };
}

function validateProductivityDocument(raw) {
  exactKeys(raw, ['version', 'inputMode', 'totalWeeks', 'modes'], 'Productivity document');
  if (raw.version !== 2) fail('Productivity document must use version 2.');
  if (!['separate', 'shared'].includes(raw.inputMode)) fail('inputMode must be separate or shared.');
  const totalWeeks = weekCount(raw.totalWeeks, 'totalWeeks');
  exactKeys(raw.modes, ['proactive', 'retroactive'], 'modes');
  const modes = {
    proactive: validateMode(raw.modes.proactive, totalWeeks, 'modes.proactive'),
    retroactive: validateMode(raw.modes.retroactive, totalWeeks, 'modes.retroactive'),
  };
  if (raw.inputMode === 'shared' && !isDeepStrictEqual(modes.proactive, modes.retroactive)) {
    fail('Shared input mode requires identical proactive and retroactive inputs.');
  }
  return {
    document: { version: 2, inputMode: raw.inputMode, totalWeeks, modes },
    summaries: {
      proactive: summarize(modes.proactive, 'proactive'),
      retroactive: summarize(modes.retroactive, 'retroactive'),
    },
  };
}

function legacyNumber(value, label, blankIsZero = true) {
  if (blankIsZero && (value === null || value === undefined)) return 0;
  if (typeof value === 'string' && /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(value.trim())) {
    return finite(Number(value), label);
  }
  return finite(value, label);
}

function legacyToDocument(project, rows) {
  record(project, 'Legacy project');
  const totalWeeks = weekCount(legacyNumber(project.total_weeks, 'Legacy total weeks', false), 'Legacy total weeks');
  if (!Array.isArray(rows)) fail('Legacy weeks must be an array.');
  const mode = {
    version: 2,
    totalWeeks,
    selectedFactorIds: [...DEFAULT_FACTOR_IDS],
    planned: Array(totalWeeks).fill(0),
    change: Array(totalWeeks).fill(0),
    factors: Object.fromEntries(PRODUCTIVITY_FACTOR_IDS.map(id => [id, Array(totalWeeks).fill(0)])),
  };
  const seen = new Set();
  for (const row of rows) {
    record(row, 'Legacy week');
    const number = legacyNumber(row.week_number, 'Legacy week number', false);
    if (!Number.isInteger(number) || number < 1 || number > totalWeeks || seen.has(number)) {
      fail('Legacy week numbers must be unique integers within total weeks.');
    }
    seen.add(number);
    const index = number - 1;
    mode.planned[index] = legacyNumber(row.planned_work_hours, 'Legacy planned work hours');
    mode.change[index] = legacyNumber(row.change_order_hours, 'Legacy change order hours');
    for (const id of DEFAULT_FACTOR_IDS) mode.factors[id][index] = legacyNumber(row[id], `Legacy ${id}`);
  }
  if (seen.size !== totalWeeks) fail('Legacy weeks must include every project week.');
  // Validation constructs independent mode/array copies even though the legacy
  // table stored one set of inputs for both calculations.
  return validateProductivityDocument({
    version: 2, inputMode: 'separate', totalWeeks,
    modes: { proactive: mode, retroactive: mode },
  }).document;
}

module.exports = {
  PRODUCTIVITY_FACTOR_IDS,
  ProductivityValidationError,
  validateProductivityDocument,
  legacyToDocument,
};
