import { useState, useRef, useEffect } from 'react';
import { VARIABLE_FIELDS } from '@/lib/workoutUtils';

export default function VariableChip({ item, fieldKey, onUpdate }) {
  const field = VARIABLE_FIELDS.find((f) => f.key === fieldKey);
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(item[fieldKey] || '');
  const inputRef = useRef(null);

  useEffect(() => { setVal(item[fieldKey] || ''); }, [item[fieldKey]]);
  useEffect(() => { if (editing && inputRef.current) inputRef.current.focus(); }, [editing]);

  const commit = () => {
    setEditing(false);
    const v = val.trim();
    if (v !== (item[fieldKey] || '')) onUpdate(fieldKey, v || null);
  };

  if (editing) {
    return (
      <input
        ref={inputRef}
        value={val}
        onChange={(e) => setVal(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') { setEditing(false); setVal(item[fieldKey] || ''); } }}
        placeholder={field.placeholder}
        className="w-16 px-1.5 py-0.5 text-[11px] rounded border border-primary/40 bg-background outline-none focus:ring-1 focus:ring-primary"
      />
    );
  }

  return (
    <button
      onClick={() => setEditing(true)}
      className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] rounded-full bg-secondary text-secondary-foreground hover:bg-accent transition whitespace-nowrap"
    >
      <span className="text-muted-foreground font-medium">{field.label}:</span>
      <span className={item[fieldKey] ? 'font-medium' : 'text-muted-foreground/50'}>{item[fieldKey] || '—'}</span>
    </button>
  );
}