-- Ensure the avatars bucket is public
update storage.buckets set public = true where id = 'avatars';

-- Drop policies first so this migration is idempotent
drop policy if exists "avatars_insert_own" on storage.objects;
drop policy if exists "avatars_update_own" on storage.objects;
drop policy if exists "avatars_select_public" on storage.objects;
drop policy if exists "avatars_delete_own" on storage.objects;

-- Allow authenticated users to upload their own avatar
create policy "avatars_insert_own"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow authenticated users to update/replace their own avatar
create policy "avatars_update_own"
on storage.objects for update
to authenticated
using (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow public read access so profile pictures are visible to everyone
create policy "avatars_select_public"
on storage.objects for select
to public
using (bucket_id = 'avatars');

-- Allow users to delete their own avatar
create policy "avatars_delete_own"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
);
