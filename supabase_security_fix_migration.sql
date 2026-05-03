-- Security fix: prevent privilege escalation via user_profiles self-update.
-- Apply in Supabase SQL editor.

-- 1. Drop the over-permissive self-update policy.
drop policy if exists profiles_self_update on public.user_profiles;

-- 2. Re-create it WITHOUT allowing role changes. Users can update their own
--    row but the role column is locked to its current value.
create policy profiles_self_update on public.user_profiles
  for update
  to authenticated
  using (id = auth.uid())
  with check (
    id = auth.uid()
    and role = (select role from public.user_profiles where id = auth.uid())
  );

-- 3. (Defense in depth) Trigger that blocks any role change unless performed
--    by the service role / a SECURITY DEFINER function.
create or replace function public.prevent_role_self_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if NEW.role is distinct from OLD.role then
    -- Allow only when there is no auth.uid() (service role / trigger context).
    if auth.uid() is not null and auth.uid() = OLD.id then
      raise exception 'role changes are not permitted from the client';
    end if;
  end if;
  return NEW;
end;
$$;

drop trigger if exists trg_prevent_role_self_change on public.user_profiles;
create trigger trg_prevent_role_self_change
  before update on public.user_profiles
  for each row execute function public.prevent_role_self_change();
