import {
  DEFAULT_PRODUCTIVITY_FACTOR_IDS,
  LEGACY_PRODUCTIVITY_FACTOR_ALIASES,
  PRODUCTIVITY_FACTOR_IDS,
  PRODUCTIVITY_FACTORS,
} from './productivityFactors.js';

export const PRODUCTIVITY_MODEL_VERSION = 2;
export const MAX_PRODUCTIVITY_WEEKS = 52;
export const PRODUCTIVITY_MODES = Object.freeze(['proactive', 'retroactive']);

const knownFactors = new Set(PRODUCTIVITY_FACTOR_IDS);
const factorById = new Map(PRODUCTIVITY_FACTORS.map(factor => [factor.id, factor]));
const numericText = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i;
const isRecord = value => value !== null && typeof value === 'object' && !Array.isArray(value);

function exactKeys(value, keys, label) {
  if (!isRecord(value) || ![Object.prototype, null].includes(Object.getPrototypeOf(value))
    || Reflect.ownKeys(value).length !== keys.length
    || keys.some(key => !Object.prototype.hasOwnProperty.call(value, key))) {
    throw new Error(`${label} must contain exactly: ${keys.join(', ')}.`);
  }
}

function finite(value, label) {
  if (typeof value === 'string') {
    const text = value.trim();
    if (text === '') return 0;
    if (!numericText.test(text)) throw new Error(`${label} must be a finite number.`);
    value = Number(text);
  }
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new Error(`${label} must be a finite number.`);
  return value;
}

function weekCount(value) {
  const count = finite(value, 'The number of weeks');
  if (!Number.isInteger(count) || count < 1 || count > MAX_PRODUCTIVITY_WEEKS) {
    throw new Error(`The number of weeks must be an integer from 1 to ${MAX_PRODUCTIVITY_WEEKS}.`);
  }
  return count;
}

function modeName(mode) {
  if (!PRODUCTIVITY_MODES.includes(mode)) throw new Error('Choose proactive or retroactive calculation.');
  return mode;
}

function factorIds(ids) {
  if (!Array.isArray(ids)) throw new Error('Selected productivity factors must be an array.');
  const seen = new Set();
  for (const id of ids) {
    if (!knownFactors.has(id)) throw new Error(`Unknown productivity factor: ${String(id)}.`);
    if (seen.has(id)) throw new Error(`A productivity factor is selected more than once: ${id}.`);
    seen.add(id);
  }
  return [...ids];
}

function numbers(values, count, label) {
  if (!Array.isArray(values) || values.length !== count) throw new Error(`${label} must contain exactly ${count} weeks.`);
  return Array.from(values, (value, index) => finite(value, `${label}, week ${index + 1}`));
}

function canonicalNumbers(values, count, label) {
  if (!Array.isArray(values) || values.length !== count) throw new Error(`${label} must contain exactly ${count} weekly numbers.`);
  return Array.from(values, (value, index) => {
    if (typeof value !== 'number' || !Number.isFinite(value)) throw new Error(`${label}, week ${index + 1} must be a finite number.`);
    return value;
  });
}

function normalize(model) {
  if (!isRecord(model) || model.version !== PRODUCTIVITY_MODEL_VERSION) throw new Error('Unsupported productivity analysis version.');
  exactKeys(model, ['version', 'totalWeeks', 'selectedFactorIds', 'planned', 'change', 'factors'], 'Productivity analysis');
  if (typeof model.totalWeeks !== 'number') throw new Error('The saved number of weeks must be a number.');
  const count = weekCount(model.totalWeeks);
  const selected = factorIds(model.selectedFactorIds);
  exactKeys(model.factors, PRODUCTIVITY_FACTOR_IDS, 'Productivity factor arrays');
  const factors = Object.fromEntries(PRODUCTIVITY_FACTOR_IDS.map(id => {
    return [id, canonicalNumbers(model.factors[id], count, id)];
  }));
  return {
    version: PRODUCTIVITY_MODEL_VERSION,
    totalWeeks: count,
    selectedFactorIds: selected,
    planned: canonicalNumbers(model.planned, count, 'Planned work hours'),
    change: canonicalNumbers(model.change, count, 'Change order hours'),
    factors,
  };
}

export function createProductivityAnalysis({ totalWeeks = 14, selectedFactorIds = DEFAULT_PRODUCTIVITY_FACTOR_IDS } = {}) {
  const count = weekCount(totalWeeks);
  return {
    version: PRODUCTIVITY_MODEL_VERSION,
    totalWeeks: count,
    selectedFactorIds: factorIds(selectedFactorIds),
    planned: Array(count).fill(0),
    change: Array(count).fill(0),
    factors: Object.fromEntries(PRODUCTIVITY_FACTOR_IDS.map(id => [id, Array(count).fill(0)])),
  };
}

// The former API stored these three fractional coefficients in individual columns.
function hydrateLegacyRows(data) {
  const model = createProductivityAnalysis({ totalWeeks: data.project.total_weeks });
  const seen = new Set();
  for (const row of data.weeks) {
    if (!isRecord(row)) throw new Error('An invalid saved week was returned.');
    const number = finite(row.week_number, 'The saved week number');
    if (!Number.isInteger(number) || number < 1 || number > model.totalWeeks || seen.has(number)) {
      throw new Error('Saved week numbers must be unique and within the project duration.');
    }
    seen.add(number);
    const index = number - 1;
    model.planned[index] = finite(row.planned_work_hours ?? 0, `Planned work hours, week ${number}`);
    model.change[index] = finite(row.change_order_hours ?? 0, `Change order hours, week ${number}`);
    for (const id of DEFAULT_PRODUCTIVITY_FACTOR_IDS) model.factors[id][index] = finite(row[id] ?? 0, `${id}, week ${number}`);
  }
  if (seen.size !== model.totalWeeks) throw new Error('Saved productivity data is missing one or more project weeks.');
  return model;
}

export function hydrateProductivityAnalysis(data) {
  if (!isRecord(data)) throw new Error('Productivity analysis data is missing.');
  if (data.version !== undefined && data.version !== PRODUCTIVITY_MODEL_VERSION) throw new Error('Unsupported productivity analysis version.');
  if (data.version === PRODUCTIVITY_MODEL_VERSION) return normalize(data);
  if (isRecord(data.project) && Array.isArray(data.weeks)) return hydrateLegacyRows(data);
  // Accept the former shared context shape without changing raw coefficient units.
  if (!Array.isArray(data.planned) || !Array.isArray(data.change) || !isRecord(data.factors)) {
    throw new Error('Saved productivity analysis data has an unsupported shape.');
  }
  const model = createProductivityAnalysis({ totalWeeks: data.totalWeeks ?? data.planned.length });
  model.planned = numbers(data.planned, model.totalWeeks, 'Planned work hours');
  model.change = numbers(data.change, model.totalWeeks, 'Change order hours');
  const migrated = new Set();
  for (const [legacyId, values] of Object.entries(data.factors)) {
    const id = LEGACY_PRODUCTIVITY_FACTOR_ALIASES[legacyId] ?? legacyId;
    if (!knownFactors.has(id)) throw new Error(`Unknown saved productivity factor: ${legacyId}.`);
    if (migrated.has(id)) throw new Error(`Saved productivity factor aliases are duplicated: ${id}.`);
    migrated.add(id);
    model.factors[id] = numbers(values, model.totalWeeks, id);
  }
  return model;
}

// Include unselected arrays so removing and re-adding a factor is lossless.
export function serializeProductivityAnalysis(model) {
  return normalize(model);
}

export function resizeProductivityWeeks(model, totalWeeks) {
  const current = normalize(model);
  const count = weekCount(totalWeeks);
  const resize = values => Array.from({ length: count }, (_, index) => values[index] ?? 0);
  return {
    ...current,
    totalWeeks: count,
    planned: resize(current.planned),
    change: resize(current.change),
    factors: Object.fromEntries(PRODUCTIVITY_FACTOR_IDS.map(id => [id, resize(current.factors[id])])),
  };
}

export function resetProductivityAnalysis(model) {
  const current = normalize(model);
  return createProductivityAnalysis({ totalWeeks: current.totalWeeks, selectedFactorIds: current.selectedFactorIds });
}

export function setSelectedProductivityFactors(model, selectedFactorIds) {
  return { ...normalize(model), selectedFactorIds: factorIds(selectedFactorIds) };
}

function calculateWeek(current, index, mode) {
  const plannedHours = current.planned[index];
  const changeHours = current.change[index];
  const revisedHours = finite(plannedHours + changeHours, 'Revised work hours');
  const totalFactor = finite(current.selectedFactorIds.reduce((sum, id) => sum + current.factors[id][index], 0), 'Total productivity factor');
  if (mode === 'retroactive' && totalFactor === -1) {
    throw new Error(`Week ${index + 1}: the retroactive total factor cannot equal -100% (division by zero).`);
  }
  const loss = finite(mode === 'proactive'
    ? revisedHours * totalFactor
    : revisedHours - revisedHours / (1 + totalFactor), 'Estimated productivity loss');
  return { weekNumber: index + 1, plannedHours, changeHours, revisedHours, totalFactor, loss };
}

export function calculateProductivityWeek(model, index, mode) {
  const current = normalize(model);
  modeName(mode);
  if (!Number.isInteger(index) || index < 0 || index >= current.totalWeeks) throw new Error('The requested week is outside the project duration.');
  return calculateWeek(current, index, mode);
}

export function calculateProductivityAnalysis(model, mode) {
  const current = normalize(model);
  modeName(mode);
  const weeks = Array.from({ length: current.totalWeeks }, (_, index) => calculateWeek(current, index, mode));
  const sum = key => finite(weeks.reduce((total, row) => total + row[key], 0), `Total ${key}`);
  return {
    mode,
    weeks,
    totalPlanned: sum('plannedHours'),
    totalChange: sum('changeHours'),
    totalRevised: sum('revisedHours'),
    totalLoss: sum('loss'),
  };
}

export function parseProductivityPercent(value) {
  const input = typeof value === 'string' ? value.trim().replace(/%$/, '').trim() : value;
  if (typeof value === 'string' && value.trim() !== '' && input === '') throw new Error('The percentage must be a finite number.');
  return finite(finite(input, 'The percentage') / 100, 'The percentage');
}

// Display formatting never feeds back into the stored coefficient or calculation.
export function formatProductivityPercent(fraction) {
  const value = finite(finite(fraction, 'The productivity coefficient') * 100, 'The percentage');
  return new Intl.NumberFormat('en-US', { useGrouping: false, maximumSignificantDigits: 15 }).format(value);
}

export function getDefaultPresetName(factorId, coefficient) {
  const factor = factorById.get(factorId);
  if (!factor) throw new Error(`Unknown productivity factor: ${factorId}.`);
  const value = finite(coefficient, 'The productivity coefficient');
  if (value === 0) return 'none';
  return ['minor', 'moderate', 'severe'].find(name => Math.abs(factor[name] - value) <= 1e-12) ?? 'custom';
}
