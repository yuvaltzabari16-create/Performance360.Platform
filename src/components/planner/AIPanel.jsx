import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sparkles, Loader2, Wand2 } from 'lucide-react';

const PRESETS = [
  { key: 'progress', label: 'Progress for next week' },
  { key: 'cut_volume_30', label: 'Cut volume by 30%' },
  { key: 'match_day_minus_2', label: 'Match-day −2 friendly' },
  { key: 'fit_40_min', label: 'Fit into 40 minutes' },
];

export default function AIPanel({ mode, onModeChange, onGenerateWorkout, onGenerateProgram, onModifyWorkout, hasWorkout, loading }) {
  const [tab, setTab] = useState('generate');
  const [prompt, setPrompt] = useState('');
  const [genMode, setGenMode] = useState('workout');
  const [weeks, setWeeks] = useState('4');
  const [sessions, setSessions] = useState('3');
  const [sport, setSport] = useState('general');
  const [goal, setGoal] = useState('strength');
  const [activePreset, setActivePreset] = useState('');

  const handleGenerate = () => {
    if (genMode === 'workout') onGenerateWorkout({ prompt, sport, goal });
    else onGenerateProgram({ prompt, weeks: Number(weeks), sessions_per_week: Number(sessions), sport, goal });
  };

  const handleModify = (presetKey) => {
    setActivePreset(presetKey);
    onModifyWorkout(presetKey);
  };

  return (
    <Card className="p-4">
      <div className="flex gap-1 mb-3 p-1 bg-secondary rounded-lg">
        <button onClick={() => setTab('generate')} className={`flex-1 py-1.5 text-xs font-medium rounded-md transition ${tab === 'generate' ? 'bg-background shadow-sm' : 'text-muted-foreground'}`}>Generate</button>
        <button onClick={() => setTab('modify')} disabled={!hasWorkout} className={`flex-1 py-1.5 text-xs font-medium rounded-md transition ${tab === 'modify' ? 'bg-background shadow-sm' : 'text-muted-foreground'} disabled:opacity-40`}>Modify Open Workout</button>
      </div>

      {tab === 'generate' ? (
        <div className="space-y-3">
          <div className="flex gap-2">
            <button onClick={() => setGenMode('workout')} className={`flex-1 py-1.5 text-xs font-medium rounded-md transition ${genMode === 'workout' ? 'bg-primary text-primary-foreground' : 'bg-secondary'}`}>Single Workout</button>
            <button onClick={() => setGenMode('program')} className={`flex-1 py-1.5 text-xs font-medium rounded-md transition ${genMode === 'program' ? 'bg-primary text-primary-foreground' : 'bg-secondary'}`}>Multi-week Program</button>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs">Prompt (optional)</Label>
            <Input value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="e.g. Lower body power session for sprinter" className="h-9 text-sm" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs">Sport</Label>
              <Input value={sport} onChange={(e) => setSport(e.target.value)} className="h-8 text-sm" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs">Goal</Label>
              <Select value={goal} onValueChange={setGoal}><SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="strength">Strength</SelectItem>
                  <SelectItem value="power">Power</SelectItem>
                  <SelectItem value="speed">Speed</SelectItem>
                  <SelectItem value="hypertrophy">Hypertrophy</SelectItem>
                  <SelectItem value="conditioning">Conditioning</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          {genMode === 'program' && (
            <div className="grid grid-cols-2 gap-2">
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs">Weeks (max 4)</Label>
                <Input type="number" min="1" max="4" value={weeks} onChange={(e) => setWeeks(e.target.value)} className="h-8 text-sm" />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs">Sessions/week (max 3)</Label>
                <Input type="number" min="1" max="3" value={sessions} onChange={(e) => setSessions(e.target.value)} className="h-8 text-sm" />
              </div>
            </div>
          )}
          <Button onClick={handleGenerate} disabled={loading} className="w-full">
            {loading ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Sparkles className="w-4 h-4 mr-1.5" />}
            {loading ? 'Generating…' : `Generate ${genMode === 'workout' ? 'Workout' : 'Program'}`}
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">Apply a quick preset to the open workout:</p>
          {PRESETS.map((p) => (
            <button key={p.key} onClick={() => handleModify(p.key)} disabled={loading}
              className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium border transition ${activePreset === p.key && loading ? 'border-primary bg-primary/5' : 'border-border hover:bg-accent'}`}>
              <Wand2 className="w-3.5 h-3.5 text-primary" /> {p.label}
            </button>
          ))}
          {loading && <p className="text-xs text-center text-muted-foreground">Modifying workout…</p>}
        </div>
      )}
    </Card>
  );
}