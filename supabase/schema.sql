create extension if not exists pgcrypto;

create table if not exists public.households (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 80),
  invite_code text not null unique check (invite_code ~ '^[A-Z0-9]{12}$'),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);

create table if not exists public.household_members (
  household_id uuid not null references public.households(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (household_id, user_id)
);

create index if not exists household_members_user_id_idx on public.household_members (user_id);

create table if not exists public.household_state (
  household_id uuid primary key references public.households(id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);

create or replace function public.touch_household_state()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists household_state_touch on public.household_state;
create trigger household_state_touch before update on public.household_state
for each row execute function public.touch_household_state();

create or replace function public.is_household_member(p_household_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.household_members
    where household_id = p_household_id and user_id = (select auth.uid())
  );
$$;

revoke all on function public.is_household_member(uuid) from public;
grant execute on function public.is_household_member(uuid) to authenticated;

alter table public.households enable row level security;
alter table public.household_members enable row level security;
alter table public.household_state enable row level security;

drop policy if exists households_select_member on public.households;
create policy households_select_member on public.households for select to authenticated
using ((select public.is_household_member(id)));

drop policy if exists members_select_self on public.household_members;
create policy members_select_self on public.household_members for select to authenticated
using (user_id = (select auth.uid()));

drop policy if exists state_select_member on public.household_state;
create policy state_select_member on public.household_state for select to authenticated
using ((select public.is_household_member(household_id)));

drop policy if exists state_insert_member on public.household_state;
create policy state_insert_member on public.household_state for insert to authenticated
with check ((select public.is_household_member(household_id)));

drop policy if exists state_update_member on public.household_state;
create policy state_update_member on public.household_state for update to authenticated
using ((select public.is_household_member(household_id)))
with check ((select public.is_household_member(household_id)));

create or replace function public.create_household(p_name text)
returns table (household_id uuid, invite_code text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid := gen_random_uuid();
  v_code text;
begin
  if (select auth.uid()) is null then raise exception 'Login mangler'; end if;
  loop
    v_code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12));
    begin
      insert into public.households (id, name, invite_code, created_by)
      values (v_id, coalesce(nullif(trim(p_name), ''), 'Vores hjem'), v_code, (select auth.uid()));
      exit;
    exception when unique_violation then
      continue;
    end;
  end loop;
  insert into public.household_members (household_id, user_id) values (v_id, (select auth.uid()));
  insert into public.household_state (household_id, data, updated_by) values (v_id, '{}'::jsonb, (select auth.uid()));
  return query select v_id, v_code;
end;
$$;

create or replace function public.join_household(p_invite_code text)
returns table (household_id uuid, invite_code text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_code text := upper(replace(trim(p_invite_code), ' ', ''));
begin
  if (select auth.uid()) is null then raise exception 'Login mangler'; end if;
  select id into v_id from public.households where households.invite_code = v_code;
  if v_id is null then raise exception 'Invitationskoden blev ikke fundet'; end if;
  insert into public.household_members (household_id, user_id)
  values (v_id, (select auth.uid())) on conflict do nothing;
  return query select v_id, v_code;
end;
$$;

revoke all on function public.create_household(text) from public;
revoke all on function public.join_household(text) from public;
grant execute on function public.create_household(text) to authenticated;
grant execute on function public.join_household(text) to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('payslips', 'payslips', false, 10485760, array['application/pdf'])
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists payslips_select_member on storage.objects;
create policy payslips_select_member on storage.objects for select to authenticated
using (
  bucket_id = 'payslips'
  and (select public.is_household_member(((storage.foldername(name))[1])::uuid))
);

drop policy if exists payslips_insert_member on storage.objects;
create policy payslips_insert_member on storage.objects for insert to authenticated
with check (
  bucket_id = 'payslips'
  and (select public.is_household_member(((storage.foldername(name))[1])::uuid))
);

drop policy if exists payslips_delete_member on storage.objects;
create policy payslips_delete_member on storage.objects for delete to authenticated
using (
  bucket_id = 'payslips'
  and (select public.is_household_member(((storage.foldername(name))[1])::uuid))
);

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'household_state'
  ) then
    alter publication supabase_realtime add table public.household_state;
  end if;
end $$;
