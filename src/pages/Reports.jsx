import { useState } from 'react';
import { useCurrentUser } from '@/lib/useCurrentUser';
import { useActiveAthlete } from '@/lib/useActiveAthlete';
import PageHeader from '@/components/PageHeader';
import AthleteSelector from '@/components/AthleteSelector';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Download, Loader2 } from 'lucide-react';
import { generateAthleteReport } from '@/lib/generateReport';

export default function Reports() {
  const { user, loading } = useCurrentUser();
  const { activeId, setAthleteId, isCoach } = useActiveAthlete(user);
  const [genLoading, setGenLoading] = useState(false);

  const download = async () => {
    if (!activeId) return;
    setGenLoading(true);
    try { await generateAthleteReport(activeId, user?.full_name || 'Athlete'); }
    finally { setGenLoading(false); }
  };

  if (loading) return <div className="h-64 flex items-center justify-center text-muted-foreground">Loading…</div>;

  return (
    <div>
      <PageHeader title="Athlete Reports" subtitle="Generate professional performance and progress reports in PDF"
        actions={isCoach && <AthleteSelector coachId={user.id} value={activeId} onChange={setAthleteId} />} />

      <Card className="p-8 text-center">
        <Download className="w-10 h-10 mx-auto mb-3 text-primary" />
        <h3 className="font-semibold mb-1">Performance & Progress Report</h3>
        <p className="text-sm text-muted-foreground mb-4 max-w-md mx-auto">
          Generates a branded PDF summarising performance metrics, rehab milestone progress, and recent movement analysis scores for the selected athlete.
        </p>
        <Button onClick={download} disabled={!activeId || genLoading}>
          {genLoading ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : <Download className="w-4 h-4 mr-1.5" />}
          {genLoading ? 'Building report…' : 'Download PDF Report'}
        </Button>
        {!activeId && <p className="text-xs text-muted-foreground mt-2">{isCoach ? 'Select an athlete first.' : 'No athlete profile loaded.'}</p>}
      </Card>
    </div>
  );
}