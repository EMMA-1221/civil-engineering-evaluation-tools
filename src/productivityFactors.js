// Transcribed from ProductivityV1.6.xlsm, Factors!B:D. Raw fractions are retained.
export const PRODUCTIVITY_WORKBOOK_SHA256 = 'bc286a1caffeecfdf8f209b0c7f22ab1f87e8c8f448bc03626298c40c0526ec3';
const definitions = [
  {
    "id": "overmanning",
    "label": "Overmanning",
    "category": "Overmanning",
    "description": "An increase of the peak number of workers of the same trait above the planned or estimated peak. Estimated peak typically equal to 1.6 the average number of workers.",
    "notes": {},
    "sourceCells": {
      "minor": "B3",
      "moderate": "C3",
      "severe": "D3"
    },
    "sourceRaw": {
      "minor": "0.22",
      "moderate": "0.23",
      "severe": "0.34"
    },
    "minor": 0.22,
    "moderate": 0.23,
    "severe": 0.34
  },
  {
    "id": "overtime_5_10",
    "label": "Overtime 5-10",
    "category": "Overtime",
    "description": "The work that exceeds 8 hours/day and 40 hours/week.",
    "notes": {},
    "sourceCells": {
      "minor": "B7",
      "moderate": "C7",
      "severe": "D7"
    },
    "sourceRaw": {
      "minor": "0.05",
      "moderate": "0.2",
      "severe": "0.3"
    },
    "note": "(10 hrs/day, 5 days/week)",
    "minor": 0.05,
    "moderate": 0.2,
    "severe": 0.3
  },
  {
    "id": "overtime_6_10",
    "label": "Overtime 6-10",
    "category": "Overtime",
    "description": "The work that exceeds 8 hours/day and 40 hours/week.",
    "notes": {},
    "sourceCells": {
      "minor": "B9",
      "moderate": "C9",
      "severe": "D9"
    },
    "sourceRaw": {
      "minor": "0.04",
      "moderate": "0.2",
      "severe": "0.4"
    },
    "note": "(10 hrs/day, 6 days/week)",
    "minor": 0.04,
    "moderate": 0.2,
    "severe": 0.4
  },
  {
    "id": "second_shift",
    "label": "Second Shift",
    "category": "Second Shift",
    "description": "The hours worked by a second group of craftsmen whose work is performed after the first work force of the same trade has retired for the day.",
    "notes": {},
    "sourceCells": {
      "minor": "B11",
      "moderate": "C11",
      "severe": "D11"
    },
    "sourceRaw": {
      "minor": "-0.05",
      "moderate": "0.1",
      "severe": "0.17"
    },
    "minor": -0.05,
    "moderate": 0.1,
    "severe": 0.17
  },
  {
    "id": "stacking_of_trades",
    "label": "Stacking of Trades",
    "category": "Stacking of Trades",
    "description": "Considers the total number of craftsmen from all trades working in a given area. The worker density (sq. ft./worker) depends on the available net working area and the number of workers from all crafts. The net working area is the total floor space minus any unusable portions, such as a production line, elevator shaft, and permanent fixtures.",
    "notes": {},
    "sourceCells": {
      "minor": "B13",
      "moderate": "C13",
      "severe": "D13"
    },
    "sourceRaw": {
      "minor": "0.24",
      "moderate": "0.28000000000000003",
      "severe": "0.32"
    },
    "minor": 0.24,
    "moderate": 0.28,
    "severe": 0.32
  },
  {
    "id": "out_of_sequence",
    "label": "Out-of-Sequence work",
    "category": "Out-of-Sequence work",
    "description": "An activity or a series of activities that is not performed according to baseline logical and productive planned sequence.",
    "notes": {},
    "sourceCells": {
      "minor": "B15",
      "moderate": "C15",
      "severe": "D15"
    },
    "sourceRaw": {
      "minor": "0.13",
      "moderate": "0.31",
      "severe": "0.28000000000000003"
    },
    "minor": 0.13,
    "moderate": 0.31,
    "severe": 0.28
  },
  {
    "id": "weather",
    "label": "Weather",
    "category": "Weather",
    "description": "Impact of temperature and humidity on labor output.",
    "notes": {
      "minor": "(40 ˚F, 80˚F)",
      "moderate": "(0 ˚F, 100 ˚F)",
      "severe": "(-10 ˚F ,110˚F)"
    },
    "sourceCells": {
      "minor": "B17",
      "moderate": "C17",
      "severe": "D17"
    },
    "sourceRaw": {
      "minor": "0",
      "moderate": "0.2",
      "severe": "0.4"
    },
    "minor": 0.0,
    "moderate": 0.2,
    "severe": 0.4
  },
  {
    "id": "owner_furnished",
    "label": "Owner-Furnished Items",
    "category": "Owner-Furnished Items",
    "description": "Includes both material and equipment that are bought and supplied to the specialty contractor by the owner (any part providing materials or equipment) or possibly the general contractor. See Figure 3.14 for further details.",
    "notes": {},
    "sourceCells": {
      "minor": "B20",
      "moderate": "C20",
      "severe": "D20"
    },
    "sourceRaw": {
      "minor": "4.2999999999999997E-2",
      "moderate": "0.111",
      "severe": "0.17899999999999999"
    },
    "minor": 0.043,
    "moderate": 0.111,
    "severe": 0.179
  },
  {
    "id": "access_constraints",
    "label": "Access Constraints",
    "category": "Access Constraints",
    "description": "Access constraints are experienced when the work area is unavailable, partially available, or not in a condition to be used by workers.",
    "notes": {},
    "sourceCells": {
      "minor": "B22",
      "moderate": "C22",
      "severe": "D22"
    },
    "sourceRaw": {
      "minor": "0.17",
      "moderate": "0.25",
      "severe": "0.32"
    },
    "minor": 0.17,
    "moderate": 0.25,
    "severe": 0.32
  },
  {
    "id": "beneficial_occupancy",
    "label": "Beneficial Occupancy",
    "category": "Beneficial Occupancy",
    "description": "The situation in which a contractor must work in close proximity to an owner’s production equipment or personnel.",
    "notes": {},
    "sourceCells": {
      "minor": "B24",
      "moderate": "C24",
      "severe": "D24"
    },
    "sourceRaw": {
      "minor": "0.12",
      "moderate": "0.2",
      "severe": "0.28000000000000003"
    },
    "minor": 0.12,
    "moderate": 0.2,
    "severe": 0.28
  },
  {
    "id": "loss_of_learning",
    "label": "Loss of Learning",
    "category": "Loss of Learning",
    "description": "Loss of Learning is encountered when highly repetitive operations are interrupted or personnel are changed, with the new personnel will slowly learning the operations.",
    "notes": {},
    "sourceCells": {
      "minor": "B26",
      "moderate": "C26",
      "severe": "D26"
    },
    "sourceRaw": {
      "minor": "0.21",
      "moderate": "0.28999999999999998",
      "severe": "0.32"
    },
    "minor": 0.21,
    "moderate": 0.29,
    "severe": 0.32
  },
  {
    "id": "change_order_processing",
    "label": "Change Order Processing Time",
    "category": "Change Order Processing Time",
    "description": "The period of time between initiation of the change order and the owner’s approval of the change order for the majority of change items experienced on the project.",
    "notes": {
      "minor": "(> 1 week)",
      "moderate": "(3-4 weeks)",
      "severe": "(5 weeks)"
    },
    "sourceCells": {
      "minor": "B28",
      "moderate": "C28",
      "severe": "D28"
    },
    "sourceRaw": {
      "minor": "0",
      "moderate": "0.1",
      "severe": "0.15"
    },
    "minor": 0.0,
    "moderate": 0.1,
    "severe": 0.15
  },
  {
    "id": "absenteeism",
    "label": "Absenteeism",
    "category": "Absenteeism",
    "description": "",
    "notes": {
      "minor": "(5% absenteeism)",
      "moderate": "(10% absenteeism)",
      "severe": "(20% absenteeism)"
    },
    "sourceCells": {
      "minor": "B31",
      "moderate": "C31",
      "severe": "D31"
    },
    "sourceRaw": {
      "minor": "0.02",
      "moderate": "0.22",
      "severe": "0.4"
    },
    "minor": 0.02,
    "moderate": 0.22,
    "severe": 0.4
  },
  {
    "id": "turnover",
    "label": "Turnover",
    "category": "Turnover",
    "description": "",
    "notes": {
      "minor": "(5% turnover)",
      "moderate": "(10% turnover)",
      "severe": "(20% turnover)"
    },
    "sourceCells": {
      "minor": "B34",
      "moderate": "C34",
      "severe": "D34"
    },
    "sourceRaw": {
      "minor": "0.04",
      "moderate": "0.1",
      "severe": "0.2"
    },
    "minor": 0.04,
    "moderate": 0.1,
    "severe": 0.2
  },
  {
    "id": "dilution_of_supervision",
    "label": "Dilution of Supervision",
    "category": "Dilution of Supervision",
    "description": "This occurs when supervisors are diverted from productive work as a result of high crew levels and change order work.",
    "notes": {},
    "sourceCells": {
      "minor": "B37",
      "moderate": "C37",
      "severe": "D37"
    },
    "sourceRaw": {
      "minor": "0.25",
      "moderate": "0.28000000000000003",
      "severe": "0.31"
    },
    "minor": 0.25,
    "moderate": 0.28,
    "severe": 0.31
  },
  {
    "id": "design_complete",
    "label": "Percent Design Complete Prior to Construction",
    "category": "Percent Design Complete Prior to Construction",
    "description": "Percentage of the design complete prior to construction.",
    "notes": {
      "minor": "(98% design)",
      "moderate": "(80% design)",
      "severe": "(60% design)"
    },
    "sourceCells": {
      "minor": "B39",
      "moderate": "C39",
      "severe": "D39"
    },
    "sourceRaw": {
      "minor": "0.01",
      "moderate": "0.1",
      "severe": "0.18"
    },
    "minor": 0.01,
    "moderate": 0.1,
    "severe": 0.18
  },
  {
    "id": "ae_coordination",
    "label": "AE Coordination Prior to Construction",
    "category": "AE Coordination Prior to Construction",
    "description": "Coordination with the architect/engineer prior to construction.",
    "notes": {},
    "sourceCells": {
      "minor": "B42",
      "moderate": "C42",
      "severe": "D42"
    },
    "sourceRaw": {
      "minor": "0.02",
      "moderate": "0.08",
      "severe": "0.14000000000000001"
    },
    "minor": 0.02,
    "moderate": 0.08,
    "severe": 0.14
  },
  {
    "id": "ae_support",
    "label": "AE Support During Construction",
    "category": "AE Support During Construction",
    "description": "Support provided by the architect/engineer during construction.",
    "notes": {},
    "sourceCells": {
      "minor": "B44",
      "moderate": "C44",
      "severe": "D44"
    },
    "sourceRaw": {
      "minor": "0.01",
      "moderate": "0.1",
      "severe": "0.2"
    },
    "minor": 0.01,
    "moderate": 0.1,
    "severe": 0.2
  },
  {
    "id": "manpower_shortage",
    "label": "Manpower Shortage During Construction",
    "category": "Manpower Shortage During Construction",
    "description": "",
    "notes": {},
    "sourceCells": {
      "minor": "B46",
      "moderate": "C46",
      "severe": "D46"
    },
    "sourceRaw": {
      "minor": "0.02",
      "moderate": "0.08",
      "severe": "0.14000000000000001"
    },
    "minor": 0.02,
    "moderate": 0.08,
    "severe": 0.14
  }
];

export const PRODUCTIVITY_FACTORS = Object.freeze(definitions.map(factor => Object.freeze({
  ...factor,
  ...Object.fromEntries(['minor', 'moderate', 'severe'].map(severity => [severity, Number(factor.sourceRaw[severity])])),
  notes: Object.freeze(factor.notes), sourceCells: Object.freeze(factor.sourceCells), sourceRaw: Object.freeze(factor.sourceRaw),
})));
export const PRODUCTIVITY_FACTOR_IDS = Object.freeze(PRODUCTIVITY_FACTORS.map(factor => factor.id));
export const DEFAULT_PRODUCTIVITY_FACTOR_IDS = Object.freeze(['overmanning', 'stacking_of_trades', 'overtime_5_10']);
export const LEGACY_PRODUCTIVITY_FACTOR_ALIASES = Object.freeze({ stacking: 'stacking_of_trades', overtime: 'overtime_5_10' });
