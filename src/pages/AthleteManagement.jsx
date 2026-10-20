import { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import PageHeader from '@/components/PageHeader';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { UserPlus, Users } from 'lucide-react';

export default function AthleteManagement() {
  const [athletes, setAthletes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [inviteEmail, setInviteEmail] = useState('');
  const [selected, setSelected] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const users = await base44.entities.User.list();
      setAthletes((users.items || users).filter((u) => u.role !== 'admin').slice(0, 100));
    } catch (e) { setAthletes([]); }
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const invite = async () => {
    if (!inviteEmail.trim()) return;
    try { await base44.users.inviteUser(inviteEmail.trim(), 'user'); setInviteEmail(''); load(); }
    catch (e) { /* ignore */ }
  };

  return (
    <div>
      <PageHeader title="Athlete Management" subtitle="Centralized athlete profiles, goals, training history and performance data" />

      <Card className="p-5 mb-6">
        <h3 className="font-semibold mb-3">Invite Athlete</h3>
        <div className="flex gap-2">
          <Input placeholder="athlete@email.com" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} />
          <Button onClick={invite} disabled={!inviteEmail.trim()}><UserPlus className="w-4 h-4 mr-1.5" /> Invite</Button>
        </div>
      </Card>

      {loading ? (
        <div className="h-40 flex items-center justify-center text-muted-foreground">Loading athletes…</div>
      ) : athletes.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
          <Users className="w-8 h-8 mx-auto mb-2 opacity-50" /> No athletes yet. Invite one above.
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {athletes.map((a) => (
            <Card key={a.id} className="p-4 cursor-pointer hover:ring-1 hover:ring-primary/40 transition" onClick={() => setSelected(a)}>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center font-semibold text-sm">
                  {(a.full_name || a.email || '?').charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <p className="font-medium text-sm truncate">{a.full_name || 'Unnamed'}</p>
                  <p className="text-xs text-muted-foreground truncate">{a.email}</p>
                </div>
              </div>
              <div className="mt-2"><Badge variant="outline">{a.role}</Badge></div>
            </Card>
          ))}
        </div>
      )}

      {selected && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setSelected(null)}>
          <Card className="max-w-md w-full p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-full bg-secondary flex items-center justify-center font-semibold">
                {(selected.full_name || selected.email || '?').charAt(0).toUpperCase()}
              </div>
              <div>
                <h2 className="font-semibold">{selected.full_name || 'Unnamed athlete'}</h2>
                <p className="text-sm text-muted-foreground">{selected.email}</p>
              </div>
            </div>
            <dl className="text-sm space-y-1">
              <div className="flex justify-between"><dt className="text-muted-foreground">Role</dt><dd>{selected.role}</dd></div>
              <div className="flex justify-between"><dt className="text-muted-foreground">Joined</dt><dd>{selected.created_date?.slice(0, 10)}</dd></div>
            </dl>
            <Button variant="outline" className="w-full mt-4" onClick={() => setSelected(null)}>Close</Button>
          </Card>
        </div>
      )}
    </div>
  );
}