import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useCurrentUser } from '@/lib/useCurrentUser';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Dumbbell, User, Upload, Loader2, Check } from 'lucide-react';

export default function Onboarding() {
  const { user, loading, setUser } = useCurrentUser();
  const navigate = useNavigate();
  const [role, setRole] = useState('athlete');
  const [name, setName] = useState('');
  const [sport, setSport] = useState('');
  const [bio, setBio] = useState('');
  const [photoUrl, setPhotoUrl] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (user) {
      setName(user.full_name || '');
      setSport(user.sport || '');
      setBio(user.bio || '');
      setPhotoUrl(user.profile_image_url || '');
      if (user.onboarded || user.role === 'admin') navigate('/', { replace: true });
    }
  }, [user]);

  if (loading || !user) return (
    <div className="h-screen flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
  );

  const handlePhoto = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const { file_url } = await base44.integrations.Core.UploadPublicFile({ file });
    setPhotoUrl(file_url);
  };

  const save = async () => {
    setSaving(true);
    setError('');
    try {
      await base44.functions.invoke('onboardUser', {
        role, sport, bio, profile_image_url: photoUrl, full_name: name
      });
      const me = await base44.auth.me();
      setUser(me);
      navigate('/', { replace: true });
    } catch (e) {
      setError(e.response?.data?.error || e.message || 'Could not save profile');
    } finally { setSaving(false); }
  };

  return (
    <div className="min-h-screen arctic-gradient flex items-center justify-center p-4">
      <Card className="max-w-md w-full p-8">
        <div className="text-center mb-6">
          <div className="w-14 h-14 rounded-2xl bg-primary flex items-center justify-center mx-auto mb-3 shadow-sm shadow-primary/30">
            <Dumbbell className="w-7 h-7 text-primary-foreground" />
          </div>
          <h1 className="text-xl font-semibold">Welcome to ApexMotion</h1>
          <p className="text-sm text-muted-foreground mt-1">Set up your account to get started.</p>
        </div>

        <div className="mb-5">
          <Label className="text-xs mb-2 block">I am a…</Label>
          <div className="grid grid-cols-2 gap-3">
            <button onClick={() => setRole('athlete')} className={`p-4 rounded-xl border-2 transition text-center ${role === 'athlete' ? 'border-primary bg-primary/5' : 'border-border'}`}>
              <User className="w-5 h-5 mx-auto mb-1" />
              <span className="text-sm font-medium">Athlete</span>
            </button>
            <button onClick={() => setRole('coach')} className={`p-4 rounded-xl border-2 transition text-center ${role === 'coach' ? 'border-primary bg-primary/5' : 'border-border'}`}>
              <Dumbbell className="w-5 h-5 mx-auto mb-1" />
              <span className="text-sm font-medium">Coach</span>
            </button>
          </div>
        </div>

        <div className="space-y-3">
          <div>
            <Label className="text-xs">Full name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} className="mt-1.5" placeholder="Your name" />
          </div>
          <div>
            <Label className="text-xs">Sport / Discipline</Label>
            <Input value={sport} onChange={(e) => setSport(e.target.value)} className="mt-1.5" placeholder="e.g. Soccer, Track & Field" />
          </div>
          <div>
            <Label className="text-xs">Bio (optional)</Label>
            <textarea value={bio} onChange={(e) => setBio(e.target.value)} rows={2} className="w-full mt-1.5 rounded-md border border-input p-2 text-sm resize-none" placeholder="Background, goals…" />
          </div>
          <div>
            <Label className="text-xs">Profile photo (optional)</Label>
            <div className="flex items-center gap-3 mt-1.5">
              {photoUrl ? <img src={photoUrl} className="w-12 h-12 rounded-full object-cover" /> : <div className="w-12 h-12 rounded-full bg-secondary flex items-center justify-center"><User className="w-5 h-5 text-muted-foreground" /></div>}
              <label className="cursor-pointer">
                <span className="inline-flex items-center gap-1.5 text-sm text-primary"><Upload className="w-3.5 h-3.5" /> Upload</span>
                <input type="file" accept="image/*" className="hidden" onChange={handlePhoto} />
              </label>
            </div>
          </div>
        </div>

        {error && <p className="text-sm text-destructive mt-4">{error}</p>}

        <Button onClick={save} disabled={saving} className="w-full mt-6">
          {saving ? <><Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> Setting up…</> : <><Check className="w-4 h-4 mr-1.5" /> Get Started</>}
        </Button>
      </Card>
    </div>
  );
}