import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Dumbbell, Target, AlertTriangle, Video, Plus, Check } from 'lucide-react';
import { Image } from '@/components/ui/image';

export default function ExerciseDetail({ exercise, onAddToWorkout, onEdit, canEdit }) {
  if (!exercise) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <Dumbbell className="w-10 h-10 text-muted-foreground/30 mb-3" />
        <p className="text-sm text-muted-foreground">Select an exercise to view details.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">{exercise.name}</h2>
          <div className="flex flex-wrap items-center gap-1.5 mt-1">
            <Badge variant="secondary" className="capitalize">{exercise.category?.replace('_', ' ')}</Badge>
            <Badge variant="outline" className="capitalize">{exercise.difficulty}</Badge>
            {exercise.equipment && <Badge variant="outline">{exercise.equipment}</Badge>}
          </div>
        </div>
        {canEdit && <Button variant="outline" size="sm" onClick={onEdit}>Edit</Button>}
      </div>

      {/* Video area */}
      <Card className="overflow-hidden">
        {exercise.video_url ? (
          <video src={exercise.video_url} controls className="w-full aspect-video bg-black object-contain" />
        ) : (
          <div className="aspect-video flex flex-col items-center justify-center bg-secondary/50 text-center px-6">
            <Video className="w-8 h-8 text-muted-foreground/30 mb-2" />
            <p className="text-sm text-muted-foreground">No video attached.</p>
            <p className="text-xs text-muted-foreground/70 mt-0.5">Connect a video service for AI demo videos.</p>
          </div>
        )}
      </Card>

      {/* Coaching cues */}
      {exercise.coaching_cues?.length > 0 && (
        <div>
          <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2"><Target className="w-3.5 h-3.5" /> Coaching Cues</h3>
          <ul className="space-y-1.5">
            {exercise.coaching_cues.map((cue, i) => (
              <li key={i} className="flex items-start gap-2 text-sm">
                <Check className="w-3.5 h-3.5 text-primary mt-0.5 shrink-0" /> {cue}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Common mistakes */}
      {exercise.common_mistakes?.length > 0 && (
        <div>
          <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2"><AlertTriangle className="w-3.5 h-3.5" /> Common Mistakes</h3>
          <ul className="space-y-1.5">
            {exercise.common_mistakes.map((m, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-destructive/90">
                <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" /> {m}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Instructions */}
      {exercise.instructions && (
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">Instructions</h3>
          <p className="text-sm whitespace-pre-wrap leading-relaxed">{exercise.instructions}</p>
        </div>
      )}

      {/* Progression / Regression */}
      <div className="grid grid-cols-2 gap-3">
        {exercise.progression && (
          <div className="rounded-lg border border-border p-3">
            <h4 className="text-[10px] font-semibold uppercase tracking-wide text-primary mb-1">Progression</h4>
            <p className="text-sm">{exercise.progression}</p>
          </div>
        )}
        {exercise.regression && (
          <div className="rounded-lg border border-border p-3">
            <h4 className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">Regression</h4>
            <p className="text-sm">{exercise.regression}</p>
          </div>
        )}
      </div>

      {exercise.muscle_group && (
        <p className="text-xs text-muted-foreground">Primary muscle group: {exercise.muscle_group}</p>
      )}

      <Button onClick={onAddToWorkout} className="w-full"><Plus className="w-4 h-4 mr-1.5" /> Add to Workout</Button>
    </div>
  );
}