-- Keep verified reviews permanently attached to the purchase that earned them.
create or replace function public.product_review_order_item_matches(
  p_order_item_id uuid,
  p_order_id uuid,
  p_product_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.order_items oi
    where oi.id = p_order_item_id
      and oi.order_id = p_order_id
      and oi.product_id = p_product_id
  );
$$;

create or replace function public.product_reviews_before_write()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_store_id uuid;
  v_name text;
begin
  if tg_op = 'UPDATE'
    and auth.uid() = old.shopper_id
    and (
      new.shopper_id is distinct from old.shopper_id
      or new.product_id is distinct from old.product_id
      or new.order_id is distinct from old.order_id
      or new.order_item_id is distinct from old.order_item_id
    ) then
    raise exception 'A review must remain linked to its original delivered order';
  end if;

  select p.store_id into v_store_id
  from public.products p
  where p.id = new.product_id;

  if v_store_id is null then
    raise exception 'Product not found';
  end if;

  new.store_id := v_store_id;

  if tg_op = 'INSERT' then
    if new.shopper_id is distinct from auth.uid() then
      raise exception 'You can only create reviews as yourself';
    end if;

    if not public.shopper_can_review_product(new.product_id, new.order_id) then
      raise exception 'You can only review products from delivered orders';
    end if;

    if new.order_item_id is not null
      and not public.product_review_order_item_matches(
        new.order_item_id,
        new.order_id,
        new.product_id
      ) then
      raise exception 'Review item does not match the delivered order';
    end if;

    select coalesce(nullif(trim(p.full_name), ''), 'Morni shopper')
    into v_name
    from public.profiles p
    where p.id = new.shopper_id;

    new.shopper_name := v_name;
  end if;

  return new;
end;
$$;

create or replace function public.product_reviews_owner_reply_timestamp()
returns trigger
language plpgsql
as $$
begin
  if new.owner_reply is distinct from old.owner_reply then
    new.owner_replied_at := case
      when new.owner_reply is null or trim(new.owner_reply) = '' then null
      else now()
    end;
  else
    new.owner_replied_at := old.owner_replied_at;
  end if;
  return new;
end;
$$;

drop policy if exists "product_reviews_shopper_insert" on public.product_reviews;
create policy "product_reviews_shopper_insert"
  on public.product_reviews for insert
  with check (
    shopper_id = auth.uid()
    and public.shopper_can_review_product(product_id, order_id)
    and (
      order_item_id is null
      or public.product_review_order_item_matches(order_item_id, order_id, product_id)
    )
  );

drop policy if exists "product_reviews_shopper_update" on public.product_reviews;
create policy "product_reviews_shopper_update"
  on public.product_reviews for update
  using (shopper_id = auth.uid())
  with check (
    shopper_id = auth.uid()
    and product_id = (
      select pr.product_id from public.product_reviews pr where pr.id = product_reviews.id
    )
    and store_id = (
      select pr.store_id from public.product_reviews pr where pr.id = product_reviews.id
    )
    and order_id = (
      select pr.order_id from public.product_reviews pr where pr.id = product_reviews.id
    )
    and order_item_id is not distinct from (
      select pr.order_item_id from public.product_reviews pr where pr.id = product_reviews.id
    )
    and shopper_name = (
      select pr.shopper_name from public.product_reviews pr where pr.id = product_reviews.id
    )
    and owner_reply is not distinct from (
      select pr.owner_reply from public.product_reviews pr where pr.id = product_reviews.id
    )
    and owner_replied_at is not distinct from (
      select pr.owner_replied_at from public.product_reviews pr where pr.id = product_reviews.id
    )
  );

drop policy if exists "product_reviews_owner_reply" on public.product_reviews;
create policy "product_reviews_owner_reply"
  on public.product_reviews for update
  using (public.is_store_member(store_id))
  with check (
    public.is_store_member(store_id)
    and rating = (
      select pr.rating from public.product_reviews pr where pr.id = product_reviews.id
    )
    and body is not distinct from (
      select pr.body from public.product_reviews pr where pr.id = product_reviews.id
    )
    and shopper_name = (
      select pr.shopper_name from public.product_reviews pr where pr.id = product_reviews.id
    )
    and shopper_id = (
      select pr.shopper_id from public.product_reviews pr where pr.id = product_reviews.id
    )
    and product_id = (
      select pr.product_id from public.product_reviews pr where pr.id = product_reviews.id
    )
    and store_id = (
      select pr.store_id from public.product_reviews pr where pr.id = product_reviews.id
    )
    and order_id = (
      select pr.order_id from public.product_reviews pr where pr.id = product_reviews.id
    )
    and order_item_id is not distinct from (
      select pr.order_item_id from public.product_reviews pr where pr.id = product_reviews.id
    )
  );