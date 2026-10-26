-- File attachments: who can add and read files per category.

\set dir    '''aaaa0000-0000-0000-0000-000000000001'''
\set hop    '''aaaa0000-0000-0000-0000-000000000002'''
\set physio '''aaaa0000-0000-0000-0000-000000000003'''
\set ath    '''aaaa0000-0000-0000-0000-000000000004'''
\set out    '''aaaa0000-0000-0000-0000-000000000005'''

insert into auth.users (id, email, raw_user_meta_data) values
  (:dir, 'dir@att.test', '{}'), (:hop, 'hop@att.test', '{}'), (:physio, 'physio@att.test', '{}'), (:ath, 'ath@att.test', '{}'), (:out, 'out@att.test', '{}');

set role authenticated;
set request.jwt.claim.sub = :dir;
select public.create_organization('Att FC', null, 'Dir Att');
select public.create_staff_invite('head_of_performance') as i1 \gset
select public.create_staff_invite('physiotherapist') as i2 \gset
select code as team_code from public.organization_codes where kind = 'athlete' and status = 'active' \gset
set request.jwt.claim.sub = :hop;
select public.join_organization(:'i1', 'Hop Att');
set request.jwt.claim.sub = :physio;
select public.join_organization(:'i2', 'Physio Att');
set request.jwt.claim.sub = :ath;
select public.complete_onboarding('athlete', 'Att Athlete');
select public.connect_with_org_code(:'team_code');
select id as rec from public.athletes where user_id = auth.uid() \gset
select public.report_injury(:'rec', 'knee', null, null, null, null, null, null, null, 'Sore') as inj \gset
set request.jwt.claim.sub = :out;
select public.complete_onboarding('athlete', 'Out Att');

-- ----- injury documents ----------------------------------------------------------------
set request.jwt.claim.sub = :ath;
select public.add_attachment('injury', :'inj', null, 'MRI report.pdf', '\x255044462d'::bytea) as a1 \gset
select tests.check((select athlete_id = :'rec' from public.attachments where id = :'a1'), 'an injury file takes the athlete from the injury');
select tests.check((select mime_type from public.attachments where id = :'a1') = 'application/pdf', 'the type is fixed from the extension');
select tests.throws($$select public.add_attachment('injury', gen_random_uuid(), null, 'x.pdf', '\x00'::bytea)$$) as bad_ref \gset
select tests.check(:'bad_ref'::boolean, 'cannot attach to something that does not exist');
select tests.throws(format($$select public.add_attachment('injury', %L, null, 'virus.exe', '\x00'::bytea)$$, :'inj')) as bad_type \gset
select tests.check(:'bad_type'::boolean, 'file types outside the list are rejected');
select tests.throws(format($$select public.add_attachment('injury', %L, null, 'page.svg', '\x00'::bytea)$$, :'inj')) as svg \gset
select tests.check(:'svg'::boolean, 'svg is not accepted');
select tests.throws(format($$select public.add_attachment('injury', %L, null, 'empty.pdf', ''::bytea)$$, :'inj')) as empty_file \gset
select tests.check(:'empty_file'::boolean, 'empty files are rejected');
select tests.throws(format($$select public.add_attachment('injury', %L, null, 'big.pdf', decode(repeat('00', 5242881), 'hex'))$$, :'inj')) as big \gset
select tests.check(:'big'::boolean, 'files over 5 MB are rejected');

set request.jwt.claim.sub = :physio;
select tests.check((select count(*) from public.attachments) = 1, 'the physiotherapist reads injury files');
select public.add_attachment('injury', :'inj', null, 'plan.docx', '\x504b0304'::bytea) as a2 \gset
select tests.check((select count(*) from public.attachments) = 2, 'the physiotherapist attaches files');

set request.jwt.claim.sub = :dir;
select tests.check((select count(*) from public.attachments) = 2, 'the director reads injury files');
select tests.throws(format($$select public.add_attachment('injury', %L, null, 'x.pdf', '\x00'::bytea)$$, :'inj')) as dir_add \gset
select tests.check(:'dir_add'::boolean, 'the director cannot attach');
select tests.throws(format($$select public.remove_attachment(%L)$$, :'a1')) as dir_rm \gset
select tests.check(:'dir_rm'::boolean, 'only the uploader removes a file');

set request.jwt.claim.sub = :out;
select tests.check((select count(*) from public.attachments) = 0, 'outsiders see no files');
select tests.throws(format($$select public.add_attachment('injury', %L, null, 'x.pdf', '\x00'::bytea)$$, :'inj')) as out_add \gset
select tests.check(:'out_add'::boolean, 'outsiders cannot attach');

-- ----- testing and athlete documents ----------------------------------------------------
set request.jwt.claim.sub = :hop;
select public.add_attachment('test', :'rec', :'rec', 'cmj.csv', '\x612c62'::bytea) as t1 \gset
set request.jwt.claim.sub = :ath;
select tests.check((select count(*) from public.attachments where kind = 'test') = 1, 'the athlete reads their own testing documents');
select tests.throws(format($$select public.add_attachment('test', %L, %L, 'x.csv', '\x00'::bytea)$$, :'rec', :'rec')) as ath_test \gset
select tests.check(:'ath_test'::boolean, 'athletes cannot attach testing documents');
select public.add_attachment('athlete', :'rec', :'rec', 'consent.pdf', '\x255044462d'::bytea);
select tests.check((select count(*) from public.attachments where kind = 'athlete') = 1, 'the athlete adds their own documents');

-- ----- messages -----------------------------------------------------------------------------
set request.jwt.claim.sub = :hop;
select public.send_message(:ath, 'See the attached') as msg \gset
select public.add_attachment('message', :'msg', null, 'plan.pdf', '\x255044462d'::bytea) as m1 \gset
set request.jwt.claim.sub = :ath;
select tests.check((select count(*) from public.attachments where kind = 'message') = 1, 'the recipient reads a message file');
select tests.throws(format($$select public.add_attachment('message', %L, null, 'x.pdf', '\x00'::bytea)$$, :'msg')) as not_sender \gset
select tests.check(:'not_sender'::boolean, 'only the sender attaches to a message');
set request.jwt.claim.sub = :physio;
select tests.check((select count(*) from public.attachments where kind = 'message') = 0, 'a third person does not read message files');

-- ----- removal ------------------------------------------------------------------------------
set request.jwt.claim.sub = :ath;
select public.remove_attachment(:'a1');
select tests.check((select count(*) from public.attachments where id = :'a1') = 0, 'the uploader removes their file');

set role anon;
select tests.throws($$select public.add_attachment('athlete', gen_random_uuid(), gen_random_uuid(), 'x.pdf', '\x00'::bytea)$$) as anon_add \gset
reset role;
select tests.check(:'anon_add'::boolean, 'anonymous users cannot attach');
