import {
  calculateProductivityAnalysis,
  createProductivityAnalysis,
  hydrateProductivityAnalysis,
  resetProductivityAnalysis,
  resizeProductivityWeeks,
  serializeProductivityAnalysis,
} from './productivityModel.js';

export const PRODUCTIVITY_INPUT_MODE = 'separate';
const modes = ['proactive', 'retroactive'];
const clone = analysis => serializeProductivityAnalysis(analysis);

export function createProductivityDocument(totalWeeks = 14, inputMode = PRODUCTIVITY_INPUT_MODE) {
  return hydrateProductivityDocument({
    version: 2, inputMode, totalWeeks,
    modes: {
      proactive: createProductivityAnalysis({ totalWeeks }),
      retroactive: createProductivityAnalysis({ totalWeeks }),
    },
  });
}

export function hydrateProductivityDocument(input) {
  const raw = typeof input === 'string' ? JSON.parse(input) : input;
  if (!raw || raw.version !== 2 || !['separate', 'shared'].includes(raw.inputMode)) {
    throw new Error('This saved analysis uses an unsupported format. No changes have been saved.');
  }
  if (Object.keys(raw).sort().join(',') !== 'inputMode,modes,totalWeeks,version'
      || !Number.isInteger(raw.totalWeeks) || raw.totalWeeks < 1 || raw.totalWeeks > 52) {
    throw new Error('The saved document fields or project duration are invalid.');
  }
  if (!raw.modes || Object.keys(raw.modes).sort().join(',') !== 'proactive,retroactive') {
    throw new Error('Both Proactive and Retroactive inputs are required.');
  }
  const result = { version: 2, inputMode: raw.inputMode, totalWeeks: raw.totalWeeks, modes: {} };
  for (const mode of modes) {
    const analysis = hydrateProductivityAnalysis(raw.modes[mode]);
    if (analysis.totalWeeks !== result.totalWeeks) throw new Error('The saved week counts do not match.');
    result.modes[mode] = analysis;
  }
  if (result.inputMode === 'shared' && JSON.stringify(result.modes.proactive) !== JSON.stringify(result.modes.retroactive)) {
    throw new Error('The saved shared inputs do not match between methods.');
  }
  return result;
}

export function updateProductivityMode(document, mode, analysis) {
  if (!modes.includes(mode)) throw new Error('Choose a valid analysis method.');
  const current = hydrateProductivityDocument(document);
  const next = clone(analysis);
  if (next.totalWeeks !== current.totalWeeks) throw new Error('Change the project duration for both methods together.');
  return {
    ...current,
    modes: current.inputMode === 'shared'
      ? { proactive: clone(next), retroactive: clone(next) }
      : { ...current.modes, [mode]: next },
  };
}

export function resizeProductivityDocument(document, totalWeeks) {
  const current = hydrateProductivityDocument(document);
  const proactive = resizeProductivityWeeks(current.modes.proactive, totalWeeks);
  const retroactive = resizeProductivityWeeks(current.modes.retroactive, totalWeeks);
  return { ...current, totalWeeks: proactive.totalWeeks, modes: { proactive, retroactive } };
}

export function resetProductivityMode(document, mode) {
  const current = hydrateProductivityDocument(document);
  return updateProductivityMode(current, mode, resetProductivityAnalysis(current.modes[mode]));
}

export function calculateProductivityDocument(document) {
  const current = hydrateProductivityDocument(document);
  return Object.fromEntries(modes.map(mode => [mode, calculateProductivityAnalysis(current.modes[mode], mode)]));
}

export function serializeProductivityDocument(document) {
  const current = hydrateProductivityDocument(document);
  calculateProductivityDocument(current);
  return current;
}

export function hasProductivityValuesAfter(document, totalWeeks) {
  const current = hydrateProductivityDocument(document);
  if (!Number.isInteger(totalWeeks) || totalWeeks < 1 || totalWeeks > 52) {
    throw new Error('The number of weeks must be an integer from 1 to 52.');
  }
  return modes.some(mode => {
    const analysis = current.modes[mode];
    return [analysis.planned, analysis.change, ...Object.values(analysis.factors)]
      .some(values => values.slice(totalWeeks).some(value => value !== 0));
  });
}
