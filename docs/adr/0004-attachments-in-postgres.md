# ADR 0004: Attachments are stored in Postgres for now

Status: accepted, to be revisited

Files (documents and images, up to 5 MB, a fixed list of types) are stored in `public.attachments` so they
inherit the access rules of the record they belong to and can be tested with the same SQL tests. They are
only served as downloads with a type fixed from the extension. Trade-offs: database size grows and there is
no virus scanning. Plan: move to Supabase Storage with scanning and signed URLs before large-scale use.
