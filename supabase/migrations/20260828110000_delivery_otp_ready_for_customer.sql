-- Generate the customer's delivery OTP when the delivery job is created. The
-- code is then already available on order tracking before the rider arrives.
create or replace function public.queue_order_for_delivery(p_order_id uuid)
returns public.delivery_jobs
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_order public.orders;
  v_job public.delivery_jobs;
  v_code text;
begin
  select * into v_order from public.orders where id = p_order_id for update;
  if not found then raise exception 'Order not found.'; end if;

  select * into v_job from public.delivery_jobs where order_id = p_order_id for update;
  if found then
    if not exists (select 1 from public.delivery_handoffs where delivery_job_id = v_job.id and handoff_type = 'pickup') then
      v_code := lpad((floor(random() * 1000000))::int::text, 6, '0');
      insert into public.delivery_handoffs (delivery_job_id, handoff_type, otp_code, otp_hash)
      values (v_job.id, 'pickup', v_code, encode(digest(v_code, 'sha256'), 'hex'));
    end if;
    if not exists (select 1 from public.delivery_handoffs where delivery_job_id = v_job.id and handoff_type = 'delivery') then
      v_code := lpad((floor(random() * 1000000))::int::text, 6, '0');
      insert into public.delivery_handoffs (delivery_job_id, handoff_type, otp_code, otp_hash)
      values (v_job.id, 'delivery', v_code, encode(digest(v_code, 'sha256'), 'hex'));
    end if;
    return v_job;
  end if;

  if v_order.status <> 'picking' then
    raise exception 'Only an order being prepared can be marked ready for pickup.';
  end if;

  insert into public.delivery_jobs (order_id) values (p_order_id) returning * into v_job;
  v_code := lpad((floor(random() * 1000000))::int::text, 6, '0');
  insert into public.delivery_handoffs (delivery_job_id, handoff_type, otp_code, otp_hash)
  values (v_job.id, 'pickup', v_code, encode(digest(v_code, 'sha256'), 'hex'));
  v_code := lpad((floor(random() * 1000000))::int::text, 6, '0');
  insert into public.delivery_handoffs (delivery_job_id, handoff_type, otp_code, otp_hash)
  values (v_job.id, 'delivery', v_code, encode(digest(v_code, 'sha256'), 'hex'));
  insert into public.delivery_events (delivery_job_id, event_type, note)
  values (v_job.id, 'ready_for_pickup', 'The store marked this order ready and pickup and delivery codes were generated.');
  return v_job;
end;
$$;

revoke all on function public.queue_order_for_delivery(uuid) from public, anon, authenticated;
grant execute on function public.queue_order_for_delivery(uuid) to service_role;
