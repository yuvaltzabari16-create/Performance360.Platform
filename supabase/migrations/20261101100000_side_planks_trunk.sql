-- Exercise library: the coach-provided list has "Side Planks" twice with two different videos, one under
-- Abductor Isolation / Side Planks and one under Plank Variations. The original import merged them into
-- "Side Plank" with the first video. The Plank Variations one is now its own exercise with its own video,
-- and "Side Plank" keeps only its abductor section. Safe to run more than once.

insert into public.exercises (owner_id, name, category, movement_pattern, primary_muscles, equipment, difficulty,
                              video_url, thumbnail_url, tags, source)
select null, 'Side Planks (trunk)', 'core', 'Anti-extension / anti-lateral flexion', array['obliques', 'trunk'], array['bodyweight'],
       'intermediate', 'https://www.youtube.com/watch?v=8IezdSwQhkk', 'https://i.ytimg.com/vi/8IezdSwQhkk/hqdefault.jpg',
       array['trunk / core / abs', 'plank variations'], 'Performance360 exercise library'
 where not exists (select 1 from public.exercises where owner_id is null and name = 'Side Planks (trunk)');

update public.exercises
   set tags = array_remove(tags, 'plank variations')
 where owner_id is null and name = 'Side Plank' and 'plank variations' = any (tags);
