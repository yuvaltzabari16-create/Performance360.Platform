-- Exercise library migration: coach list with a video per exercise (runs on a fresh database).
select tests.check((select count(*) from public.exercises where owner_id is null and not archived) = 347, '347 exercises from the coach list are active');
select tests.check((select count(*) from public.exercises where owner_id is null and not archived and (video_url is null or video_url !~ '^https://')) = 0, 'every active system exercise has an https video link');
select tests.check((select count(*) from public.exercises where owner_id is null and not archived and video_url like 'https://www.youtube.com/%' and thumbnail_url is null) = 0, 'YouTube videos have a thumbnail');
select tests.check((select count(*) from public.exercises where owner_id is null and archived) = 37, 'older built-in exercises that are not on the list are archived, not deleted');
select tests.check((select count(*) from public.exercises where owner_id is null and archived and video_url is not null) = 0, 'archived exercises carry no list data');
select tests.check((select count(*) from (select lower(name) from public.exercises where owner_id is null and not archived group by 1 having count(*) > 1) d) = 0, 'no duplicate active exercise names');
select tests.check((select video_url from public.exercises where name = 'Zercher Squat' and owner_id is null) = 'https://www.youtube.com/watch?v=EuDizUUiHEo', 'watch links are rebuilt exactly');
select tests.check((select thumbnail_url from public.exercises where name = 'Zercher Squat' and owner_id is null) = 'https://i.ytimg.com/vi/EuDizUUiHEo/hqdefault.jpg', 'thumbnails are derived from the video id');
select tests.check((select video_url from public.exercises where name = 'Heels Elevated Wall Squats') = 'https://www.youtube.com/shorts/hL82TgLzpxg', 'Shorts links are kept as Shorts');
select tests.check((select video_url from public.exercises where name = 'Single Leg Landmine RDL') = 'https://www.youtube.com/watch?v=-La5ehYegb0&t=10s', 'start times are kept');
select tests.check((select source from public.exercises where name = 'Low Box Shuffle') like 'Detailed explanation: https://www.youtube.com/watch?v=1c3Csj3NykM', 'second video on a line is kept as the detailed explanation');
select tests.check((select video_url from public.exercises where name = 'Eccentric Rate of Force Development Examples') = 'https://sciofmultispeed.com/wp-content/uploads/2022/04/ECC-RFD.mp4' and (select thumbnail_url from public.exercises where name = 'Eccentric Rate of Force Development Examples') is null, 'non-YouTube links are kept as given, without a thumbnail');
select tests.check((select description from public.exercises where name = 'Goblet Squat' and owner_id is null) like 'Hold a weight at the chest%', 'matching built-in exercises keep their written details');
select tests.check((select count(*) from public.exercises where owner_id is null and category = 'rehab' and not archived) = 23, 'post-op knee rehab exercises are categorised as rehab');
