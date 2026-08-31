alter table public.products
  add column if not exists fabric text;

alter table public.products
  drop constraint if exists products_fabric_check;

alter table public.products
  add constraint products_fabric_check check (
    fabric is null or fabric in (
      'Cotton', 'Chiffon', 'Georgette', 'Organza', 'Silk', 'Mul Cotton',
      'Satin', 'Denim', 'Jute', 'Lawn', 'Printed Lawn', 'Embroidered Lawn',
      'Jacquard', 'Banarasi', 'Sequins', 'Crepe', 'Mul Chanderi', 'Crepe Silk',
      'Muslin', 'Chinon', 'Linen Cotton', 'German Rayon', 'Kota Doriya'
    )
  );

create index if not exists products_fabric_idx on public.products (fabric);
