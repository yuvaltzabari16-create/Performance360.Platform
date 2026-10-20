import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useCurrentUser, todayStr } from '@/lib/useCurrentUser';
import { useActiveAthlete } from '@/lib/useActiveAthlete';
import PageHeader from '@/components/PageHeader';
import AthleteSelector from '@/components/AthleteSelector';
import ProgramBlock from '@/components/ProgramBlock';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sparkles, Loader2, Save } from 'lucide-react';

export default function ProgramBuilder() {
  const { user, loading } = useCurrentUser();
  const { activeId, setAthleteId, isCoach } = useActiveAthlete(user);
  const [weeks, setWeeks] = useState('4');
  const [goal, setGoal] = useState('strength');
  const [sport, setSport] = useState('general');
  const [level, setLevel] = useState('intermediate');
  const [daysPerWeek, setDaysPerWeek] = useState('4');
  const [notes, setNotes] = useState('');
  const [program, setProgram] = useState(null);
  const [genLoading, setGenLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const build = async () => {
    if (!activeId) return;
    setGenLoading(true); setProgram(null); setSaved(false);
    try {
      const res = await base44.functions.invoke('generateProgram', {
        weeks: Number(weeks), goal, sport, level,
        days_per_week: Number(daysPerWeek), notes
      });
      setProgram(res.data.program);
    } finally { setGenLoading(false); }
  };

  const saveBlock = async () => {
    if (!program || !activeId) return;
    setSaving(true); setSaved(false);
    try {
      const today = new Date();
      const records = [];
      program.weeks.forEach((wk) => {
        wk.days.forEach((d) => {
          const date = new Date(today);
          date.setDate(today.getDate() + (wk.week_number - 1) * 7 + (d.day - 1));
          records.push({
            user_id: activeId,
            date: date.toISOString().slice(0, 10),
            title: `${program.title} — W${wk.week_number} D${d.day}: ${d.title}`,
            exercises: d.exercises,
            status: 'planned',
            ai_generated: true,
          });
        });
      });
      // bulkCreate in batches of 100
      for (let i = 0; i < records.length; i += 100) {
        await base44.entities.Workout.bulkCreate(records.slice(i, i + 100));
      }
      setSaved(true);
    } finally { setSaving(false); }
  };

  if (loading) return <div className="h-64 flex items-center justify-center text-muted-foreground">Loading…</div>;

  return (
    <div>
      <PageHeader title="AI Program Builder" subtitle="Design multi-week periodized training blocks with AI-assisted periodization"
        actions={isCoach && <AthleteSelector coachId={user.id} value={activeId} onChange={setAthleteId} />} />

      <Card className="p-5 mb-6">
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <div className="flex flex-col gap-1.5"><Label className="text-xs">Block length (weeks)</Label>
            <Input type="number" min="1" max="12" value={weeks} onChange={(e) => setWeeks(e.target.value)} /></div>
          <div className="flex flex-col gap-1.5"><Label className="text-xs">Primary goal</Label>
            <Select value={goal} onValueChange={setGoal}><SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="strength">Strength</SelectItem>
                <SelectItem value="hypertrophy">Hypertrophy</SelectItem>
                <SelectItem value="power">Power</SelectItem>
                <SelectItem value="speed">Speed</SelectItem>
                <SelectItem value="endurance">Endurance</SelectItem>
                <SelectItem value="pre-season">Pre-season</SelectItem>
              </SelectContent>
            </Select></div>
          <div className="flex flex-col gap-1.5"><Label className="text-xs">Sport</Label>
            <Input value={sport} onChange={(e) => setSport(e.target.value)} placeholder="e.g. soccer" /></div>
          <div className="flex flex-col gap-1.5"><Label className="text-xs">Athlete level</Label>
            <Select value={level} onValueChange={setLevel}><SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="beginner">Beginner</SelectItem>
                <SelectItem value="intermediate">Intermediate</SelectItem>
                <SelectItem value="advanced">Advanced</SelectItem>
                <SelectItem value="elite">Elite</SelectItem>
              </SelectContent>
            </Select></div>
          <div className="flex flex-col gap-1.5"><Label className="text-xs">Days per week</Label>
            <Input type="number" min="1" max="7" value={daysPerWeek} onChange={(e) => setDaysPerWeek(e.target.value)} /></div>
          <div className="flex flex-col gap-1.5"><Label className="text-xs">Notes / constraints</Label>
            <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="e.g. returning from hamstring strain" /></div>
        </div>
        <div className="mt-4">
          <Button onClick={build} disabled={genLoading || !activeId}>
            {genLoading ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Sparkles className="w-4 h-4 mr-1.5" />}
            {genLoading ? 'Building program…' : 'Generate Program'}
          </Button>
        </div>
      </Card>

      {genLoading && <div className="flex items-center justify-center py-12 text-muted-foreground"><Loader2 className="w-5 h-5 animate-spin mr-2" /> Generating your periodized block…</div>}

      {program && (
        <>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
            <div>
              <h2 className="text-xl font-semibold tracking-tight">{program.title}</h2>
              {program.summary && <p className="text-sm text-muted-foreground mt-0.5">{program.summary}</p>}
            </div>
            <Button onClick={saveBlock} disabled={saving || !activeId}>
              {saving ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Save className="w-4 h-4 mr-1.5" />}
              {saving ? 'Saving…' : 'Save Block to Athlete'}
            </Button>
          </div>
          {saved && <Card className="p-3 mb-4 bg-accent text-accent-foreground text-sm">✓ Block saved — {program.weeks.reduce((n, w) => n + (w.days?.length || 0), 0)} planned sessions added to the calendar.</Card>}
          <ProgramBlock program={program} />
        </>
      )}
    </div>
  );
}