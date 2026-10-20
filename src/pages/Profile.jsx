import { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useCurrentUser } from '@/lib/useCurrentUser';
import { Link } from 'react-router-dom';
import { errorMessage } from '@/lib/athleteData';
import PageHeader from '@/components/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { LogOut, Save, UserPlus, Mail, Upload, Loader2 } from 'lucide-react';

export default function Profile() {
  const { user, loading, setUser } = useCurrentUser();
  const [sport, setSport] = useState('');
  const [bio, setBio] = useState('');
  const [photoUrl, setPhotoUrl] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const [error, setError] = useState('');

  useEffect(() => {
    if (user) {
      setSport(user.sport || '');
      setBio(user.bio || '');
      setPhotoUrl(user.profile_image_url || '');
    }
  }, [user]);

  const handlePhoto = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setError('');
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) { setError('Use a JPEG, PNG or WebP image'); return; }
    if (file.size > 5 * 1024 * 1024) { setError('Images must be 5 MB or smaller'); return; }
    try {
      // Note: profile photos are stored as public files (anyone with the URL can view them).
      const { file_url } = await base44.integrations.Core.UploadPublicFile({ file });
      setPhotoUrl(file_url);
    } catch (err) { setError(errorMessage(err, 'Upload failed')); }
  };

  const save = async () => {
    setSaving(true); setError('');
    try {
      await base44.auth.updateMe({ sport: sport.slice(0, 80), bio: bio.slice(0, 2000), profile_image_url: photoUrl });
      const me = await base44.auth.me();
      setUser(me);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) { setError(errorMessage(err, 'Could not save your profile')); }
    finally { setSaving(false); }
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
              <img src={photoUrl} alt="Profile photo" className="w-16 h-16 rounded-full object-cover" />
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
                <img src={photoUrl} alt="" className="w-10 h-10 rounded-full object-cover" />
              ) : (
                <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center"><Mail className="w-4 h-4 text-muted-foreground" /></div>
              )}
              <label className="cursor-pointer">
                <span className="inline-flex items-center gap-1.5 text-sm text-primary"><Upload className="w-3.5 h-3.5" /> Update photo</span>
                <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={handlePhoto} />
              </label>
            </div>
            <div>
              <Label htmlFor="sport">Sport / Discipline</Label>
              <Input id="sport" value={sport} onChange={(e) => setSport(e.target.value)} placeholder="e.g. Football" maxLength={80} className="mt-1.5" />
            </div>
            <div>
              <Label htmlFor="bio">Bio</Label>
              <textarea id="bio" value={bio} onChange={(e) => setBio(e.target.value)} rows={3}
                placeholder="Background and goals. Do not add medical details here." maxLength={2000}
                className="w-full mt-1.5 rounded-lg border border-input bg-background px-3 py-2 text-sm resize-none" />
            </div>
            {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
            <Button onClick={save} disabled={saving}>
              <Save className="w-4 h-4 mr-1.5" /> {saved ? 'Saved' : saving ? 'Saving…' : 'Save Profile'}
            </Button>
          </div>
        </Card>

        {user?.role === 'athlete' && <MyCoaches user={user} />}

        {isCoach && (
          <Card className="p-6">
            <h3 className="font-semibold mb-1">Athletes</h3>
            <p className="text-sm text-muted-foreground mb-3">Invite athletes and manage connections on the Athletes page.</p>
            <Button asChild variant="outline"><Link to="/athletes"><UserPlus className="w-4 h-4 mr-1.5" /> Manage athletes</Link></Button>
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

/** Athlete view of their coach connections, with the option to leave. */
function MyCoaches({ user }) {
  const [links, setLinks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [confirmId, setConfirmId] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const res = await base44.entities.Assignment.filter({ athlete_id: user.id, status: 'active' }, { limit: 50 });
      setLinks(res.items || []);
    } catch (e) { setError(errorMessage(e)); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, [user.id]);

  const leave = async (id) => {
    setBusy(true); setError('');
    try { await base44.functions.invoke('removeAthlete', { assignment_id: id }); setConfirmId(null); load(); }
    catch (e) { setError(errorMessage(e)); }
    finally { setBusy(false); }
  };

  return (
    <Card className="p-6">
      <h3 className="font-semibold mb-1">My coaches</h3>
      <p className="text-sm text-muted-foreground mb-3">Connected coaches can see your training, tests, check-ins and rehab records. Leaving a coach ends their access immediately.</p>
      {loading ? <p className="text-sm text-muted-foreground">Loading…</p> : links.length === 0 ? (
        <p className="text-sm text-muted-foreground">No coach connected. Ask your coach to invite your email address; the invitation appears at the top of the app after you sign in.</p>
      ) : (
        <ul className="divide-y divide-border">
          {links.map((a) => (
            <li key={a.id} className="py-2.5 flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-sm font-medium">{a.coach_name || 'Coach'}</p>
                {a.team_name && <p className="text-xs text-muted-foreground">Team: {a.team_name}</p>}
              </div>
              {confirmId === a.id ? (
                <div className="flex gap-2">
                  <Button size="sm" variant="destructive" disabled={busy} onClick={() => leave(a.id)}>{busy && <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />}Confirm leave</Button>
                  <Button size="sm" variant="ghost" onClick={() => setConfirmId(null)}>Cancel</Button>
                </div>
              ) : <Button size="sm" variant="outline" onClick={() => setConfirmId(a.id)}>Leave</Button>}
            </li>
          ))}
        </ul>
      )}
      {error && <p role="alert" className="mt-2 text-sm text-destructive">{error}</p>}
    </Card>
  );
}
