-- HudumaDesk database setup for a Supabase project.
-- Run this file in Supabase Dashboard > SQL Editor as the project owner.

create sequence if not exists public.request_reference_seq;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default 'Citizen' check (char_length(full_name) between 2 and 100),
  role text not null default 'citizen' check (role in ('citizen', 'admin')),
  created_at timestamptz not null default now()
);

create or replace function public.generate_request_reference()
returns text
language sql
volatile
security definer
set search_path = ''
as $$
  select 'HD-' || to_char((now() at time zone 'Africa/Nairobi')::date, 'YYYYMMDD')
    || '-' || lpad(ref.sequence_value::text, greatest(6, char_length(ref.sequence_value::text)), '0')
  from (select nextval('public.request_reference_seq') as sequence_value) as ref;
$$;

revoke all on function public.generate_request_reference() from public, anon;
grant execute on function public.generate_request_reference() to authenticated;

create table if not exists public.requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  reference_number text not null unique default public.generate_request_reference(),
  category text not null check (category in (
    'Roads & Transport', 'Water & Sewage', 'Waste Collection',
    'Public Health', 'Street Lighting', 'Drainage', 'Other'
  )),
  location text not null check (char_length(location) between 3 and 160),
  description text not null check (char_length(description) between 12 and 1200),
  image_path text,
  latitude double precision,
  longitude double precision,
  constraint requests_coordinates_pair_range_check check (
    (latitude is null and longitude is null)
    or (
      latitude is not null and longitude is not null
      and latitude between -90 and 90
      and longitude between -180 and 180
    )
  ),
  status text not null default 'Pending' check (status in ('Pending', 'In Progress', 'Resolved')),
  created_at timestamptz not null default now()
);

-- Also upgrade a database where the earlier HudumaDesk schema was already applied.
alter table public.requests add column if not exists latitude double precision;
alter table public.requests add column if not exists longitude double precision;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.requests'::regclass
      and conname = 'requests_coordinates_pair_range_check'
  ) then
    alter table public.requests
      add constraint requests_coordinates_pair_range_check check (
        (latitude is null and longitude is null)
        or (
          latitude is not null and longitude is not null
          and latitude between -90 and 90
          and longitude between -180 and 180
        )
      );
  end if;
end;
$$;

create index if not exists requests_user_created_idx on public.requests (user_id, created_at desc);
create index if not exists requests_status_created_idx on public.requests (status, created_at desc);

create or replace function public.create_citizen_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  submitted_name text;
begin
  submitted_name := trim(new.raw_user_meta_data ->> 'full_name');
  insert into public.profiles (id, full_name, role)
  values (
    new.id,
    case when char_length(submitted_name) between 2 and 100 then submitted_name else 'Citizen' end,
    'citizen'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

revoke all on function public.create_citizen_profile() from public, anon, authenticated;
drop trigger if exists on_auth_user_created_hudumadesk on auth.users;
create trigger on_auth_user_created_hudumadesk
after insert on auth.users
for each row execute function public.create_citizen_profile();

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles
    where id = (select auth.uid())
      and role = 'admin'
  );
$$;

revoke all on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;

alter table public.profiles enable row level security;
alter table public.requests enable row level security;

drop policy if exists "Profiles visible to owner or administrator" on public.profiles;
create policy "Profiles visible to owner or administrator"
on public.profiles for select to authenticated
using (id = (select auth.uid()) or (select public.is_admin()));

-- New profiles are created only by the auth.users trigger with role = 'citizen'.
-- Clients have no profile insert or update grant, so they cannot promote themselves.

drop policy if exists "Citizens read their own requests; administrators read all" on public.requests;
create policy "Citizens read their own requests; administrators read all"
on public.requests for select to authenticated
using (user_id = (select auth.uid()) or (select public.is_admin()));

drop policy if exists "Citizens submit their own pending requests" on public.requests;
create policy "Citizens submit their own pending requests"
on public.requests for insert to authenticated
with check (user_id = (select auth.uid()) and status = 'Pending');

drop policy if exists "Citizens attach images to their own pending requests" on public.requests;
create policy "Citizens attach images to their own pending requests"
on public.requests for update to authenticated
using (user_id = (select auth.uid()) and status = 'Pending')
with check (
  user_id = (select auth.uid())
  and status = 'Pending'
  and (image_path is null or image_path like (select auth.uid())::text || '/%')
);

drop policy if exists "Administrators update request status" on public.requests;
create policy "Administrators update request status"
on public.requests for update to authenticated
using ((select public.is_admin()))
with check (
  (select public.is_admin())
  and status in ('In Progress', 'Resolved')
);

revoke all on table public.profiles from anon, authenticated;
revoke all on table public.requests from anon, authenticated;
grant select on table public.profiles to authenticated;
grant select on table public.requests to authenticated;
-- Coordinates can be set on insert only; existing owner/admin RLS rules govern who may read them.
grant insert (user_id, category, location, description, latitude, longitude) on table public.requests to authenticated;
-- Column grants and RLS together prevent citizens from changing status or request details.
grant update (image_path, status) on table public.requests to authenticated;

-- Optional photos are stored in a private bucket under <user-id>/<request-id>/...
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('request-attachments', 'request-attachments', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Citizens upload request images to their own folder" on storage.objects;
create policy "Citizens upload request images to their own folder"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'request-attachments'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

drop policy if exists "Owners and administrators read request images" on storage.objects;
create policy "Owners and administrators read request images"
on storage.objects for select to authenticated
using (
  bucket_id = 'request-attachments'
  and (
    (storage.foldername(name))[1] = (select auth.uid())::text
    or (select public.is_admin())
  )
);

drop policy if exists "Citizens remove images in their own folder" on storage.objects;
create policy "Citizens remove images in their own folder"
on storage.objects for delete to authenticated
using (
  bucket_id = 'request-attachments'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);
