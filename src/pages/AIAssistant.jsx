import { useState, useRef, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import PageHeader from '@/components/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Sparkles, Send, Globe, Bot, User } from 'lucide-react';

const SUGGESTIONS = [
  'Design a 4-week pre-season speed block for sprinters',
  'How do I periodize strength during in-season?',
  'Rehab progression for a grade 2 hamstring strain',
  'What tests should I use to monitor return-to-play after ACL?'
];

export default function AIAssistant() {
  const [messages, setMessages] = useState([
    { role: 'assistant', content: 'Hi! I am your AI Professional Assistant. Ask me anything about strength & conditioning, programming, rehab, testing or sports science.' }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [useWeb, setUseWeb] = useState(false);
  const endRef = useRef(null);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, loading]);

  const send = async (text) => {
    const content = (text ?? input).trim();
    if (!content || loading) return;
    setInput('');
    const next = [...messages, { role: 'user', content }, { role: 'assistant', content: '' }];
    setMessages(next);
    setLoading(true);
    try {
      const res = await base44.functions.invoke('aiAssistant', { prompt: content, use_web: useWeb });
      setMessages((m) => { const c = [...m]; c[c.length - 1] = { role: 'assistant', content: res.data.answer }; return c; });
    } catch (e) {
      setMessages((m) => { const c = [...m]; c[c.length - 1] = { role: 'assistant', content: 'Sorry, something went wrong. Please try again.' }; return c; });
    } finally { setLoading(false); }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-7rem)]">
      <PageHeader title="AI Professional Assistant" subtitle="S&C, sports science, rehab, programming & general professional guidance"
        actions={<Button variant={useWeb ? 'default' : 'outline'} size="sm" onClick={() => setUseWeb((v) => !v)}>
          <Globe className="w-4 h-4 mr-1.5" /> {useWeb ? 'Web on' : 'Web search'}
        </Button>} />
      <Card className="flex-1 p-0 overflow-hidden flex flex-col">
        <div className="flex-1 overflow-y-auto scrollbar-thin p-4 space-y-4">
          {messages.map((m, i) => (
            <div key={i} className={`flex gap-3 ${m.role === 'user' ? 'flex-row-reverse' : ''}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${m.role === 'user' ? 'bg-secondary' : 'bg-primary'}`}>
                {m.role === 'user' ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4 text-primary-foreground" />}
              </div>
              <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm whitespace-pre-wrap ${m.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-secondary'}`}>
                {m.content || (loading && i === messages.length - 1 ? 'Thinking…' : '')}
              </div>
            </div>
          ))}
          <div ref={endRef} />
        </div>
        {messages.length <= 2 && (
          <div className="px-4 pb-2 flex flex-wrap gap-2">
            {SUGGESTIONS.map((s) => (
              <button key={s} onClick={() => send(s)} className="text-xs px-3 py-1.5 rounded-full border border-border hover:bg-accent text-muted-foreground">
                {s}
              </button>
            ))}
          </div>
        )}
        <div className="border-t border-border p-3 flex gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
            placeholder="Ask your professional question…"
            disabled={loading}
          />
          <Button onClick={() => send()} disabled={loading || !input.trim()}>
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </Card>
    </div>
  );
}