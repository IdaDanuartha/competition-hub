-- Create competition-documents bucket in Supabase Storage for PDF guidebooks
insert into storage.buckets (id, name, public)
values ('competition-documents', 'competition-documents', true)
on conflict (id) do update set public = true;

-- Allow public read access to documents
create policy "Public Access Competition Documents"
  on storage.objects for select
  using ( bucket_id = 'competition-documents' );

-- Allow authenticated users to upload documents
create policy "Authenticated User Upload Competition Documents"
  on storage.objects for insert
  with check ( bucket_id = 'competition-documents' );

-- Allow authenticated users to delete documents
create policy "Authenticated User Delete Competition Documents"
  on storage.objects for delete
  using ( bucket_id = 'competition-documents' );
