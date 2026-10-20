import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import PageHeader from '@/components/PageHeader';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Search, Loader2, Save, BookOpen } from 'lucide-react';

export default function ResearchHub() {
  const [query, setQuery] = useState('');
  const [result, setResult] = useState('');
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);

  const search = async () => {
    if (!query.trim()) return;
    setLoading(true); setResult(''); setSaved(false);
    try {
      const res = await base44.functions.invoke('aiAssistant', {
        prompt: `Summarize the current scientific research and evidence on: ${query}. Include key findings, practical applications for coaches, and notable studies or review references where possible.`,
        use_web: true,
      });
      setResult(res.data.answer);
    } finally { setLoading(false); }
  };

  const saveArticle = async () => {
    if (!result) return;
    await base44.entities.KnowledgeArticle.create({
      title: query, category: 'Research', cycle_type: 'general',
      summary: result.slice(0, 200), content: result, tags: ['research', 'saved'],
    });
    setSaved(true);
  };

  return (
    <div>
      <PageHeader title="Research Hub" subtitle="Search, summarize and save scientific studies and sports science research" />

      <Card className="p-5 mb-6">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input className="pl-9" value={query} onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') search(); }}
              placeholder="e.g. effects of eccentric training on hamstring injury risk" />
          </div>
          <Button onClick={search} disabled={loading || !query.trim()}>
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <BookOpen className="w-4 h-4 mr-1.5" />}
            {loading ? 'Searching…' : 'Search'}
          </Button>
        </div>
      </Card>

      {loading && <div className="flex items-center justify-center py-12 text-muted-foreground"><Loader2 className="w-5 h-5 animate-spin mr-2" /> Searching the literature…</div>}

      {result && (
        <Card className="p-6">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold">Research Summary</h3>
            <Button size="sm" variant="outline" onClick={saveArticle} disabled={saved}>
              <Save className="w-4 h-4 mr-1.5" /> {saved ? 'Saved' : 'Save to Library'}
            </Button>
          </div>
          <pre className="text-sm whitespace-pre-wrap font-body leading-relaxed">{result}</pre>
        </Card>
      )}
    </div>
  );
}