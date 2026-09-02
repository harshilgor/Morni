-- Persist the same made-to-measure configuration offered in the single-product
-- form when a product is created via a bulk import.
alter table public.bulk_import_items
  add column if not exists customization_enabled boolean not null default false,
  add column if not exists customization_instructions text,
  add column if not exists customization_fields jsonb not null default '[]'::jsonb;

alter table public.bulk_import_items
  drop constraint if exists bulk_import_items_customization_fields_array;

alter table public.bulk_import_items
  add constraint bulk_import_items_customization_fields_array
  check (jsonb_typeof(customization_fields) = 'array');

create or replace function public.publish_bulk_import(p_import_id uuid)
returns table(item_id uuid, product_id uuid, ok boolean, error_message text)
language plpgsql security definer set search_path = public as $$
declare item record; category_id uuid; created_id uuid; group_record jsonb; group_index integer;
begin
  for item in select * from public.bulk_import_items where import_id=p_import_id and status in ('pending','failed') order by created_at loop
    begin
      select c.id into category_id from public.categories c join public.bulk_imports i on i.store_id=c.store_id where i.id=p_import_id and c.slug=item.category_slug limit 1;
      if category_id is null then raise exception 'Category is not available for this store.'; end if;
      insert into public.products(store_id,category_id,title,product_tag,description,fabric,price_aed,stock,sizes,size_stock,customization_enabled,customization_instructions,customization_fields,image_urls,is_available)
        select i.store_id,category_id,item.title,nullif(item.product_tag,''),item.description,item.fabric,item.price_aed,
          case when item.size_stock <> '{}'::jsonb then coalesce((select sum(value::integer) from jsonb_each_text(item.size_stock)),0) else item.stock end,
          case when item.category_slug in ('gifting','hamper','hampers') then '{}'::text[] else item.sizes end,
          case when item.category_slug in ('gifting','hamper','hampers') then '{}'::jsonb else item.size_stock end,
          case when item.category_slug in ('gifting','hamper','hampers') then false else item.customization_enabled end,
          case when item.category_slug in ('gifting','hamper','hampers') then null else item.customization_instructions end,
          case when item.category_slug in ('gifting','hamper','hampers') then '[]'::jsonb else item.customization_fields end,
          item.image_urls,true from public.bulk_imports i where i.id=p_import_id returning id into created_id;
      group_index := 0;
      for group_record in select value from jsonb_array_elements(coalesce(item.variant_groups, '[]'::jsonb)) loop
        insert into public.product_variants(product_id,color_name,color_hex,image_urls,sizes,size_stock,stock,sort_order)
        values (created_id, group_record->>'colorName', nullif(group_record->>'colorHex',''),
          array(select jsonb_array_elements_text(coalesce(group_record->'images','[]'::jsonb))),
          array(select jsonb_array_elements_text(coalesce(group_record->'sizes','[]'::jsonb))),
          coalesce(group_record->'sizeStock', '{}'::jsonb),
          coalesce((group_record->>'stock')::integer, 0), group_index);
        group_index := group_index + 1;
      end loop;
      update public.bulk_import_items set status='published',product_id=created_id,error_message=null,attempt_count=attempt_count+1,updated_at=now() where id=item.id;
      item_id:=item.id; product_id:=created_id; ok:=true; error_message:=null; return next;
    exception when others then
      update public.bulk_import_items set status='failed',error_message=left(sqlerrm,500),attempt_count=attempt_count+1,updated_at=now() where id=item.id;
      item_id:=item.id; product_id:=null; ok:=false; error_message:=left(sqlerrm,500); return next;
    end;
  end loop;
  update public.bulk_imports i set successful_items=(select count(*) from public.bulk_import_items x where x.import_id=i.id and x.status='published'), failed_items=(select count(*) from public.bulk_import_items x where x.import_id=i.id and x.status='failed'), status=case when exists(select 1 from public.bulk_import_items x where x.import_id=i.id and x.status='failed') then 'completed_with_errors' else 'completed' end, completed_at=now() where i.id=p_import_id;
end; $$;

revoke all on function public.publish_bulk_import(uuid) from public, anon, authenticated;
grant execute on function public.publish_bulk_import(uuid) to service_role;
