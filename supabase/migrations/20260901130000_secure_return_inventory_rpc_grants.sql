-- Keep security-definer functions callable only through their intended
-- authenticated workflows. Trigger-only functions are intentionally not
-- executable by API roles.
revoke all on function public.sync_legacy_size_inventory_notification() from public, anon, authenticated;
revoke all on function public.close_delivery_after_return_pickup() from public, anon, authenticated;

revoke all on function public.cancel_order_and_restore_inventory(uuid) from public, anon, authenticated;
grant execute on function public.cancel_order_and_restore_inventory(uuid) to service_role;

revoke all on function public.request_return_handoff(uuid, text) from public, anon;
revoke all on function public.verify_return_handoff(uuid, text, text) from public, anon;
revoke all on function public.shopper_return_handoff_code(uuid) from public, anon;
revoke all on function public.store_return_handoff_code(uuid) from public, anon;
grant execute on function public.request_return_handoff(uuid, text) to authenticated;
grant execute on function public.verify_return_handoff(uuid, text, text) to authenticated;
grant execute on function public.shopper_return_handoff_code(uuid) to authenticated;
grant execute on function public.store_return_handoff_code(uuid) to authenticated;

revoke all on function public.founder_refund_data() from public, anon;
revoke all on function public.founder_mark_refund_sent(uuid, text, text) from public, anon;
grant execute on function public.founder_refund_data() to authenticated;
grant execute on function public.founder_mark_refund_sent(uuid, text, text) to authenticated;

revoke all on function public.shopper_order_delivery_tracking(uuid) from public, anon;
revoke all on function public.advance_return_job(uuid, text, text) from public, anon;
revoke all on function public.driver_delivery_workspace_data() from public, anon;
grant execute on function public.shopper_order_delivery_tracking(uuid) to authenticated;
grant execute on function public.advance_return_job(uuid, text, text) to authenticated;
grant execute on function public.driver_delivery_workspace_data() to authenticated, service_role;

-- Refund processing is now founder-owned. The legacy owner-callable RPC is
-- retained for historical compatibility but cannot be invoked by API users.
revoke all on function public.mark_return_refund_processed(uuid, text, text) from public, anon, authenticated;

-- Preserve the intended driver-only API boundary for the delivery transition.
revoke all on function public.advance_delivery_job(uuid, public.delivery_job_status, text) from public, anon;
grant execute on function public.advance_delivery_job(uuid, public.delivery_job_status, text) to authenticated;
