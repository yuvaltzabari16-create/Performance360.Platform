import { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import PageHeader from '@/components/PageHeader';
import ArticleCard from '@/components/ArticleCard';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Search } from 'lucide-react';

export default function Knowledge() {
  const [articles, setArticles] = useState([]);
  const [query, setQuery] = useState('');
  const [cycle, setCycle] = useState('all');
  const [open, setOpen] = useState(null);

  useEffect(() => {
    base44.entities.KnowledgeArticle.filter({}, { sort: '-created_date', limit: 100 })
      .then((res) => setArticles(res.items || []));
  }, []);

  const filtered = articles.filter((a) => {
    const matchQ = !query || a.title?.toLowerCase().includes(query.toLowerCase()) || a.summary?.toLowerCase().includes(query.toLowerCase()) || a.tags?.some((t) => t.toLowerCase().includes(query.toLowerCase()));
    const matchC = cycle === 'all' || a.cycle_type === cycle;
    return matchQ && matchC;
  });

  return (
    <div>
      <PageHeader title="Sports Science Hub" subtitle="Searchable library tailored to your training and rehab cycles" />
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
          <Input placeholder="Search articles, topics, tags…" value={query} onChange={(e) => setQuery(e.target.value)} className="pl-9" />
        </div>
        <Select value={cycle} onValueChange={setCycle}>
          <SelectTrigger className="sm:w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All cycles</SelectItem>
            <SelectItem value="training">Training</SelectItem>
            <SelectItem value="rehab">Rehab</SelectItem>
            <SelectItem value="general">General</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">No articles found.</div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((a) => <ArticleCard key={a.id} article={a} onOpen={setOpen} />)}
        </div>
      )}

      <Dialog open={!!open} onOpenChange={(v) => !v && setOpen(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{open?.title}</DialogTitle>
          </DialogHeader>
          {open?.summary && <p className="text-sm text-muted-foreground">{open.summary}</p>}
          {open?.content && <div className="text-sm whitespace-pre-wrap leading-relaxed">{open.content}</div>}
        </DialogContent>
      </Dialog>
    </div>
  );
}