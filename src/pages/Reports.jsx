import { useState } from 'react';
import { useCurrentUser } from '@/lib/useCurrentUser';
import { useActiveAthlete } from '@/lib/useActiveAthlete';
import PageHeader from '@/components/PageHeader';
import AthleteSelector from '@/components/AthleteSelector';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Download, Loader2 } from 'lucide-react';
import { generateAthleteReport } from '@/lib/generateReport';
import { errorMessage } from '@/lib/athleteData';

export default function Reports() {
  const { user, loading } = useCurrentUser();
  const { activeId, setAthleteId, isCoach } = useActiveAthlete(user);
  const [genLoading, setGenLoading] = useState(false);
  const [error, setError] = useState('');

  const download = async () => {
    if (!activeId) return;
    setGenLoading(true);
    try { setError(''); await generateAthleteReport(user, activeId); }
    catch (e) { setError(errorMessage(e, 'Could not build the report')); }
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
          Builds a PDF with the latest test results, 28-day training adherence, rehab phase progress and recent AI-assisted movement reviews. It only includes records you are allowed to see.
        </p>
        <Button onClick={download} disabled={!activeId || genLoading}>
          {genLoading ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : <Download className="w-4 h-4 mr-1.5" />}
          {genLoading ? 'Building report…' : 'Download PDF Report'}
        </Button>
        {error && <p role="alert" className="text-sm text-destructive mt-3">{error}</p>}
        {!activeId && <p className="text-xs text-muted-foreground mt-2">{isCoach ? 'Select an athlete first.' : 'No athlete profile loaded.'}</p>}
      </Card>
    </div>
  );
}