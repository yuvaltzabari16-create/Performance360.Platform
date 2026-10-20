import { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useCurrentUser } from '@/lib/useCurrentUser';
import PageHeader from '@/components/PageHeader';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Plus, Users, Trash2 } from 'lucide-react';

export default function TeamManagement() {
  const { user, loading } = useCurrentUser();
  const [teams, setTeams] = useState([]);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ name: '', sport: '', season: '', description: '' });

  const load = async () => {
    const res = await base44.entities.Team.filter({}, { sort: '-created_date', limit: 100 });
    setTeams(res.items || []);
  };
  useEffect(() => { load(); }, []);

  const save = async () => {
    if (!form.name.trim() || !user?.id) return;
    await base44.entities.Team.create({ ...form, coach_id: user.id });
    setForm({ name: '', sport: '', season: '', description: '' });
    setAdding(false);
    load();
  };

  const remove = async (id) => { await base44.entities.Team.delete(id); load(); };

  if (loading) return <div className="h-64 flex items-center justify-center text-muted-foreground">Loading…</div>;

  return (
    <div>
      <PageHeader title="Team Management" subtitle="Manage teams, groups, schedules and athletes"
        actions={<Button onClick={() => setAdding((v) => !v)}><Plus className="w-4 h-4 mr-1.5" /> New Team</Button>} />

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
          <div className="flex gap-2 mt-3"><Button onClick={save}>Save</Button><Button variant="outline" onClick={() => setAdding(false)}>Cancel</Button></div>
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
                <button onClick={() => remove(t.id)} className="text-muted-foreground hover:text-destructive"><Trash2 className="w-4 h-4" /></button>
              </div>
              {t.description && <p className="text-xs mt-2 text-muted-foreground">{t.description}</p>}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}