-- Academy payments (owners only) and athlete meal logs (athlete writes, their staff read and comment).

\set dir    '''bbbb0000-0000-0000-0000-000000000001'''
\set coach  '''bbbb0000-0000-0000-0000-000000000002'''
\set ath    '''bbbb0000-0000-0000-0000-000000000003'''
\set ath2   '''bbbb0000-0000-0000-0000-000000000004'''
\set odir   '''bbbb0000-0000-0000-0000-000000000005'''
\set out    '''bbbb0000-0000-0000-0000-000000000006'''

insert into auth.users (id, email, raw_user_meta_data) values
  (:dir, 'dir@pay.test', '{}'), (:coach, 'coach@pay.test', '{}'), (:ath, 'ath@pay.test', '{}'),
  (:ath2, 'ath2@pay.test', '{}'), (:odir, 'odir@pay.test', '{}'), (:out, 'out@pay.test', '{}');

set role authenticated;
set request.jwt.claim.sub = :dir;
select public.create_organization('Pay Academy', null, 'Dir Pay');
select public.create_staff_invite('head_coach') as i1 \gset
select code as team_code from public.organization_codes where kind = 'athlete' and status = 'active' \gset
set request.jwt.claim.sub = :coach;
select public.join_organization(:'i1', 'Coach Pay');
set request.jwt.claim.sub = :ath;
select public.complete_onboarding('athlete', 'Ath One');
select public.connect_with_org_code(:'team_code');
select id as rec from public.athletes where user_id = auth.uid() \gset
set request.jwt.claim.sub = :ath2;
select public.complete_onboarding('athlete', 'Ath Two');
select public.connect_with_org_code(:'team_code');
select id as rec2 from public.athletes where user_id = auth.uid() \gset
set request.jwt.claim.sub = :odir;
select public.create_organization('Other Academy', null, 'Other Dir');
select code as other_code from public.organization_codes where kind = 'athlete' and status = 'active' \gset
set request.jwt.claim.sub = :out;
select public.complete_onboarding('athlete', 'Outsider');
select public.connect_with_org_code(:'other_code');
select id as outrec from public.athletes where user_id = auth.uid() \gset

-- ----- payments -------------------------------------------------------------------------------
set request.jwt.claim.sub = :dir;
select public.record_payment(:'rec', 'October fee', 350, 'ILS', '2026-10-01') as p1 \gset
select tests.check((select paid_on is null and method is null from public.athlete_payments where id = :'p1'), 'a new payment is unpaid');
select public.record_payment(:'rec2', 'Kit', 120, 'ILS', '2026-10-05', '2026-10-05', 'cash', 'Paid at training') as p2 \gset
select tests.check((select method = 'cash' from public.athlete_payments where id = :'p2'), 'a payment can be recorded as already paid');
select tests.check(public.charge_roster('November fee', 350, 'ILS', '2026-11-01') = 2, 'charging the roster creates one payment per roster athlete');
select tests.check((select count(*) from public.athlete_payments) = 4, 'the owner reads the academy payments');
select public.set_payment_paid(:'p1', '2026-10-03', 'bank_transfer');
select tests.check((select paid_on = '2026-10-03' and method = 'bank_transfer' from public.athlete_payments where id = :'p1'), 'the owner marks a payment paid');
select public.set_payment_paid(:'p1', null);
select tests.check((select paid_on is null and method is null from public.athlete_payments where id = :'p1'), 'and back to unpaid');
select tests.throws(format($$select public.record_payment(%L, 'x', 10, 'ILS', current_date)$$, :'outrec')) as off_roster \gset
select tests.check(:'off_roster'::boolean, 'no payments for athletes outside the roster');
select tests.throws(format($$select public.record_payment(%L, 'x', 0, 'ILS', current_date)$$, :'rec')) as zero \gset
select tests.check(:'zero'::boolean, 'amounts must be positive');
select tests.throws(format($$select public.record_payment(%L, 'x', 10, 'BTC', current_date)$$, :'rec')) as cur \gset
select tests.check(:'cur'::boolean, 'only the listed currencies');
select tests.throws($$insert into public.athlete_payments (org_id, athlete_id, description, amount, due_date)
  select org_id, athlete_id, 'direct', 1, current_date from public.athlete_payments limit 1$$) as direct_insert \gset
select tests.check(:'direct_insert'::boolean, 'payments are only written through the functions');

set request.jwt.claim.sub = :coach;
select tests.check((select count(*) from public.athlete_payments) = 0, 'coaches who are not owners do not see payments');
select tests.throws(format($$select public.record_payment(%L, 'x', 10, 'ILS', current_date)$$, :'rec')) as coach_rec \gset
select tests.check(:'coach_rec'::boolean, 'staff cannot record payments');
select tests.throws(format($$select public.set_payment_paid(%L, current_date)$$, :'p1')) as coach_paid \gset
select tests.check(:'coach_paid'::boolean, 'staff cannot mark payments paid');

set request.jwt.claim.sub = :ath;
select tests.check((select count(*) from public.athlete_payments) = 0, 'athletes do not see the payments table');

set request.jwt.claim.sub = :odir;
select tests.check((select count(*) from public.athlete_payments) = 0, 'another academy''s owner sees nothing');
select tests.throws(format($$select public.delete_payment(%L)$$, :'p1')) as other_del \gset
select tests.check(:'other_del'::boolean, 'another academy''s owner cannot delete');

set request.jwt.claim.sub = :dir;
select public.delete_payment(:'p2');
select tests.check((select count(*) from public.athlete_payments where id = :'p2') = 0, 'the owner deletes a payment');

-- ----- meals ----------------------------------------------------------------------------------
set request.jwt.claim.sub = :ath;
insert into public.meal_logs (athlete_id, meal_type, description, calories, protein_g) values (:'rec', 'breakfast', 'Oats and eggs', 550, 32);
select id as meal from public.meal_logs where athlete_id = :'rec' \gset
select tests.check((select count(*) from public.meal_logs) = 1, 'the athlete logs and reads a meal');
update public.meal_logs set calories = 600 where id = :'meal';
select tests.check((select calories = 600 from public.meal_logs where id = :'meal'), 'the athlete edits their meal');
select tests.throws(format($$insert into public.meal_logs (athlete_id, meal_type, description) values (%L, 'lunch', 'x')$$, :'rec2')) as other_meal \gset
select tests.check(:'other_meal'::boolean, 'an athlete cannot log meals for someone else');
select tests.throws(format($$update public.meal_logs set coach_comment = 'self praise' where id = %L$$, :'meal')) as self_comment \gset
select tests.check(:'self_comment'::boolean, 'the athlete cannot write the coach comment');
select public.add_attachment('meal', :'meal', null, 'breakfast.jpg', '\xffd8ffe0'::bytea) as photo \gset
select public.set_meal_photo(:'meal', :'photo');
select tests.check((select photo_id = :'photo' from public.meal_logs where id = :'meal'), 'the athlete adds a meal photo');
select tests.throws(format($$select public.add_attachment('meal', %L, null, 'menu.pdf', '\x255044462d'::bytea)$$, :'meal')) as pdf \gset
select tests.check(:'pdf'::boolean, 'meal photos must be images');

set request.jwt.claim.sub = :coach;
select tests.check((select count(*) from public.meal_logs) = 1, 'staff who work with the athlete read the meal log');
select tests.check((select count(*) from public.attachments where kind = 'meal') = 1, 'and the meal photo');
select public.comment_on_meal(:'meal', 'Good protein, add fruit');
select tests.check((select coach_comment = 'Good protein, add fruit' and commented_by = :coach from public.meal_logs where id = :'meal'), 'staff comment on a meal');
update public.meal_logs set calories = 1 where id = :'meal';
select tests.check((select calories = 600 from public.meal_logs where id = :'meal'), 'staff cannot change the meal itself');
select tests.throws(format($$select public.add_attachment('meal', %L, null, 'x.jpg', '\xffd8ffe0'::bytea)$$, :'meal')) as coach_photo \gset
select tests.check(:'coach_photo'::boolean, 'staff cannot add meal photos');

set request.jwt.claim.sub = :dir;
select tests.check((select count(*) from public.meal_logs) = 1, 'the owner coach reads the meal log like any coach');
select tests.check((select count(*) from public.attachments where kind = 'meal') = 1, 'and the photo');

set request.jwt.claim.sub = :ath2;
select tests.check((select count(*) from public.meal_logs) = 0, 'other athletes do not see the meal');
select tests.check((select count(*) from public.attachments where kind = 'meal') = 0, 'or its photo');

set request.jwt.claim.sub = :ath;
delete from public.meal_logs where id = :'meal';
select tests.check((select count(*) from public.meal_logs) = 0, 'the athlete deletes their meal');
reset role;
select tests.check((select count(*) from public.attachments where kind = 'meal') = 0, 'its photo is removed with it');
