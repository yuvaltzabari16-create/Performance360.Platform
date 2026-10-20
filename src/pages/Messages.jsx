import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useCurrentUser } from '@/lib/useCurrentUser';
import { errorMessage } from '@/lib/athleteData';
import PageHeader from '@/components/PageHeader';
import ChatThread from '@/components/ChatThread';
import { Card } from '@/components/ui/card';

/** Conversations with every active coach–athlete connection. */
export default function Messages() {
  const { user, loading } = useCurrentUser();
  const [params, setParams] = useSearchParams();
  const [links, setLinks] = useState([]);
  const [unread, setUnread] = useState({});
  const [error, setError] = useState('');
  const isCoach = user?.role === 'coach' || user?.role === 'admin';

  const load = async () => {
    if (!user) return;
    try {
      const mine = isCoach ? { coach_id: user.id } : { athlete_id: user.id };
      const [a, m] = await Promise.all([
        base44.entities.Assignment.filter({ ...mine, status: 'active' }, { limit: 500 }),
        base44.entities.CollaborationMessage.filter(mine, { sort: '-created_date', limit: 500 }),
      ]);
      setLinks((a.items || []).filter((x) => x.athlete_id));
      const counts = {};
      for (const msg of m.items || []) {
        if (msg.sender_id !== user.id && !msg.read_at) {
          const k = isCoach ? msg.athlete_id : msg.coach_id;
          counts[k] = (counts[k] || 0) + 1;
        }
      }
      setUnread(counts);
    } catch (e) { setError(errorMessage(e)); }
  };
  useEffect(() => { load(); }, [user?.id]);

  if (loading) return <div className="h-64 flex items-center justify-center text-muted-foreground">Loading…</div>;

  const counterpart = (l) => (isCoach ? l.athlete_id : l.coach_id);
  const selectedKey = params.get(isCoach ? 'athlete' : 'coach') || (links[0] && counterpart(links[0])) || '';
  const active = links.find((l) => counterpart(l) === selectedKey);

  return (
    <div>
      <PageHeader title="Messages" subtitle="Direct messages with your connected coaches and athletes" />
      {error && <p role="alert" className="mb-4 text-sm text-destructive">{error}</p>}
      {links.length === 0 ? (
        <Card className="p-8 text-center text-sm text-muted-foreground">You can message once a coach–athlete connection is active.</Card>
      ) : (
        <div className="grid md:grid-cols-[240px_1fr] gap-4">
          <nav aria-label="Conversations" className="space-y-1 min-w-0">
            {links.map((l) => {
              const key = counterpart(l);
              const name = isCoach ? l.athlete_name || l.athlete_email : l.coach_name || 'Coach';
              return (
                <button key={l.id} onClick={() => setParams({ [isCoach ? 'athlete' : 'coach']: key })}
                  aria-current={key === selectedKey ? 'true' : undefined}
                  className={`w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg text-sm text-left transition ${key === selectedKey ? 'bg-primary/10 text-primary font-medium' : 'hover:bg-accent'}`}>
                  <span className="truncate">{name}</span>
                  {unread[key] > 0 && <span className="text-[10px] font-semibold rounded-full bg-primary text-primary-foreground px-1.5 py-0.5" aria-label={`${unread[key]} unread`}>{unread[key]}</span>}
                </button>
              );
            })}
          </nav>
          {active ? <ChatThread athleteId={active.athlete_id} coachId={active.coach_id} userId={user.id} onRead={load} />
            : <Card className="p-8 text-center text-sm text-muted-foreground">Choose a conversation.</Card>}
        </div>
      )}
    </div>
  );
}
