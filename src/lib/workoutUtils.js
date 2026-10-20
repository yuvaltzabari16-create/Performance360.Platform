export const BLOCK_LABELS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];

export const VARIABLE_FIELDS = [
  { key: 'sets', label: 'Sets', placeholder: '4' },
  { key: 'reps', label: 'Reps', placeholder: '5' },
  { key: 'load', label: 'Load', placeholder: '80kg' },
  { key: 'rpe', label: 'RPE', placeholder: '8' },
  { key: 'rir', label: 'RIR', placeholder: '2' },
  { key: 'tempo', label: 'Tempo', placeholder: '30X0' },
  { key: 'rest', label: 'Rest', placeholder: '120s' },
  { key: 'time', label: 'Time', placeholder: '30s' },
  { key: 'distance', label: 'Dist', placeholder: '100m' },
];

export const FOCUS_OPTIONS = [
  { value: 'strength', label: 'Strength' },
  { value: 'power', label: 'Power' },
  { value: 'speed', label: 'Speed' },
  { value: 'conditioning', label: 'Conditioning' },
  { value: 'mobility', label: 'Mobility' },
  { value: 'return_to_play', label: 'Return to Play' },
  { value: 'mixed', label: 'Mixed' },
];

export const BLOCK_TYPES = [
  { value: 'straight_sets', label: 'Straight Sets' },
  { value: 'superset', label: 'Superset' },
  { value: 'circuit', label: 'Circuit' },
];

let _id = 0;
export const uid = () => `b${Date.now()}${_id++}`;

export function createBlankBlock(index) {
  return {
    id: uid(),
    label: BLOCK_LABELS[index] || `B${index + 1}`,
    type: 'straight_sets',
    rounds: 1,
    items: [],
  };
}

export function createBlankItem(blockLabel, itemIndex) {
  return {
    exercise_id: '',
    exercise_name: '',
    label: `${blockLabel}${itemIndex + 1}`,
    sets: null,
    reps: '',
    load: '',
    rpe: '',
    rir: '',
    tempo: '',
    rest: '',
    time: '',
    distance: '',
    note: '',
  };
}

export function createBlankWorkout() {
  return {
    title: 'New Workout',
    focus: 'mixed',
    estimated_duration: 45,
    blocks: [createBlankBlock(0)],
    ai_generated: false,
    status: 'planned',
  };
}

export function migrateExercisesToBlocks(exercises) {
  if (!exercises || !exercises.length) return [];
  return [{
    id: 'legacy-a',
    label: 'A',
    type: 'straight_sets',
    rounds: 1,
    items: exercises.map((ex, i) => ({
      exercise_id: ex.exercise_id || '',
      exercise_name: ex.name || ex.exercise_name || '',
      label: `A${i + 1}`,
      sets: ex.sets ?? null,
      reps: ex.reps || '',
      load: ex.load || '',
      rpe: '',
      rir: '',
      tempo: '',
      rest: '',
      time: '',
      distance: '',
      note: ex.notes || ex.note || '',
    })),
  }];
}

export function normalizeWorkout(w) {
  if (!w) return w;
  let blocks = w.blocks;
  if ((!blocks || !blocks.length) && w.exercises && w.exercises.length) {
    blocks = migrateExercisesToBlocks(w.exercises);
  }
  // Stable ids so athlete results can reference a block across reloads.
  blocks = (blocks || []).map((b, i) => (b.id ? b : { ...b, id: `blk${i}` }));
  return { ...w, blocks };
}

export function relabelBlocks(blocks) {
  return blocks.map((blk, bi) => ({
    ...blk,
    label: BLOCK_LABELS[bi] || `B${bi + 1}`,
    items: (blk.items || []).map((item, ii) => ({
      ...item,
      label: `${BLOCK_LABELS[bi] || `B${bi + 1}`}${ii + 1}`,
    })),
  }));
}