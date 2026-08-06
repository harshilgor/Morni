create table public.product_reviews (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  store_id uuid not null references public.stores (id) on delete cascade,
  shopper_id uuid not null references public.profiles (id) on delete cascade,
  order_id uuid not null references public.orders (id) on delete cascade,
  order_item_id uuid references public.order_items (id) on delete set null,
  rating smallint not null check (rating >= 1 and rating <= 5),
  body text check (body is null or char_length(body) <= 1000),
  shopper_name text not null default 'Morni shopper',
  owner_reply text check (owner_reply is null or char_length(owner_reply) <= 1000),
  owner_replied_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (shopper_id, product_id)
);

create index product_reviews_product_idx on public.product_reviews (product_id, created_at desc);
create index product_reviews_store_idx on public.product_reviews (store_id, created_at desc);
create index product_reviews_shopper_idx on public.product_reviews (shopper_id);

create trigger product_reviews_updated_at before update on public.product_reviews
for each row execute function public.set_updated_at();

create or replace function public.shopper_can_review_product(
  p_product_id uuid,
  p_order_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.orders o
    join public.order_items oi on oi.order_id = o.id
    where o.id = p_order_id
      and o.shopper_id = auth.uid()
      and o.status = 'delivered'
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
  select p.store_id into v_store_id
  from public.products p
  where p.id = new.product_id;

  if v_store_id is null then
    raise exception 'Product not found';
  end if;

  new.store_id := v_store_id;

  if tg_op = 'INSERT' then
    if not public.shopper_can_review_product(new.product_id, new.order_id) then
      raise exception 'You can only review products from delivered orders';
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

create trigger product_reviews_before_write
before insert or update on public.product_reviews
for each row execute function public.product_reviews_before_write();

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
  end if;
  return new;
end;
$$;

create trigger product_reviews_owner_reply_timestamp
before update on public.product_reviews
for each row execute function public.product_reviews_owner_reply_timestamp();

alter table public.product_reviews enable row level security;

create policy "product_reviews_public_read"
  on public.product_reviews for select
  using (true);

create policy "product_reviews_shopper_insert"
  on public.product_reviews for insert
  with check (
    shopper_id = auth.uid()
    and public.shopper_can_review_product(product_id, order_id)
  );

create policy "product_reviews_shopper_update"
  on public.product_reviews for update
  using (shopper_id = auth.uid())
  with check (
    shopper_id = auth.uid()
    and owner_reply is not distinct from (
      select pr.owner_reply from public.product_reviews pr where pr.id = product_reviews.id
    )
    and owner_replied_at is not distinct from (
      select pr.owner_replied_at from public.product_reviews pr where pr.id = product_reviews.id
    )
  );

create policy "product_reviews_owner_reply"
  on public.product_reviews for update
  using (public.is_store_member(store_id))
  with check (
    public.is_store_member(store_id)
    and rating = (select pr.rating from public.product_reviews pr where pr.id = product_reviews.id)
    and body is not distinct from (
      select pr.body from public.product_reviews pr where pr.id = product_reviews.id
    )
    and shopper_id = (
      select pr.shopper_id from public.product_reviews pr where pr.id = product_reviews.id
    )
    and product_id = (
      select pr.product_id from public.product_reviews pr where pr.id = product_reviews.id
    )
    and order_id = (
      select pr.order_id from public.product_reviews pr where pr.id = product_reviews.id
    )
  );
