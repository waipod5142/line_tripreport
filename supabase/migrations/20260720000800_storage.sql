-- ─────────────────────────────────────────────────────────────
-- 0008 · Private attachment storage
-- One private bucket. Objects are laid out as {organization_id}/... so the
-- first path segment scopes every object to an org. The server worker uploads
-- with the service_role key (bypasses RLS) and hands out short-lived signed
-- URLs; these policies govern any direct client access.
-- ─────────────────────────────────────────────────────────────

insert into storage.buckets (id, name, public, file_size_limit)
values ('attachments', 'attachments', false, 26214400)  -- 25 MB cap
on conflict (id) do nothing;

-- Read: signed-in users may read objects under their own org's folder.
create policy "attachments_read"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'attachments'
    and (storage.foldername(name))[1] = public.auth_org_id()::text
  );

-- Write / replace / remove: org writers only, within their own folder.
create policy "attachments_insert"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'attachments'
    and (storage.foldername(name))[1] = public.auth_org_id()::text
    and public.is_org_writer()
  );

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

create policy "attachments_delete"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'attachments'
    and (storage.foldername(name))[1] = public.auth_org_id()::text
    and public.is_org_writer()
  );
