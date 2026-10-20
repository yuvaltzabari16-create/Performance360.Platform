import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Mail, Check, X, Loader2 } from 'lucide-react';

export default function InvitationBanner({ user }) {
  const [invitations, setInvitations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [responding, setResponding] = useState({});

  const load = async () => {
    if (!user?.email) return;
    setLoading(true);
    try {
      const res = await base44.entities.Assignment.filter({ athlete_email: user.email, status: 'pending' }, { sort: '-created_date', limit: 10 });
      const now = new Date();
      const active = (res.items || []).filter((a) => !a.expires_at || new Date(a.expires_at) > now);
      setInvitations(active);
    } catch (_) {} finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [user]);

  const respond = async (id, action) => {
    setResponding((r) => ({ ...r, [id]: true }));
    try {
      await base44.functions.invoke('respondToInvitation', { assignment_id: id, action });
      setInvitations((prev) => prev.filter((a) => a.id !== id));
    } catch (_) {} finally { setResponding((r) => ({ ...r, [id]: false })); }
  };

  if (loading || invitations.length === 0) return null;

  return (
    <div className="space-y-2 mb-4">
      {invitations.map((inv) => (
        <Card key={inv.id} className="p-4 flex flex-col sm:flex-row sm:items-center gap-3 sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <Mail className="w-4 h-4 text-primary" />
            </div>
            <div>
              <p className="text-sm font-medium">{inv.coach_name} invited you to join as an athlete</p>
              {inv.team_name && <p className="text-xs text-muted-foreground">Team: {inv.team_name}</p>}
              {inv.expires_at && <p className="text-xs text-muted-foreground">Expires: {new Date(inv.expires_at).toLocaleDateString()}</p>}
            </div>
          </div>
          <div className="flex gap-2 shrink-0">
            <Button size="sm" onClick={() => respond(inv.id, 'accept')} disabled={responding[inv.id]}>
              {responding[inv.id] ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <><Check className="w-3.5 h-3.5 mr-1" /> Accept</>}
            </Button>
            <Button size="sm" variant="outline" onClick={() => respond(inv.id, 'decline')} disabled={responding[inv.id]}>
              <X className="w-3.5 h-3.5 mr-1" /> Decline
            </Button>
          </div>
        </Card>
      ))}
    </div>
  );
}