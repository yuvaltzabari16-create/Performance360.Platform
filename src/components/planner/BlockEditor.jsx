import { useState } from 'react';
import { Plus, Trash2, GripVertical, ChevronUp, ChevronDown, Search } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { BLOCK_TYPES, createBlankItem, relabelBlocks } from '@/lib/workoutUtils';
import VariableChip from './VariableChip';
import ExercisePicker from './ExercisePicker';
import AISubstitutesButton from './AISubstitutesButton';

const ACTIVE_VARS = ['sets', 'reps', 'load', 'rpe', 'rir', 'tempo', 'rest', 'time', 'distance'];

export default function BlockEditor({ block, blockIdx, exerciseLibrary, onUpdate, onRemove, onMoveUp, onMoveDown, canMoveUp, canMoveDown }) {
  const [pickerItemIdx, setPickerItemIdx] = useState(null);
  const updateBlock = (patch) => onUpdate({ ...block, ...patch });

  const addItem = () => {
    const items = [...block.items, createBlankItem(block.label, block.items.length)];
    updateBlock({ items });
  };

  const updateItem = (itemIdx, fieldKey, value) => {
    const items = block.items.map((it, i) => i === itemIdx ? { ...it, [fieldKey]: value } : it);
    updateBlock({ items });
  };

  const pickExercise = (itemIdx, exercise) => {
    const items = block.items.map((it, i) => i === itemIdx ? {
      ...it,
      exercise_id: exercise.id,
      exercise_name: exercise.name,
    } : it);
    updateBlock({ items });
    setPickerItemIdx(null);
  };

  const substituteExercise = (itemIdx, exerciseName) => {
    const items = block.items.map((it, i) => i === itemIdx ? { ...it, exercise_name: exerciseName } : it);
    updateBlock({ items });
  };

  const removeItem = (itemIdx) => {
    const items = block.items.filter((_, i) => i !== itemIdx);
    updateBlock({ items });
  };

  const moveItem = (itemIdx, dir) => {
    const items = [...block.items];
    const target = itemIdx + dir;
    if (target < 0 || target >= items.length) return;
    [items[itemIdx], items[target]] = [items[target], items[itemIdx]];
    updateBlock({ items });
  };

  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2 bg-secondary/50 border-b border-border">
        <span className="w-7 h-7 rounded-md bg-primary/10 text-primary flex items-center justify-center font-bold text-sm shrink-0">{block.label}</span>
        <Select value={block.type} onValueChange={(v) => updateBlock({ type: v })}>
          <SelectTrigger className="h-7 w-36 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            {BLOCK_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
          </SelectContent>
        </Select>
        {block.type === 'circuit' && (
          <div className="flex items-center gap-1 text-xs">
            <span className="text-muted-foreground">Rounds:</span>
            <input type="number" min="1" value={block.rounds || 1} onChange={(e) => updateBlock({ rounds: Number(e.target.value) || 1 })}
              className="w-12 px-1 py-0.5 rounded border border-input bg-background text-xs" />
          </div>
        )}
        <div className="ml-auto flex items-center gap-1">
          <button onClick={onMoveUp} disabled={!canMoveUp} className="p-1 rounded hover:bg-accent disabled:opacity-30"><ChevronUp className="w-3.5 h-3.5" /></button>
          <button onClick={onMoveDown} disabled={!canMoveDown} className="p-1 rounded hover:bg-accent disabled:opacity-30"><ChevronDown className="w-3.5 h-3.5" /></button>
          <button onClick={onRemove} className="p-1 rounded hover:bg-destructive/10 hover:text-destructive"><Trash2 className="w-3.5 h-3.5" /></button>
        </div>
      </div>

      <div className="divide-y divide-border">
        {block.items.map((item, itemIdx) => (
          <div key={itemIdx} className="flex items-start gap-2 px-3 py-2">
            <div className="flex flex-col items-center pt-0.5">
              <GripVertical className="w-3 h-3 text-muted-foreground/40" />
              <span className="text-[10px] font-mono text-muted-foreground">{item.label}</span>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <button onClick={() => setPickerItemIdx(itemIdx)}
                  className="flex-1 text-left text-sm font-medium bg-transparent border-none outline-none hover:text-primary transition flex items-center gap-1.5">
                  {item.exercise_name || <span className="text-muted-foreground/60 flex items-center gap-1"><Search className="w-3 h-3" /> Select exercise</span>}
                </button>
                {item.exercise_name && <AISubstitutesButton exerciseName={item.exercise_name} exerciseLibrary={exerciseLibrary} onPick={(name) => substituteExercise(itemIdx, name)} />}
              </div>
              <div className="flex flex-wrap gap-1 mt-1.5">
                {ACTIVE_VARS.map((vk) => (
                  <VariableChip key={vk} item={item} fieldKey={vk} onUpdate={(k, v) => updateItem(itemIdx, k, v)} />
                ))}
              </div>
              {item.note && <p className="text-[11px] text-muted-foreground mt-1 italic">{item.note}</p>}
            </div>
            <div className="flex flex-col gap-0.5">
              <button onClick={() => moveItem(itemIdx, -1)} disabled={itemIdx === 0} className="p-0.5 rounded hover:bg-accent disabled:opacity-20"><ChevronUp className="w-3 h-3" /></button>
              <button onClick={() => moveItem(itemIdx, 1)} disabled={itemIdx === block.items.length - 1} className="p-0.5 rounded hover:bg-accent disabled:opacity-20"><ChevronDown className="w-3 h-3" /></button>
              <button onClick={() => removeItem(itemIdx)} className="p-0.5 rounded hover:bg-destructive/10 hover:text-destructive"><Trash2 className="w-3 h-3" /></button>
            </div>
          </div>
        ))}
        {block.items.length === 0 && <div className="px-3 py-3 text-xs text-muted-foreground text-center">No exercises in this block yet.</div>}
      </div>

      <button onClick={addItem} className="w-full flex items-center justify-center gap-1.5 py-2 text-xs font-medium text-primary hover:bg-accent/50 border-t border-border transition">
        <Plus className="w-3.5 h-3.5" /> Add Exercise
      </button>

      <ExercisePicker open={pickerItemIdx !== null} onOpenChange={(o) => { if (!o) setPickerItemIdx(null); }} exerciseLibrary={exerciseLibrary} onPick={(ex) => { if (pickerItemIdx !== null) pickExercise(pickerItemIdx, ex); }} />
    </div>
  );
}