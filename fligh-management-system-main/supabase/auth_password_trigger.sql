-- Safe migration for an existing database.
-- Run this instead of schema.sql if the application tables already contain data.

create extension if not exists pgcrypto with schema extensions;

create or replace function public.hash_app_user_password()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if new.password_hash is null or new.password_hash = '' then
    raise exception 'password_hash is required';
  end if;

  if new.password_hash not like '$2%' then
    new.password_hash := extensions.crypt(new.password_hash, extensions.gen_salt('bf'));
  end if;

  return new;
end;
$$;

drop trigger if exists app_users_hash_password on public.app_users;
create trigger app_users_hash_password
before insert or update of password_hash on public.app_users
for each row execute function public.hash_app_user_password();

-- Hash any existing plaintext values once. Existing bcrypt values are unchanged.
update public.app_users
set password_hash = password_hash
where password_hash not like '$2%';