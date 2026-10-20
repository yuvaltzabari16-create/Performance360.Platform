import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const CATEGORIES = ['strength', 'power', 'speed', 'mobility', 'conditioning', 'plyometrics', 'core', 'rehab', 'return_to_play'];
const DIFFICULTIES = ['beginner', 'intermediate', 'advanced'];

export default function ExerciseForm({ initial, onSave, onCancel }) {
  const [form, setForm] = useState({
    name: '', category: 'strength', muscle_group: '', equipment: '', difficulty: 'intermediate',
    instructions: '', coaching_cues_text: '', common_mistakes_text: '', progression: '', regression: '', video_url: '', tags: '',
    ...initial,
  });

  useEffect(() => {
    if (initial) {
      setForm({
        ...initial,
        coaching_cues_text: (initial.coaching_cues || []).join('\n'),
        common_mistakes_text: (initial.common_mistakes || []).join('\n'),
        tags: (initial.tags || []).join(', '),
      });
    }
  }, [initial]);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const save = () => {
    if (!form.name.trim()) return;
    const payload = {
      name: form.name.trim(),
      category: form.category,
      muscle_group: form.muscle_group || undefined,
      equipment: form.equipment || undefined,
      difficulty: form.difficulty,
      instructions: form.instructions || undefined,
      coaching_cues: (form.coaching_cues_text || '').split('\n').map((s) => s.trim()).filter(Boolean),
      common_mistakes: (form.common_mistakes_text || '').split('\n').map((s) => s.trim()).filter(Boolean),
      progression: form.progression || undefined,
      regression: form.regression || undefined,
      video_url: form.video_url || undefined,
      tags: (form.tags || '').split(',').map((s) => s.trim()).filter(Boolean),
    };
    onSave(payload);
  };

  return (
    <Card className="p-5">
      <div className="grid sm:grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5"><Label className="text-xs">Name *</Label>
          <Input value={form.name} onChange={(e) => set('name', e.target.value)} /></div>
        <div className="flex flex-col gap-1.5"><Label className="text-xs">Category</Label>
          <Select value={form.category} onValueChange={(v) => set('category', v)}><SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{CATEGORIES.map((c) => <SelectItem key={c} value={c} className="capitalize">{c.replace('_', ' ')}</SelectItem>)}</SelectContent>
          </Select></div>
        <div className="flex flex-col gap-1.5"><Label className="text-xs">Muscle group</Label>
          <Input value={form.muscle_group || ''} onChange={(e) => set('muscle_group', e.target.value)} /></div>
        <div className="flex flex-col gap-1.5"><Label className="text-xs">Equipment</Label>
          <Input value={form.equipment || ''} onChange={(e) => set('equipment', e.target.value)} /></div>
        <div className="flex flex-col gap-1.5"><Label className="text-xs">Difficulty</Label>
          <Select value={form.difficulty} onValueChange={(v) => set('difficulty', v)}><SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{DIFFICULTIES.map((d) => <SelectItem key={d} value={d} className="capitalize">{d}</SelectItem>)}</SelectContent>
          </Select></div>
        <div className="flex flex-col gap-1.5"><Label className="text-xs">Video URL</Label>
          <Input value={form.video_url || ''} onChange={(e) => set('video_url', e.target.value)} placeholder="https://..." /></div>
      </div>
      <div className="mt-3 flex flex-col gap-1.5"><Label className="text-xs">Instructions</Label>
        <textarea className="w-full rounded-md border border-input p-2 text-sm" rows={2} value={form.instructions || ''} onChange={(e) => set('instructions', e.target.value)} /></div>
      <div className="mt-3 grid sm:grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5"><Label className="text-xs">Coaching cues (one per line)</Label>
          <textarea className="w-full rounded-md border border-input p-2 text-sm" rows={3} value={form.coaching_cues_text || ''} onChange={(e) => set('coaching_cues_text', e.target.value)} /></div>
        <div className="flex flex-col gap-1.5"><Label className="text-xs">Common mistakes (one per line)</Label>
          <textarea className="w-full rounded-md border border-input p-2 text-sm" rows={3} value={form.common_mistakes_text || ''} onChange={(e) => set('common_mistakes_text', e.target.value)} /></div>
      </div>
      <div className="mt-3 grid sm:grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5"><Label className="text-xs">Progression</Label>
          <Input value={form.progression || ''} onChange={(e) => set('progression', e.target.value)} /></div>
        <div className="flex flex-col gap-1.5"><Label className="text-xs">Regression</Label>
          <Input value={form.regression || ''} onChange={(e) => set('regression', e.target.value)} /></div>
      </div>
      <div className="mt-3 flex flex-col gap-1.5"><Label className="text-xs">Tags (comma separated)</Label>
        <Input value={form.tags || ''} onChange={(e) => set('tags', e.target.value)} /></div>
      <div className="flex gap-2 mt-4"><Button onClick={save}>Save</Button><Button variant="outline" onClick={onCancel}>Cancel</Button></div>
    </Card>
  );
}