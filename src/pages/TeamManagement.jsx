import { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useCurrentUser } from '@/lib/useCurrentUser';
import PageHeader from '@/components/PageHeader';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Plus, Users, Trash2 } from 'lucide-react';
import { errorMessage } from '@/lib/athleteData';

export default function TeamManagement() {
  const { user, loading } = useCurrentUser();
  const [teams, setTeams] = useState([]);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ name: '', sport: '', season: '', description: '' });
  const [members, setMembers] = useState({});
  const [confirmId, setConfirmId] = useState(null);
  const [error, setError] = useState('');
  const isCoach = user?.role === 'coach' || user?.role === 'admin';

  const load = async () => {
    if (!user) return;
    try {
      const [t, m] = await Promise.all([
        base44.entities.Team.filter({ coach_id: user.id }, { sort: '-created_date', limit: 100 }),
        base44.entities.TeamMember.filter({ coach_id: user.id }, { limit: 1000 }),
      ]);
      setTeams(t.items || []);
      const byTeam = {};
      for (const x of m.items || []) (byTeam[x.team_id] ||= []).push(x);
      setMembers(byTeam);
    } catch (e) { setError(errorMessage(e)); }
  };
  useEffect(() => { if (isCoach) load(); }, [user?.id]);

  const save = async (e) => {
    e?.preventDefault();
    if (!form.name.trim() || !user?.id) return;
    setError('');
    try {
      await base44.entities.Team.create({
        name: form.name.trim().slice(0, 120), sport: form.sport.slice(0, 80), season: form.season.slice(0, 40),
        description: form.description.slice(0, 1000), coach_id: user.id,
      });
      setForm({ name: '', sport: '', season: '', description: '' });
      setAdding(false);
      load();
    } catch (err) { setError(errorMessage(err, 'Could not create the team')); }
  };

  // Deleting a team removes its membership rows; coach–athlete connections stay.
  const remove = async (id) => {
    setError('');
    try {
      for (const m of members[id] || []) await base44.entities.TeamMember.delete(m.id);
      await base44.entities.Team.delete(id);
      setConfirmId(null);
      load();
    } catch (err) { setError(errorMessage(err, 'Could not delete the team')); }
  };

  if (loading) return <div className="h-64 flex items-center justify-center text-muted-foreground">Loading…</div>;
  if (!isCoach) return <Card className="p-8 text-center text-sm text-muted-foreground">Teams are managed by coaches.</Card>;

  return (
    <div>
      <PageHeader title="Team Management" subtitle="Manage teams, groups, schedules and athletes"
        actions={<Button onClick={() => setAdding((v) => !v)}><Plus className="w-4 h-4 mr-1.5" /> New Team</Button>} />

      {error && <p role="alert" className="mb-4 text-sm text-destructive">{error}</p>}
      <p className="mb-4 text-xs text-muted-foreground">Athletes join a team by accepting an invitation sent with that team selected (Athletes page).</p>
      {adding && (
        <Card className="p-5 mb-6">
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5"><Label className="text-xs">Team name</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div className="flex flex-col gap-1.5"><Label className="text-xs">Sport</Label>
              <Input value={form.sport} onChange={(e) => setForm({ ...form, sport: e.target.value })} /></div>
            <div className="flex flex-col gap-1.5"><Label className="text-xs">Season</Label>
              <Input value={form.season} onChange={(e) => setForm({ ...form, season: e.target.value })} placeholder="2026/27" /></div>
          </div>
          <Input className="mt-3" placeholder="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          <div className="flex gap-2 mt-3"><Button onClick={save} disabled={!form.name.trim()}>Save</Button><Button variant="outline" onClick={() => setAdding(false)}>Cancel</Button></div>
        </Card>
      )}

      {teams.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
          <Users className="w-8 h-8 mx-auto mb-2 opacity-50" /> No teams yet. Create one above.
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {teams.map((t) => (
            <Card key={t.id} className="p-4">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-semibold text-sm">{t.name}</h3>
                  <p className="text-xs text-muted-foreground">{t.sport || '—'} · {t.season || '—'}</p>
                </div>
                <button aria-label={`Delete team ${t.name}`} onClick={() => setConfirmId(t.id)} className="text-muted-foreground hover:text-destructive"><Trash2 className="w-4 h-4" /></button>
              </div>
              {t.description && <p className="text-xs mt-2 text-muted-foreground">{t.description}</p>}
              <p className="text-xs mt-3 font-medium">{(members[t.id] || []).length} athlete(s)</p>
              {(members[t.id] || []).length > 0 && (
                <ul className="mt-1 text-xs text-muted-foreground space-y-0.5">{members[t.id].map((m) => <li key={m.id}>{m.user_name || m.user_email}</li>)}</ul>
              )}
              {confirmId === t.id && (
                <div className="mt-3 rounded-lg border border-destructive/40 p-3 text-xs">
                  <p>Delete this team? Athletes stay connected to you; only the team grouping is removed.</p>
                  <div className="mt-2 flex gap-2">
                    <Button size="sm" variant="destructive" onClick={() => remove(t.id)}>Delete team</Button>
                    <Button size="sm" variant="ghost" onClick={() => setConfirmId(null)}>Cancel</Button>
                  </div>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}