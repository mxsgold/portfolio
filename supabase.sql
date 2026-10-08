insert into storage.buckets (id,name,public) values ('videos','videos',true) on conflict (id) do update set public=true;
drop policy if exists "RAVE public video uploads" on storage.objects;
create policy "RAVE public video uploads" on storage.objects for insert to anon,authenticated with check(bucket_id='videos');
drop policy if exists "RAVE public video reads" on storage.objects;
create policy "RAVE public video reads" on storage.objects for select to anon,authenticated using(bucket_id='videos');