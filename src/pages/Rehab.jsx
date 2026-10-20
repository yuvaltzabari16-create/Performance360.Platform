import { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useCurrentUser } from '@/lib/useCurrentUser';
import { useActiveAthlete } from '@/lib/useActiveAthlete';
import PageHeader from '@/components/PageHeader';
import AthleteSelector from '@/components/AthleteSelector';
import MilestoneCard from '@/components/MilestoneCard';
import { Button } from '@/components/ui/button';
import { Plus, ShieldCheck } from 'lucide-react';

export default function Rehab() {
  const { user, loading } = useCurrentUser();
  const { activeId, setAthleteId, isCoach } = useActiveAthlete(user);
  const [milestones, setMilestones] = useState([]);
  const [blocks, setBlocks] = useState([]);

  const load = async () => {
    if (!activeId) return;
    const [m, b] = await Promise.all([
      base44.entities.ClearanceMilestone.filter({ user_id: activeId }, { sort: 'order', limit: 50 }),
      base44.entities.ExerciseBlock.filter({ user_id: activeId }, { sort: 'order', limit: 100 }),
    ]);
    setMilestones(m.items || []);
    setBlocks(b.items || []);
  };
  useEffect(() => { load(); }, [activeId]);

  const seedPlan = async () => {
    const plan = [
      { title: 'Acute Protection', description: 'Pain control and protected mobility.', order: 1, required_tests: ['Pain < 3/10 at rest', 'No joint effusion'] },
      { title: 'Range of Motion', description: 'Restore full passive range.', order: 2, required_tests: ['90% ROM vs contralateral', 'Pain-free end range'] },
      { title: 'Strength Foundation', description: 'Isometric and eccentric loading.', order: 3, required_tests: ['5s single-leg hold', '10 controlled sit-to-stand'] },
      { title: 'Return to Sport', description: 'Sport-specific progressions.', order: 4, required_tests: ['Hop test symmetry > 90%', 'Sprint without compensation'] },
    ];
    await base44.entities.ClearanceMilestone.bulkCreate(
      plan.map((p) => ({ ...p, user_id: activeId, status: p.order === 1 ? 'in_progress' : 'locked' }))
    );
    const blockDefs = [
      { milestoneOrder: 1, title: 'Isometric Holds', instructions: '5 x 10s holds, submaximal effort.' },
      { milestoneOrder: 2, title: 'Active ROM Drills', instructions: '3 sets of controlled articulations.' },
      { milestoneOrder: 3, title: 'Eccentric Step-ups', instructions: '3 x 8 slow tempo, focus on control.' },
      { milestoneOrder: 4, title: 'Plyometric Series', instructions: 'Bounds and hops, monitor symmetry.' },
    ];
    const created = await base44.entities.ClearanceMilestone.filter({ user_id: activeId }, { sort: 'order', limit: 50 });
    const byOrder = {};
    (created.items || []).forEach((m) => { byOrder[m.order] = m.id; });
    await base44.entities.ExerciseBlock.bulkCreate(
      blockDefs.map((b, i) => ({ user_id: activeId, milestone_id: byOrder[b.milestoneOrder], title: b.title, instructions: b.instructions, status: 'locked', order: i + 1 }))
    );
    load();
  };

  if (loading) return <div className="h-64 flex items-center justify-center text-muted-foreground">Loading…</div>;

  const blocksFor = (ms) => blocks.filter((b) => b.milestone_id === ms.id);

  return (
    <div>
      <PageHeader title="Rehab Progression" subtitle="Gated recovery phases with clearance milestones"
        actions={
          <div className="flex items-center gap-2">
            {isCoach && <AthleteSelector coachId={user.id} value={activeId} onChange={setAthleteId} />}
            {milestones.length === 0 && <Button size="sm" variant="outline" onClick={seedPlan} disabled={!activeId}><Plus className="w-4 h-4 mr-1.5" /> Seed Rehab Plan</Button>}
          </div>
        } />
      {milestones.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-10 text-center">
          <ShieldCheck className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
          <p className="text-sm text-muted-foreground">No rehab plan yet. Seed a standard 4-phase progression to begin.</p>
        </div>
      ) : (
        <div className="relative pl-2">
          <div className="absolute left-5 top-2 bottom-2 w-px bg-border" />
          <div className="space-y-4">
            {milestones.map((m) => {
              const prev = milestones.find((x) => x.order === m.order - 1);
              const unlocked = m.order === 1 || prev?.status === 'completed' || m.status !== 'locked';
              return <MilestoneCard key={m.id} milestone={m} unlocked={unlocked} blocks={blocksFor(m)} onUpdated={load} />;
            })}
          </div>
        </div>
      )}
    </div>
  );
}