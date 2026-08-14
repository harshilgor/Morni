-- Bootstrap the two approved Founder Workspace administrators.
-- This migration is intentionally idempotent and does not create auth users.

update public.profiles as profile
set role = 'admin'::public.user_role,
    updated_at = now()
from auth.users as user_account
where profile.id = user_account.id
  and lower(user_account.email) in (
    'harshilgor06@gmail.com',
    'rangwaniprisha@gmail.com'
  );
