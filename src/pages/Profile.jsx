import { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useCurrentUser } from '@/lib/useCurrentUser';
import { useCoachLink } from '@/lib/useCoachLink';
import PageHeader from '@/components/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { LogOut, Save, UserPlus, Mail, Trash2, Upload, Loader2, Link as LinkIcon } from 'lucide-react';

const STATUS_COLORS = {
  pending: 'text-amber-600 border-amber-400/40',
  active: 'text-emerald-600 border-emerald-400/40',
  declined: 'text-muted-foreground',
  removed: 'text-destructive',
  expired: 'text-muted-foreground',
};

export default function Profile() {
  const { user, loading, setUser } = useCurrentUser();
  const { coachName, teamName } = useCoachLink(user);
  const [sport, setSport] = useState('');
  const [bio, setBio] = useState('');
  const [photoUrl, setPhotoUrl] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const [inviteEmail, setInviteEmail] = useState('');
  const [teamId, setTeamId] = useState('');
  const [teams, setTeams] = useState([]);
  const [inviting, setInviting] = useState(false);
  const [assignments, setAssignments] = useState([]);
  const [inviteMsg, setInviteMsg] = useState('');
  const [inviteLink, setInviteLink] = useState('');
  const [removingId, setRemovingId] = useState(null);

  useEffect(() => {
    if (user) {
      setSport(user.sport || '');
      setBio(user.bio || '');
      setPhotoUrl(user.profile_image_url || '');
    }
  }, [user]);

  const loadAssignments = async () => {
    if (!user || (user.role !== 'coach' && user.role !== 'admin')) return;
    const res = await base44.entities.Assignment.filter({ coach_id: user.id }, { sort: '-created_date', limit: 50 });
    setAssignments(res.items || []);
  };
  const loadTeams = async () => {
    if (!user || (user.role !== 'coach' && user.role !== 'admin')) return;
    const res = await base44.entities.Team.filter({ coach_id: user.id }, { sort: '-created_date', limit: 50 });
    setTeams(res.items || []);
  };
  useEffect(() => { loadAssignments(); loadTeams(); }, [user]);

  const handlePhoto = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const { file_url } = await base44.integrations.Core.UploadPublicFile({ file });
    setPhotoUrl(file_url);
  };

  const save = async () => {
    setSaving(true);
    try {
      await base44.auth.updateMe({ sport, bio, profile_image_url: photoUrl });
      const me = await base44.auth.me();
      setUser(me);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally { setSaving(false); }
  };

  const invite = async () => {
    if (!inviteEmail.trim()) return;
    setInviting(true);
    setInviteMsg('');
    setInviteLink('');
    try {
      const res = await base44.functions.invoke('inviteAthlete', {
        athlete_email: inviteEmail.trim(),
        team_id: teamId || undefined
      });
      const data = res.data || res;
      if (data.emailSent) {
        setInviteMsg('Invitation email sent to ' + inviteEmail.trim());
      } else {
        setInviteLink(window.location.origin + '/');
        setInviteMsg('Could not email the athlete directly. Share this link so they can sign in:');
      }
      setInviteEmail('');
      loadAssignments();
    } catch (e) {
      setInviteMsg(e.response?.data?.error || e.message || 'Could not invite');
    } finally { setInviting(false); }
  };

  const removeAthlete = async (assignmentId) => {
    setRemovingId(assignmentId);
    try {
      await base44.functions.invoke('removeAthlete', { assignment_id: assignmentId });
      loadAssignments();
    } catch (_) {} finally { setRemovingId(null); }
  };

  if (loading) return <div className="h-64 flex items-center justify-center text-muted-foreground">Loading…</div>;

  const isCoach = user?.role === 'coach' || user?.role === 'admin';

  return (
    <div>
      <PageHeader title="Profile" subtitle="Account details and coach–athlete connections" />
      <div className="max-w-2xl space-y-6">
        <Card className="p-6">
          <div className="flex items-center gap-4 mb-6">
            {photoUrl ? (
              <img src={photoUrl} className="w-16 h-16 rounded-full object-cover" />
            ) : (
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xl font-semibold">
                {(user?.full_name || user?.email || '?').charAt(0).toUpperCase()}
              </div>
            )}
            <div>
              <h2 className="font-semibold text-lg">{user?.full_name || 'Athlete'}</h2>
              <p className="text-sm text-muted-foreground">{user?.email}</p>
              <Badge variant="outline" className="mt-1.5 capitalize text-primary border-primary/30">{user?.role}</Badge>
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center gap-3">
              {photoUrl ? (
                <img src={photoUrl} className="w-10 h-10 rounded-full object-cover" />
              ) : (
                <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center"><Mail className="w-4 h-4 text-muted-foreground" /></div>
              )}
              <label className="cursor-pointer">
                <span className="inline-flex items-center gap-1.5 text-sm text-primary"><Upload className="w-3.5 h-3.5" /> Update photo</span>
                <input type="file" accept="image/*" className="hidden" onChange={handlePhoto} />
              </label>
            </div>
            <div>
              <Label htmlFor="sport">Sport / Discipline</Label>
              <Input id="sport" value={sport} onChange={(e) => setSport(e.target.value)} placeholder="e.g. Track & Field, Soccer" className="mt-1.5" />
            </div>
            <div>
              <Label htmlFor="bio">Bio</Label>
              <textarea id="bio" value={bio} onChange={(e) => setBio(e.target.value)} rows={3}
                placeholder="Background, goals, injury history…"
                className="w-full mt-1.5 rounded-lg border border-input bg-background px-3 py-2 text-sm resize-none" />
            </div>
            <Button onClick={save} disabled={saving}>
              <Save className="w-4 h-4 mr-1.5" /> {saved ? 'Saved' : saving ? 'Saving…' : 'Save Profile'}
            </Button>
          </div>
        </Card>

        {user?.role === 'athlete' && (
          <Card className="p-6">
            <h3 className="font-semibold mb-1">Coach & Team</h3>
            {coachName ? (
              <div className="space-y-1">
                <p className="text-sm"><span className="text-muted-foreground">Coach:</span> <span className="text-primary font-medium">{coachName}</span></p>
                {teamName && <p className="text-sm"><span className="text-muted-foreground">Team:</span> {teamName}</p>}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No coach linked yet. Ask your coach to invite you by email — you'll see the invitation here after signing in.</p>
            )}
          </Card>
        )}

        {isCoach && (
          <Card className="p-6">
            <h3 className="font-semibold mb-1">Invite Athlete</h3>
            <p className="text-sm text-muted-foreground mb-4">Send an invite by email. The athlete sees the invitation after signing in.</p>
            <div className="flex flex-col sm:flex-row gap-2">
              <div className="relative flex-1">
                <Mail className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
                <Input value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} placeholder="athlete@email.com" className="pl-9" />
              </div>
              {teams.length > 0 && (
                <Select value={teamId} onValueChange={setTeamId}>
                  <SelectTrigger className="sm:w-40"><SelectValue placeholder="No team" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={null}>No team</SelectItem>
                    {teams.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              )}
              <Button onClick={invite} disabled={inviting || !inviteEmail.trim()}>
                <UserPlus className="w-4 h-4 mr-1.5" /> {inviting ? 'Sending…' : 'Invite'}
              </Button>
            </div>
            {inviteMsg && (
              <div className="mt-3 text-sm">
                <p className="text-muted-foreground">{inviteMsg}</p>
                {inviteLink && (
                  <div className="mt-1 flex items-center gap-2 rounded-md border border-input px-3 py-2 bg-secondary/50">
                    <LinkIcon className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                    <code className="text-xs truncate">{inviteLink}</code>
                  </div>
                )}
              </div>
            )}

            <div className="mt-6">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-2">Roster</p>
              {assignments.length === 0 ? (
                <p className="text-sm text-muted-foreground">No athletes invited yet.</p>
              ) : (
                <div className="divide-y divide-border">
                  {assignments.map((a) => (
                    <div key={a.id} className="py-2.5 flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium">{a.athlete_name || a.athlete_email}</p>
                        <p className="text-xs text-muted-foreground">{a.athlete_email}{a.team_name ? ' · ' + a.team_name : ''}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className={`capitalize ${STATUS_COLORS[a.status] || ''}`}>{a.status}</Badge>
                        {(a.status === 'active' || a.status === 'pending') && (
                          <Button size="icon" variant="ghost" onClick={() => removeAthlete(a.id)} disabled={removingId === a.id}>
                            {removingId === a.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5 text-destructive" />}
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </Card>
        )}

        <Card className="p-6">
          <Button variant="outline" onClick={() => base44.auth.logout('/')}>
            <LogOut className="w-4 h-4 mr-1.5" /> Sign out
          </Button>
        </Card>
      </div>
    </div>
  );
}