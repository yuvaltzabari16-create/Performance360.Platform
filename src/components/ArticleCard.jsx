import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { BookOpen } from 'lucide-react';

export default function ArticleCard({ article, onOpen }) {
  return (
    <Card className="p-5 cursor-pointer hover:shadow-md transition-shadow" onClick={() => onOpen(article)}>
      <div className="flex items-center gap-2 mb-2">
        <Badge variant="outline" className="text-primary border-primary/30">{article.category}</Badge>
        <Badge variant="outline" className="text-muted-foreground">{article.cycle_type}</Badge>
      </div>
      <h3 className="font-semibold leading-snug">{article.title}</h3>
      {article.summary && <p className="text-sm text-muted-foreground mt-1.5 line-clamp-2">{article.summary}</p>}
      <div className="flex items-center gap-1.5 mt-3 text-xs text-muted-foreground">
        <BookOpen className="w-3.5 h-3.5" /> {article.author || 'Arctic Lab'}
      </div>
    </Card>
  );
}