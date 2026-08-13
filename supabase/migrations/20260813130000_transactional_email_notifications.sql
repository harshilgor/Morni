create table if not exists public.email_notifications (
  id uuid primary key default gen_random_uuid(),
  event_type text not null check (event_type in ('welcome', 'order_confirmation', 'order_status')),
  entity_id text not null,
  recipient_id uuid not null references public.profiles (id) on delete cascade,
  recipient_email text not null,
  status text not null default 'pending' check (status in ('pending', 'sent', 'failed')),
  resend_id text,
  error_message text,
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  unique (event_type, entity_id)
);

create index if not exists email_notifications_recipient_created_idx
  on public.email_notifications (recipient_id, created_at desc);

alter table public.email_notifications enable row level security;

-- Notifications are managed only by Morni's server. Customer emails and provider IDs
-- never become available through the browser-facing Supabase client.

drop policy if exists "orders_owner_update" on public.orders;
