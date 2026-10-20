import { useEffect, useRef, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useCurrentUser } from '@/lib/useCurrentUser';
import { useActiveAthlete } from '@/lib/useActiveAthlete';
import PageHeader from '@/components/PageHeader';
import AthleteSelector from '@/components/AthleteSelector';
import SignedVideo from '@/components/SignedVideo';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Upload, Loader2, AlertTriangle, Gauge, Video } from 'lucide-react';

const MOVEMENTS = ['Squat', 'Deadlift', 'Sprint', 'Jump', 'Lunge', 'Overhead Press', 'General'];

export default function Movement() {
  const { user, loading } = useCurrentUser();
  const { activeId, setAthleteId, isCoach } = useActiveAthlete(user);
  const [history, setHistory] = useState([]);
  const [movementType, setMovementType] = useState('Squat');
  const [uploading, setUploading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');
  const fileRef = useRef(null);

  const load = async () => {
    if (!activeId) return;
    const res = await base44.entities.MovementAnalysis.filter({ user_id: activeId }, { sort: '-created_date', limit: 20 });
    setHistory(res.items || []);
  };
  useEffect(() => { load(); }, [activeId]);

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !activeId) return;
    setError('');
    setUploading(true);
    setProgress(10);
    try {
      const up = await base44.integrations.Core.UploadPrivateFile({ file });
      const fileUri = up.file_uri;
      setProgress(30);
      const signed = await base44.integrations.Core.CreateFileSignedUrl({ file_uri: fileUri });
      const videoUrl = signed.signed_url;
      const rec = await base44.entities.MovementAnalysis.create({
        user_id: activeId, video_url: fileUri, movement_type: movementType, status: 'processing',
      });
      setUploading(false);
      setAnalyzing(true);
      setProgress(50);
      const res = await base44.functions.invoke('analyzeMovement', { video_url: videoUrl, movement_type: movementType });
      setProgress(85);
      const a = res.data.analysis;
      await base44.entities.MovementAnalysis.update(rec.id, {
        ai_feedback: a.ai_feedback, discrepancies: a.discrepancies, score: a.score, status: 'completed',
      });
      setProgress(100);
      setAnalyzing(false);
      load();
    } catch (err) {
      setError(err.message || 'Analysis failed');
      setAnalyzing(false);
      setUploading(false);
    }
  };

  if (loading) return <div className="h-64 flex items-center justify-center text-muted-foreground">Loading…</div>;

  return (
    <div>
      <PageHeader title="Movement Analysis" subtitle="AI-assisted biomechanical assessment"
        actions={isCoach && <AthleteSelector coachId={user.id} value={activeId} onChange={setAthleteId} />} />

      <Card className="p-6 mb-6">
        <div className="flex flex-col sm:flex-row sm:items-end gap-4">
          <div className="flex-1">
            <label className="text-sm font-medium">Movement type</label>
            <Select value={movementType} onValueChange={setMovementType}>
              <SelectTrigger className="mt-1.5 w-full sm:w-64"><SelectValue /></SelectTrigger>
              <SelectContent>
                {MOVEMENTS.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <input ref={fileRef} type="file" accept="video/*" className="hidden" onChange={handleFile} />
          <Button onClick={() => fileRef.current?.click()} disabled={uploading || analyzing || !activeId}>
            <Upload className="w-4 h-4 mr-1.5" /> {uploading ? 'Uploading…' : analyzing ? 'Analyzing…' : 'Upload Video'}
          </Button>
        </div>
        {(uploading || analyzing) && (
          <div className="mt-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
              <Loader2 className="w-4 h-4 animate-spin" /> {analyzing ? 'Running biomechanical analysis…' : 'Uploading video…'}
            </div>
            <div className="h-2 rounded-full bg-secondary overflow-hidden">
              <div className="h-full bg-primary transition-all" style={{ width: `${progress}%` }} />
            </div>
          </div>
        )}
        {error && <p className="mt-3 text-sm text-rose-500 flex items-center gap-1.5"><AlertTriangle className="w-4 h-4" /> {error}</p>}
      </Card>

      <h2 className="font-semibold mb-3">Analysis History</h2>
      {history.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          <Video className="w-8 h-8 mx-auto mb-2 text-muted-foreground" /> No analyses yet. Upload a video to begin.
        </div>
      ) : (
        <div className="space-y-4">
          {history.map((h) => (
            <Card key={h.id} className="p-5">
              <div className="grid md:grid-cols-2 gap-5">
                <SignedVideo fileUri={h.video_url} className="w-full aspect-video rounded-lg bg-black" />
                <div>
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold">{h.movement_type}</h3>
                    {h.status === 'completed' ? (
                      <Badge variant="outline" className="gap-1 text-primary border-primary/30">
                        <Gauge className="w-3.5 h-3.5" /> {h.score}/100
                      </Badge>
                    ) : <Badge variant="outline" className="text-amber-500">{h.status}</Badge>}
                  </div>
                  {h.ai_feedback && <p className="text-sm text-muted-foreground mt-2">{h.ai_feedback}</p>}
                  {h.discrepancies?.length > 0 && (
                    <div className="mt-3">
                      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-1.5">Discrepancies</p>
                      <ul className="space-y-1">
                        {h.discrepancies.map((d, i) => (
                          <li key={i} className="text-sm flex items-start gap-2"><span className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5" />{d}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}