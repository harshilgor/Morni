-- Update only Viraasat's storefront address; preserve the store, products,
-- memberships, coordinates, and all historical orders.
update public.stores
set address = '1002, Bukhash Building, Opposite The Perfume Lab, Al Barsha, Dubai',
    area = 'Al Barsha',
    emirate = 'dubai',
    updated_at = now()
where lower(trim(name)) = 'viraasat';
