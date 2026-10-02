-- ─────────────────────────────────────────────────────────────
-- 0015 · Restore private attachment storage
--
-- The storage side of the project came back empty after the 2026-08-24
-- outage: storage.buckets held no 'attachments' bucket and storage.objects
-- carried none of the four attachments_* policies from migration 0008.
-- The ledger still lists 0008 as applied, so `db push` will never replay it —
-- hence this migration, which re-states 0008 idempotently.
--
-- Object layout is unchanged: {organization_id}/{message_id}/{filename}, so
-- the first path segment scopes every object to an org. The worker uploads
-- with the service_role key (bypasses RLS) and hands out short-lived signed
-- URLs; these policies govern any direct client access.
-- ─────────────────────────────────────────────────────────────

insert into storage.buckets (id, name, public, file_size_limit)
values ('attachments', 'attachments', false, 26214400)  -- 25 MB cap
on conflict (id) do update
  set public          = excluded.public,
      file_size_limit = excluded.file_size_limit;

-- Read: signed-in users may read objects under their own org's folder.
drop policy if exists "attachments_read" on storage.objects;
create policy "attachments_read"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'attachments'
    and (storage.foldername(name))[1] = public.auth_org_id()::text
  );

-- Write / replace / remove: org writers only, within their own folder.
drop policy if exists "attachments_insert" on storage.objects;
create policy "attachments_insert"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'attachments'
    and (storage.foldername(name))[1] = public.auth_org_id()::text
    and public.is_org_writer()
  );

drop policy if exists "attachments_update" on storage.objects;
create policy "attachments_update"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'attachments'
    and (storage.foldername(name))[1] = public.auth_org_id()::text
    and public.is_org_writer()
  )
  with check (
    bucket_id = 'attachments'
    and (storage.foldername(name))[1] = public.auth_org_id()::text
    and public.is_org_writer()
  );

drop policy if exists "attachments_delete" on storage.objects;
create policy "attachments_delete"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'attachments'
    and (storage.foldername(name))[1] = public.auth_org_id()::text
    and public.is_org_writer()
  );
