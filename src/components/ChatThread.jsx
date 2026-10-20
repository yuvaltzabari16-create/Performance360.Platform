import { useEffect, useRef, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { errorMessage } from '@/lib/athleteData';
import { Button } from '@/components/ui/button';
import { Send, Loader2 } from 'lucide-react';

const POLL_MS = 15000;

/**
 * Messages between one coach and one athlete. Sending goes through the
 * sendMessage function (which checks the active connection and sets the
 * sender); reading uses entity RLS (only the two parties can read).
 * New messages are fetched every 15 seconds while the thread is open —
 * there are no push or email notifications.
 */
export default function ChatThread({ athleteId, coachId, userId, onRead }) {
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const endRef = useRef(null);

  const load = async () => {
    if (!athleteId || !coachId) return;
    try {
      const res = await base44.entities.CollaborationMessage.filter(
        { athlete_id: athleteId, coach_id: coachId }, { sort: 'created_date', limit: 500 },
      );
      const items = res.items || [];
      setMessages(items);
      if (items.some((m) => m.sender_id !== userId && !m.read_at)) {
        base44.functions.invoke('sendMessage', { action: 'mark_read', athlete_id: athleteId, coach_id: coachId })
          .then(() => onRead?.()).catch(() => {});
      }
    } catch (e) { setError(errorMessage(e)); }
  };

  useEffect(() => {
    setMessages([]); setError('');
    load();
    const t = setInterval(() => { if (document.visibilityState === 'visible') load(); }, POLL_MS);
    return () => clearInterval(t);
  }, [athleteId, coachId]);
  useEffect(() => { endRef.current?.scrollIntoView({ block: 'end' }); }, [messages.length]);

  const send = async (e) => {
    e?.preventDefault();
    if (!text.trim()) return;
    setSending(true); setError('');
    try {
      await base44.functions.invoke('sendMessage', { action: 'send', athlete_id: athleteId, coach_id: coachId, content: text.trim() });
      setText('');
      load();
    } catch (err) { setError(errorMessage(err, 'Message not sent')); }
    finally { setSending(false); }
  };

  return (
    <div className="flex flex-col h-[65vh] rounded-xl border border-border bg-card overflow-hidden">
      <div className="flex-1 overflow-y-auto scrollbar-thin p-4 space-y-3" aria-live="polite">
        {messages.length === 0 && <p className="text-center text-sm text-muted-foreground mt-8">No messages yet.</p>}
        {messages.map((m) => {
          const mine = m.sender_id === userId;
          return (
            <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] sm:max-w-[75%] rounded-2xl px-4 py-2.5 text-sm ${mine ? 'bg-primary text-primary-foreground rounded-br-sm' : 'bg-secondary text-secondary-foreground rounded-bl-sm'}`}>
                <p className="text-[10px] font-medium opacity-70 mb-0.5">{mine ? 'You' : m.sender_name || m.sender_role} · {new Date(m.created_date).toLocaleString()}</p>
                <p className="whitespace-pre-wrap break-words">{m.content}</p>
                {mine && <p className="text-[10px] opacity-60 mt-0.5 text-right">{m.read_at ? 'Read' : 'Sent'}</p>}
              </div>
            </div>
          );
        })}
        <div ref={endRef} />
      </div>
      {error && <p role="alert" className="px-4 py-2 text-sm text-destructive border-t border-border">{error}</p>}
      <form onSubmit={send} className="border-t border-border p-3 flex items-center gap-2">
        <label htmlFor="chat-input" className="sr-only">Message</label>
        <input id="chat-input" value={text} maxLength={4000} onChange={(e) => setText(e.target.value)}
          placeholder="Type a message…" className="flex-1 min-w-0 rounded-full bg-secondary px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
        <Button type="submit" size="icon" className="rounded-full" disabled={sending || !text.trim()} aria-label="Send">
          {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
        </Button>
      </form>
    </div>
  );
}
