import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useCurrentUser } from '@/lib/useCurrentUser';
import { errorMessage } from '@/lib/athleteData';
import PageHeader from '@/components/PageHeader';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { UserPlus, Users, Loader2, MessageSquare } from 'lucide-react';

const STATUS_STYLE = {
  pending: 'text-amber-500 border-amber-400/40',
  active: 'text-emerald-500 border-emerald-400/40',
};

/**
 * Coach roster. Lists only this coach's own relationships (Assignment RLS),
 * never the platform's user list.
 */
export default function AthleteManagement() {
  const { user, loading: userLoading } = useCurrentUser();
  const [rows, setRows] = useState([]);
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState('');
  const [teamId, setTeamId] = useState('');
  const [inviting, setInviting] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [confirm, setConfirm] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [showClosed, setShowClosed] = useState(false);

  const isCoach = user?.role === 'coach' || user?.role === 'admin';

  const load = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [a, t] = await Promise.all([
        base44.entities.Assignment.filter({ coach_id: user.id }, { sort: '-created_date', limit: 500 }),
        base44.entities.Team.filter({ coach_id: user.id }, { limit: 100 }),
      ]);
      setRows(a.items || []); setTeams(t.items || []);
    } catch (e) { setMessage({ type: 'error', text: errorMessage(e) }); }
    finally { setLoading(false); }
  };
  useEffect(() => { if (isCoach) load(); }, [user?.id]);

  const invite = async (e) => {
    e.preventDefault();
    setInviting(true); setMessage({ type: '', text: '' });
    try {
      const res = await base44.functions.invoke('inviteAthlete', { athlete_email: email.trim(), team_id: teamId || undefined });
      setMessage({
        type: 'ok',
        text: res.data?.emailSent
          ? `Invitation emailed to ${email.trim()}. It expires in 14 days.`
          : `Invitation created for ${email.trim()}, but no email could be sent. Ask them to sign in to Performance360 with that address — the invitation will appear at the top of the app.`,
      });
      setEmail('');
      load();
    } catch (err) { setMessage({ type: 'error', text: errorMessage(err, 'Could not invite') }); }
    finally { setInviting(false); }
  };

  const end = async (a) => {
    setBusyId(a.id); setMessage({ type: '', text: '' });
    try { await base44.functions.invoke('removeAthlete', { assignment_id: a.id }); setConfirm(null); load(); }
    catch (err) { setMessage({ type: 'error', text: errorMessage(err) }); }
    finally { setBusyId(null); }
  };

  if (userLoading) return <div className="h-64 flex items-center justify-center text-muted-foreground">Loading…</div>;
  if (!isCoach) return <Card className="p-8 text-center text-sm text-muted-foreground">This page is for coaches. Your coaches are listed on your Profile.</Card>;

  const now = Date.now();
  const open = rows.filter((a) => a.status === 'active' || (a.status === 'pending' && (!a.expires_at || Date.parse(a.expires_at) > now)));
  const closed = rows.filter((a) => !open.includes(a));

  return (
    <div>
      <PageHeader title="Athletes" subtitle="Invite athletes, see who is connected and end connections" />

      <Card className="p-5 mb-6">
        <h2 className="font-semibold mb-3">Invite an athlete</h2>
        <form onSubmit={invite} className="grid gap-3 sm:grid-cols-[1fr_200px_auto] items-end">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="inv-email">Athlete email</Label>
            <Input id="inv-email" type="email" required maxLength={254} autoComplete="off" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="athlete@example.com" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="inv-team">Team (optional)</Label>
            <select id="inv-team" value={teamId} onChange={(e) => setTeamId(e.target.value)} className="h-9 rounded-md border border-input bg-transparent px-3 text-sm">
              <option value="">No team</option>
              {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
          <Button type="submit" disabled={inviting || !email.trim()}>{inviting ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <UserPlus className="w-4 h-4 mr-1.5" />}Invite</Button>
        </form>
        {message.text && <p role={message.type === 'error' ? 'alert' : 'status'} className={`mt-3 text-sm ${message.type === 'error' ? 'text-destructive' : 'text-muted-foreground'}`}>{message.text}</p>}
      </Card>

      {loading ? (
        <div className="h-40 flex items-center justify-center text-muted-foreground"><Loader2 className="w-5 h-5 animate-spin mr-2" />Loading…</div>
      ) : open.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
          <Users className="w-8 h-8 mx-auto mb-2 opacity-50" aria-hidden /> No athletes yet. Invite one above.
        </div>
      ) : (
        <ul className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {open.map((a) => (
            <li key={a.id}>
              <Card className="p-4 h-full flex flex-col">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center font-semibold text-sm" aria-hidden>
                    {(a.athlete_name || a.athlete_email || '?').charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium text-sm truncate">{a.athlete_name || a.athlete_email}</p>
                    <p className="text-xs text-muted-foreground truncate">{a.athlete_email}{a.team_name ? ` · ${a.team_name}` : ''}</p>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className={`capitalize ${STATUS_STYLE[a.status] || ''}`}>{a.status}</Badge>
                  {a.status === 'pending' && a.expires_at && <span className="text-xs text-muted-foreground">expires {a.expires_at.slice(0, 10)}</span>}
                </div>
                <div className="mt-auto pt-3 flex flex-wrap gap-2">
                  {a.status === 'active' && (
                    <Button size="sm" variant="outline" asChild><Link to={`/messages?athlete=${encodeURIComponent(a.athlete_id)}`}><MessageSquare className="w-3.5 h-3.5 mr-1" />Message</Link></Button>
                  )}
                  {confirm === a.id ? (
                    <>
                      <Button size="sm" variant="destructive" disabled={busyId === a.id} onClick={() => end(a)}>
                        {busyId === a.id && <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />}{a.status === 'pending' ? 'Revoke invitation' : 'Remove athlete'}
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setConfirm(null)}>Cancel</Button>
                    </>
                  ) : (
                    <Button size="sm" variant="ghost" className="text-destructive" onClick={() => setConfirm(a.id)}>{a.status === 'pending' ? 'Revoke' : 'Remove'}</Button>
                  )}
                </div>
                {confirm === a.id && a.status === 'active' && (
                  <p className="mt-2 text-xs text-muted-foreground">You will immediately lose access to this athlete’s records. Their data is kept and stays theirs.</p>
                )}
              </Card>
            </li>
          ))}
        </ul>
      )}

      {closed.length > 0 && (
        <div className="mt-6">
          <button type="button" className="text-sm text-primary" aria-expanded={showClosed} onClick={() => setShowClosed((v) => !v)}>
            {showClosed ? 'Hide' : 'Show'} past invitations and connections ({closed.length})
          </button>
          {showClosed && (
            <ul className="mt-2 divide-y divide-border rounded-xl border border-border">
              {closed.map((a) => (
                <li key={a.id} className="px-4 py-2.5 flex flex-wrap items-center justify-between gap-2 text-sm">
                  <span>{a.athlete_name || a.athlete_email}</span>
                  <span className="text-xs text-muted-foreground capitalize">{a.status === 'pending' ? 'expired' : a.status}{a.ended_at ? ` · ${a.ended_at.slice(0, 10)}` : ''}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
