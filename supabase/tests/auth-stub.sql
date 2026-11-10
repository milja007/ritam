-- Minimalni stub onoga što Supabase daje izvan naših migracija (samo za lokalni test bez Dockera):
-- uloge anon / authenticated / service_role, shema `auth` s `auth.users` i `auth.uid()`,
-- zadana prava na tablice u `public` kao na Supabaseu (RLS odlučuje o recima).
create role anon nologin noinherit;
create role authenticated nologin noinherit;
create role service_role nologin noinherit bypassrls;

create schema auth;
grant usage on schema auth to anon, authenticated, service_role;

create table auth.users (
  id uuid primary key,
  email text
);

-- Kao na Supabaseu: korisnik iz JWT claima `sub` (request.jwt.claims).
create function auth.uid()
returns uuid
language sql
stable
as $$
  select nullif(
    coalesce(
      current_setting('request.jwt.claim.sub', true),
      (current_setting('request.jwt.claims', true)::jsonb ->> 'sub')
    ),
    ''
  )::uuid
$$;

grant usage on schema public to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
