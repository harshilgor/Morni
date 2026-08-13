-- Prevent direct role changes without making profile updates depend on a
-- self-referencing RLS query. Security-definer onboarding functions continue
-- to run as the database owner and can promote a shopper to store_owner.

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

revoke update on public.profiles from anon, authenticated;
grant update (full_name, phone) on public.profiles to authenticated;
