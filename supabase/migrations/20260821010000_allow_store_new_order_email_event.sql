-- Allow transactional emails notifying store members when a new order is placed.
alter table public.email_notifications
  drop constraint if exists email_notifications_event_type_check;

alter table public.email_notifications
  add constraint email_notifications_event_type_check
  check (event_type in ('welcome', 'order_confirmation', 'order_status', 'store_new_order'));
