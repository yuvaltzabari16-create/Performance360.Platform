import { useEffect, useRef, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Send } from 'lucide-react';

export default function ChatThread({ athleteId, coachId, senderId, senderRole }) {
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const endRef = useRef(null);

  const load = async () => {
    if (!athleteId) return;
    const res = await base44.entities.CollaborationMessage.filter(
      { athlete_id: athleteId }, { sort: 'created_date', limit: 200 }
    );
    setMessages(res.items || []);
  };
  useEffect(() => { load(); }, [athleteId]);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const send = async () => {
    if (!text.trim() || !athleteId) return;
    setSending(true);
    try {
      await base44.entities.CollaborationMessage.create({
        athlete_id: athleteId, coach_id: coachId, sender_id: senderId, sender_role: senderRole, content: text.trim(),
      });
      setText('');
      load();
    } finally { setSending(false); }
  };

  return (
    <div className="flex flex-col h-[60vh] rounded-xl border border-border bg-card overflow-hidden">
      <div className="flex-1 overflow-y-auto scrollbar-thin p-4 space-y-3">
        {messages.length === 0 && <p className="text-center text-sm text-muted-foreground mt-8">No messages yet. Start the conversation.</p>}
        {messages.map((m) => {
          const mine = m.sender_id === senderId;
          return (
            <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[78%] rounded-2xl px-4 py-2.5 text-sm ${mine ? 'bg-primary text-primary-foreground rounded-br-sm' : 'bg-secondary text-secondary-foreground rounded-bl-sm'}`}>
                <p className="text-[10px] font-medium opacity-70 mb-0.5">{m.sender_role}</p>
                <p className="whitespace-pre-wrap">{m.content}</p>
              </div>
            </div>
          );
        })}
        <div ref={endRef} />
      </div>
      <div className="border-t border-border p-3 flex items-center gap-2">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && send()}
          placeholder="Type a message…"
          className="flex-1 rounded-full bg-secondary px-4 py-2.5 text-sm focus:outline-none"
        />
        <Button size="icon" className="rounded-full" onClick={send} disabled={sending || !text.trim()}>
          <Send className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}