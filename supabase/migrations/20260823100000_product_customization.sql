-- Product-level made-to-measure options. The JSONB shape stays flexible so each
-- boutique can ask for the measurements that make sense for the garment.
alter table public.products
  add column if not exists customization_enabled boolean not null default false,
  add column if not exists customization_instructions text,
  add column if not exists customization_fields jsonb not null default '[]'::jsonb;

alter table public.order_items
  add column if not exists customization jsonb;

comment on column public.products.customization_fields is
  'Array of {id,label,unit,required} measurement field definitions.';
comment on column public.order_items.customization is
  'Shopper-entered measurements captured at checkout.';

notify pgrst, 'reload schema';
