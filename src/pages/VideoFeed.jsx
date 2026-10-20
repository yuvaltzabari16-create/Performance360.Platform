import { useEffect, useRef, useState, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Heart, Plus, Dumbbell, ChevronUp } from 'lucide-react';

const CATEGORIES = ['all', 'strength', 'power', 'speed', 'mobility', 'conditioning', 'plyometrics', 'core', 'rehab'];

export default function VideoFeed() {
  const [exercises, setExercises] = useState([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState('all');
  const [activeIdx, setActiveIdx] = useState(0);
  const [saved, setSaved] = useState([]);
  const [liked, setLiked] = useState([]);
  const itemRefs = useRef([]);

  const load = async () => {
    setLoading(true);
    const res = await base44.entities.Exercise.filter({}, { sort: '-created_date', limit: 60 });
    setExercises(res.items || []);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const filtered = category === 'all' ? exercises : exercises.filter((e) => e.category === category);

  const handleIntersect = useCallback((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        const idx = Number(entry.target.dataset.idx);
        setActiveIdx(idx);
        const vid = entry.target.querySelector('video');
        if (vid) { vid.currentTime = 0; vid.play().catch(() => {}); }
      } else {
        const vid = entry.target.querySelector('video');
        if (vid) vid.pause();
      }
    });
  }, []);

  useEffect(() => {
    const obs = new IntersectionObserver(handleIntersect, { threshold: 0.6 });
    itemRefs.current.forEach((el) => el && obs.observe(el));
    return () => obs.disconnect();
  }, [filtered, handleIntersect]);

  const addToWorkout = async (ex) => {
    await base44.entities.WorkoutTemplate.create({
      name: ex.name, category: ex.category,
      exercises: [{ name: ex.name, sets: 3, reps: '8-12', notes: ex.instructions || '' }],
    });
    setSaved((s) => [...s, ex.id]);
  };

  const toggleLike = (id) => setLiked((s) => s.includes(id) ? s.filter((x) => x !== id) : [...s, id]);

  if (loading) return <div className="h-[60vh] flex items-center justify-center text-muted-foreground">Loading feed…</div>;
  if (filtered.length === 0) return (
    <div className="h-[60vh] flex flex-col items-center justify-center text-muted-foreground text-sm">
      <Dumbbell className="w-8 h-8 mb-2 opacity-50" /> No exercises in the library yet.
    </div>
  );

  return (
    <div className="relative">
      {/* Category chips */}
      <div className="sticky top-0 z-20 flex gap-1.5 overflow-x-auto scrollbar-thin py-2 px-1 bg-background/80 backdrop-blur">
        {CATEGORIES.map((c) => (
          <button key={c} onClick={() => setCategory(c)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap capitalize ${category === c ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground'}`}>
            {c}
          </button>
        ))}
      </div>

      <div className="h-[calc(100vh-11rem)] overflow-y-auto snap-y snap-mandatory scrollbar-thin">
        {filtered.map((ex, i) => (
          <div key={ex.id} ref={(el) => (itemRefs.current[i] = el)} data-idx={i}
            className="h-[calc(100vh-11rem)] snap-start flex items-center justify-center px-4">
            <div className="relative w-full max-w-md h-full max-h-[640px] rounded-2xl overflow-hidden bg-black shadow-xl">
              {ex.video_url ? (
                <video src={ex.video_url} className="w-full h-full object-cover" loop muted playsInline preload="metadata" />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-primary/30 via-secondary to-primary/10 flex flex-col items-center justify-center p-8 text-center">
                  <Dumbbell className="w-12 h-12 text-white/80 mb-3" />
                  <p className="text-white/70 text-sm">No video attached</p>
                </div>
              )}
              {/* gradient overlay */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/20 pointer-events-none" />

              {/* side action rail */}
              <div className="absolute right-3 bottom-24 flex flex-col items-center gap-4 z-10">
                <button onClick={() => toggleLike(ex.id)} className="flex flex-col items-center">
                  <span className={`w-11 h-11 rounded-full flex items-center justify-center ${liked.includes(ex.id) ? 'bg-rose-500' : 'bg-white/20 backdrop-blur'}`}>
                    <Heart className={`w-5 h-5 ${liked.includes(ex.id) ? 'text-white fill-white' : 'text-white'}`} />
                  </span>
                </button>
                <button onClick={() => addToWorkout(ex)} className="flex flex-col items-center">
                  <span className={`w-11 h-11 rounded-full flex items-center justify-center ${saved.includes(ex.id) ? 'bg-primary' : 'bg-white/20 backdrop-blur'}`}>
                    <Plus className="w-5 h-5 text-white" />
                  </span>
                </button>
              </div>

              {/* caption */}
              <div className="absolute left-0 right-16 bottom-0 p-4 text-white z-10">
                <div className="flex items-center gap-2 mb-1">
                  <Badge variant="secondary" className="capitalize text-[10px]">{ex.category}</Badge>
                  {ex.difficulty && <Badge variant="outline" className="capitalize text-[10px] text-white border-white/40">{ex.difficulty}</Badge>}
                </div>
                <h3 className="font-bold text-lg leading-tight">{ex.name}</h3>
                <p className="text-xs opacity-90">{ex.muscle_group || '—'} · {ex.equipment || 'No equipment'}</p>
                {ex.instructions && <p className="text-xs mt-1.5 line-clamp-2 opacity-80">{ex.instructions}</p>}
                {saved.includes(ex.id) && <p className="text-[11px] mt-1 text-primary-foreground/90">✓ Added to templates</p>}
              </div>

              {/* swipe hint on first item */}
              {i === 0 && activeIdx === 0 && (
                <div className="absolute bottom-3 left-1/2 -translate-x-1/2 text-white/60 text-xs flex flex-col items-center animate-bounce">
                  <ChevronUp className="w-4 h-4" /> Swipe up
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}