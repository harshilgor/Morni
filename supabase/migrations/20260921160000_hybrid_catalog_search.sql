-- Morni hybrid catalogue search foundation.
-- Structured and lexical search remain authoritative; embeddings are an
-- asynchronous, optional candidate source and can never make a hidden or
-- unavailable product searchable.

create extension if not exists vector with schema extensions;

create table if not exists public.search_aliases (
  id bigint generated always as identity primary key,
  alias text not null,
  facet_type text not null check (facet_type in ('category', 'color', 'fabric', 'style', 'occasion', 'audience', 'price_intent')),
  canonical_value text not null,
  language text not null default 'en',
  priority smallint not null default 100,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (alias, facet_type, canonical_value, language)
);

create index if not exists search_aliases_active_alias_idx
  on public.search_aliases (lower(alias), facet_type, priority)
  where is_active;

alter table public.search_aliases enable row level security;
drop policy if exists search_aliases_public_read on public.search_aliases;
create policy search_aliases_public_read on public.search_aliases
  for select using (is_active);

insert into public.search_aliases (alias, facet_type, canonical_value, priority) values
  ('top', 'category', 'tops', 10),
  ('tops', 'category', 'tops', 10),
  ('crop top', 'category', 'tops', 5),
  ('cropped top', 'category', 'tops', 5),
  ('kurti', 'category', 'kurtis', 10),
  ('kurtis', 'category', 'kurtis', 10),
  ('short kurti', 'category', 'short-kurtis', 5),
  ('short kurtis', 'category', 'short-kurtis', 5),
  ('saree', 'category', 'sarees', 10),
  ('sarees', 'category', 'sarees', 10),
  ('lehenga', 'category', 'lehengas', 10),
  ('lehengas', 'category', 'lehengas', 10),
  ('anarkali', 'category', 'anarkalis', 10),
  ('anarkalis', 'category', 'anarkalis', 10),
  ('sharara', 'category', 'shararas', 10),
  ('shararas', 'category', 'shararas', 10),
  ('co ord', 'category', 'sets', 10),
  ('coord', 'category', 'sets', 10),
  ('co-ord', 'category', 'sets', 10),
  ('set', 'category', 'sets', 20),
  ('sets', 'category', 'sets', 20),
  ('gift', 'category', 'gifting', 10),
  ('gifts', 'category', 'gifting', 10),
  ('hamper', 'category', 'gifting', 10),
  ('hampers', 'category', 'gifting', 10),
  ('black', 'color', 'black', 10),
  ('white', 'color', 'white', 10),
  ('red', 'color', 'red', 10),
  ('blue', 'color', 'blue', 10),
  ('green', 'color', 'green', 10),
  ('pink', 'color', 'pink', 10),
  ('yellow', 'color', 'yellow', 10),
  ('purple', 'color', 'purple', 10),
  ('beige', 'color', 'beige', 10),
  ('gold', 'color', 'gold', 10),
  ('silver', 'color', 'silver', 10),
  ('cotton', 'fabric', 'cotton', 10),
  ('silk', 'fabric', 'silk', 10),
  ('linen', 'fabric', 'linen', 10),
  ('crepe', 'fabric', 'crepe', 10),
  ('synthetic', 'fabric', 'synthetic', 10),
  ('crop', 'style', 'crop', 10),
  ('cropped', 'style', 'crop', 10),
  ('sleeveless', 'style', 'sleeveless', 10),
  ('embroidered', 'style', 'embroidered', 10),
  ('casual', 'style', 'casual', 10),
  ('elegant', 'style', 'elegant', 10),
  ('traditional', 'style', 'traditional', 10),
  ('party', 'occasion', 'party', 10),
  ('wedding', 'occasion', 'wedding', 10),
  ('brunch', 'occasion', 'brunch', 10),
  ('college', 'occasion', 'college', 10),
  ('women', 'audience', 'women', 10),
  ('womens', 'audience', 'women', 10),
  ('cheap', 'price_intent', 'value', 10),
  ('affordable', 'price_intent', 'value', 10),
  ('luxury', 'price_intent', 'luxury', 10)
on conflict (alias, facet_type, canonical_value, language) do update
set priority = excluded.priority, is_active = true;

create table if not exists public.product_search_index (
  product_id uuid primary key references public.products(id) on delete cascade,
  store_id uuid not null references public.stores(id) on delete cascade,
  category_id uuid null references public.categories(id) on delete set null,
  canonical_category text,
  product_type text,
  colors text[] not null default '{}',
  fabrics text[] not null default '{}',
  styles text[] not null default '{}',
  occasions text[] not null default '{}',
  audiences text[] not null default array['women']::text[],
  canonical_text text not null,
  search_tsv tsvector not null,
  embedding extensions.halfvec(512),
  embedding_model text,
  embedding_version text,
  embedding_input_hash text not null,
  embedding_status text not null default 'pending' check (embedding_status in ('pending', 'processing', 'ready', 'failed')),
  embedding_error text,
  embedded_at timestamptz,
  price_aed numeric(10,2) not null,
  stock integer not null,
  is_available boolean not null,
  updated_at timestamptz not null default now()
);

create index if not exists product_search_index_fts_idx on public.product_search_index using gin (search_tsv);
create index if not exists product_search_index_category_idx on public.product_search_index (canonical_category) where is_available;
create index if not exists product_search_index_colors_idx on public.product_search_index using gin (colors);
create index if not exists product_search_index_fabrics_idx on public.product_search_index using gin (fabrics);
create index if not exists product_search_index_styles_idx on public.product_search_index using gin (styles);
create index if not exists product_search_index_available_idx on public.product_search_index (is_available, updated_at desc);

alter table public.product_search_index enable row level security;
revoke all on public.product_search_index from anon, authenticated;

create table if not exists public.product_embedding_jobs (
  product_id uuid primary key references public.products(id) on delete cascade,
  input_hash text not null,
  attempts integer not null default 0,
  available_at timestamptz not null default now(),
  locked_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.product_embedding_jobs enable row level security;
revoke all on public.product_embedding_jobs from anon, authenticated;

create or replace function public.claim_product_embedding_jobs(p_limit integer default 32)
returns table (product_id uuid, input_hash text, canonical_text text)
language plpgsql security definer set search_path = public, extensions as $$
begin
  return query
  with claimed as (
    select j.product_id
    from public.product_embedding_jobs j
    where j.available_at <= now()
      and (j.locked_at is null or j.locked_at < now() - interval '10 minutes')
      and j.attempts < 8
    order by j.available_at, j.created_at
    for update skip locked
    limit greatest(1, least(coalesce(p_limit, 32), 100))
  ), updated as (
    update public.product_embedding_jobs j
    set locked_at = now(), attempts = attempts + 1, updated_at = now()
    from claimed c
    where j.product_id = c.product_id
    returning j.product_id, j.input_hash
  )
  select u.product_id, u.input_hash, s.canonical_text
  from updated u
  join public.product_search_index s on s.product_id = u.product_id
  where s.embedding_input_hash = u.input_hash;
end;
$$;

create or replace function public.complete_product_embedding_job(
  p_product_id uuid,
  p_input_hash text,
  p_embedding extensions.halfvec(512),
  p_model text,
  p_version text
) returns boolean
language plpgsql security definer set search_path = public, extensions as $$
declare v_updated integer;
begin
  update public.product_search_index
  set embedding = p_embedding,
      embedding_model = p_model,
      embedding_version = p_version,
      embedding_status = 'ready',
      embedding_error = null,
      embedded_at = now()
  where product_id = p_product_id and embedding_input_hash = p_input_hash;
  get diagnostics v_updated = row_count;
  if v_updated > 0 then
    delete from public.product_embedding_jobs where product_id = p_product_id and input_hash = p_input_hash;
    return true;
  end if;
  return false;
end;
$$;

create or replace function public.fail_product_embedding_job(
  p_product_id uuid,
  p_input_hash text,
  p_error text
) returns void
language plpgsql security definer set search_path = public, extensions as $$
begin
  update public.product_embedding_jobs
  set locked_at = null,
      last_error = left(coalesce(p_error, 'Embedding failed'), 500),
      available_at = now() + make_interval(secs => least(3600, (power(2, least(attempts, 8)) * 15)::integer)),
      updated_at = now()
  where product_id = p_product_id and input_hash = p_input_hash;
  update public.product_search_index
  set embedding_status = case when exists (
        select 1 from public.product_embedding_jobs j
        where j.product_id = p_product_id and j.attempts >= 8
      ) then 'failed' else 'pending' end,
      embedding_error = left(coalesce(p_error, 'Embedding failed'), 500)
  where product_id = p_product_id and embedding_input_hash = p_input_hash;
end;
$$;

revoke all on function public.claim_product_embedding_jobs(integer) from public, anon, authenticated;
revoke all on function public.complete_product_embedding_job(uuid, text, extensions.halfvec, text, text) from public, anon, authenticated;
revoke all on function public.fail_product_embedding_job(uuid, text, text) from public, anon, authenticated;
grant execute on function public.claim_product_embedding_jobs(integer) to service_role;
grant execute on function public.complete_product_embedding_job(uuid, text, extensions.halfvec, text, text) to service_role;
grant execute on function public.fail_product_embedding_job(uuid, text, text) to service_role;

create or replace function public.refresh_product_search_index(p_product_id uuid)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_row record;
  v_text text;
  v_hash text;
  v_styles text[];
  v_occasions text[];
begin
  select
    p.id,
    p.store_id,
    p.category_id,
    p.title,
    coalesce(p.description, '') as description,
    nullif(lower(trim(coalesce(p.fabric, ''))), '') as fabric,
    p.price_aed,
    p.stock,
    p.is_available and p.stock > 0 and s.is_active as is_available,
    lower(coalesce(c.slug, '')) as category_slug,
    coalesce(c.name, '') as category_name,
    s.name as store_name,
    coalesce(array_agg(distinct lower(trim(v.color_name))) filter (where nullif(trim(v.color_name), '') is not null), '{}') as colors
  into v_row
  from public.products p
  join public.stores s on s.id = p.store_id
  left join public.categories c on c.id = p.category_id
  left join public.product_variants v on v.product_id = p.id
  where p.id = p_product_id
  group by p.id, s.id, c.id;

  if not found then
    delete from public.product_search_index where product_id = p_product_id;
    delete from public.product_embedding_jobs where product_id = p_product_id;
    return;
  end if;

  v_styles := array_remove(array[
    case when (v_row.title || ' ' || v_row.description) ~* '\m(crop|cropped)\M' then 'crop' end,
    case when (v_row.title || ' ' || v_row.description) ~* '\msleeveless\M' then 'sleeveless' end,
    case when (v_row.title || ' ' || v_row.description) ~* '\membroider(ed|y)?\M' then 'embroidered' end,
    case when (v_row.title || ' ' || v_row.description) ~* '\mcasual\M' then 'casual' end,
    case when (v_row.title || ' ' || v_row.description) ~* '\melegant\M' then 'elegant' end,
    case when (v_row.title || ' ' || v_row.description) ~* '\mtraditional\M' then 'traditional' end
  ], null);
  v_occasions := array_remove(array[
    case when (v_row.title || ' ' || v_row.description) ~* '\mparty\M' then 'party' end,
    case when (v_row.title || ' ' || v_row.description) ~* '\mwedding\M' then 'wedding' end,
    case when (v_row.title || ' ' || v_row.description) ~* '\mbrunch\M' then 'brunch' end,
    case when (v_row.title || ' ' || v_row.description) ~* '\mcollege\M' then 'college' end
  ], null);

  v_text := concat_ws(E'\n',
    'Product: ' || v_row.title || '.',
    nullif('Product type: ' || v_row.category_name || '.', 'Product type: .'),
    case when cardinality(v_row.colors) > 0 then 'Colours: ' || array_to_string(v_row.colors, ', ') || '.' end,
    case when v_row.fabric is not null then 'Fabric: ' || v_row.fabric || '.' end,
    case when cardinality(v_styles) > 0 then 'Styles: ' || array_to_string(v_styles, ', ') || '.' end,
    case when cardinality(v_occasions) > 0 then 'Occasions: ' || array_to_string(v_occasions, ', ') || '.' end,
    'Store: ' || v_row.store_name || '.',
    case when v_row.description <> '' then 'Description: ' || left(v_row.description, 600) end
  );
  v_hash := encode(digest(v_text, 'sha256'), 'hex');

  insert into public.product_search_index (
    product_id, store_id, category_id, canonical_category, product_type,
    colors, fabrics, styles, occasions, canonical_text, search_tsv,
    embedding_input_hash, embedding_status, price_aed, stock, is_available, updated_at
  ) values (
    v_row.id, v_row.store_id, v_row.category_id, nullif(v_row.category_slug, ''), nullif(v_row.category_slug, ''),
    v_row.colors,
    case when v_row.fabric is null then '{}' else array[v_row.fabric] end,
    v_styles, v_occasions, v_text,
    setweight(to_tsvector('simple', coalesce(v_row.title, '')), 'A') ||
    setweight(to_tsvector('simple', concat_ws(' ', v_row.category_name, v_row.category_slug)), 'A') ||
    setweight(to_tsvector('simple', concat_ws(' ', array_to_string(v_row.colors, ' '), array_to_string(v_styles, ' '), array_to_string(v_occasions, ' '))), 'B') ||
    setweight(to_tsvector('simple', concat_ws(' ', v_row.fabric, v_row.store_name)), 'C') ||
    setweight(to_tsvector('simple', left(v_row.description, 1200)), 'D'),
    v_hash, 'pending', v_row.price_aed, v_row.stock, v_row.is_available, now()
  )
  on conflict (product_id) do update set
    store_id = excluded.store_id,
    category_id = excluded.category_id,
    canonical_category = excluded.canonical_category,
    product_type = excluded.product_type,
    colors = excluded.colors,
    fabrics = excluded.fabrics,
    styles = excluded.styles,
    occasions = excluded.occasions,
    canonical_text = excluded.canonical_text,
    search_tsv = excluded.search_tsv,
    embedding_input_hash = excluded.embedding_input_hash,
    embedding_status = case
      when product_search_index.embedding_input_hash = excluded.embedding_input_hash then product_search_index.embedding_status
      else 'pending'
    end,
    embedding = case
      when product_search_index.embedding_input_hash = excluded.embedding_input_hash then product_search_index.embedding
      else null
    end,
    embedding_error = case
      when product_search_index.embedding_input_hash = excluded.embedding_input_hash then product_search_index.embedding_error
      else null
    end,
    price_aed = excluded.price_aed,
    stock = excluded.stock,
    is_available = excluded.is_available,
    updated_at = now();

  if not exists (
    select 1 from public.product_search_index
    where product_id = p_product_id and embedding_input_hash = v_hash and embedding_status = 'ready'
  ) then
    insert into public.product_embedding_jobs (product_id, input_hash, available_at, locked_at, last_error, updated_at)
    values (p_product_id, v_hash, now(), null, null, now())
    on conflict (product_id) do update set
      input_hash = excluded.input_hash,
      attempts = case when product_embedding_jobs.input_hash = excluded.input_hash then product_embedding_jobs.attempts else 0 end,
      available_at = now(), locked_at = null, last_error = null, updated_at = now();
  end if;
end;
$$;

create or replace function public.product_search_refresh_trigger()
returns trigger language plpgsql security definer set search_path = public, extensions as $$
begin
  perform public.refresh_product_search_index(coalesce(new.id, old.id));
  return coalesce(new, old);
end;
$$;

create or replace function public.variant_search_refresh_trigger()
returns trigger language plpgsql security definer set search_path = public, extensions as $$
begin
  perform public.refresh_product_search_index(coalesce(new.product_id, old.product_id));
  return coalesce(new, old);
end;
$$;

drop trigger if exists products_refresh_search_index on public.products;
create trigger products_refresh_search_index
after insert or update of title, description, fabric, category_id, price_aed, stock, is_available, store_id
on public.products for each row execute function public.product_search_refresh_trigger();

drop trigger if exists variants_insert_delete_refresh_search_index on public.product_variants;
create trigger variants_insert_delete_refresh_search_index
after insert or delete on public.product_variants
for each row execute function public.variant_search_refresh_trigger();

drop trigger if exists variants_update_refresh_search_index on public.product_variants;
create trigger variants_update_refresh_search_index
after update of color_name on public.product_variants
for each row execute function public.variant_search_refresh_trigger();

create or replace function public.search_prefix_query(p_query text)
returns tsquery language sql immutable set search_path = public as $$
  select case when count(*) = 0 then null::tsquery
    else to_tsquery('simple', string_agg(lexeme || ':*', ' & ')) end
  from (
    select distinct token as lexeme
    from regexp_split_to_table(lower(regexp_replace(coalesce(p_query, ''), '[^[:alnum:] -]+', ' ', 'g')), '\s+') token
    where length(token) >= 2
  ) q;
$$;

create or replace function public.search_catalog_lexical(p_query text, p_limit integer default 200)
returns table (
  product_id uuid,
  lexical_rank double precision,
  structured_rank double precision,
  fuzzy_rank double precision,
  matched_category text,
  matched_color text,
  matched_fabric text,
  matched_style text,
  relevance_class text
)
language sql stable security definer set search_path = public, extensions as $$
with input as (
  select lower(trim(regexp_replace(coalesce(p_query, ''), '\s+', ' ', 'g'))) as q,
         public.search_prefix_query(p_query) as prefix_q
), intent as (
  select
    (select a.canonical_value from public.search_aliases a, input i
      where a.is_active and a.facet_type = 'category'
        and (' ' || i.q || ' ') like ('% ' || lower(a.alias) || ' %')
      order by length(a.alias) desc, a.priority asc limit 1) as category,
    (select a.canonical_value from public.search_aliases a, input i
      where a.is_active and a.facet_type = 'color'
        and (' ' || i.q || ' ') like ('% ' || lower(a.alias) || ' %')
      order by length(a.alias) desc, a.priority asc limit 1) as color,
    (select a.canonical_value from public.search_aliases a, input i
      where a.is_active and a.facet_type = 'fabric'
        and (' ' || i.q || ' ') like ('% ' || lower(a.alias) || ' %')
      order by length(a.alias) desc, a.priority asc limit 1) as fabric,
    (select a.canonical_value from public.search_aliases a, input i
      where a.is_active and a.facet_type = 'style'
        and (' ' || i.q || ' ') like ('% ' || lower(a.alias) || ' %')
      order by length(a.alias) desc, a.priority asc limit 1) as style
), scored as (
  select
    s.product_id,
    case when i.prefix_q is null then 0 else ts_rank_cd(s.search_tsv, i.prefix_q, 32)::float end as lex,
    (
      case when n.category is not null and (
        s.canonical_category = n.category or
        case n.category
          when 'tops' then lower(p.title) ~ '\m(top|tops)\M'
          when 'kurtis' then lower(p.title) ~ '\m(kurti|kurtis)\M'
          when 'short-kurtis' then lower(p.title) ~ '\mshort kurti(s)?\M'
          when 'sarees' then lower(p.title) ~ '\msaree(s)?\M'
          when 'lehengas' then lower(p.title) ~ '\mlehenga(s)?\M'
          when 'anarkalis' then lower(p.title) ~ '\manarkali(s)?\M'
          when 'shararas' then lower(p.title) ~ '\msharara(s)?\M'
          when 'gifting' then lower(p.title) ~ '\m(gift|hamper)(s)?\M'
          else false
        end
      ) then 1 else 0 end +
      case when n.color is not null and n.color = any(s.colors) then .7 else 0 end +
      case when n.fabric is not null and n.fabric = any(s.fabrics) then .7 else 0 end +
      case when n.style is not null and n.style = any(s.styles) then .7 else 0 end
    )::float as structured,
    greatest(similarity(lower(p.title), i.q), word_similarity(i.q, lower(p.title)))::float as fuzzy,
    n.category, n.color, n.fabric, n.style,
    case
      when n.category is not null and (
        s.canonical_category = n.category or
        (n.category = 'tops' and s.canonical_category = 'short-kurtis' and lower(p.title) ~ '\m(top|tops)\M')
      )
        and (n.color is null or n.color = any(s.colors))
        and (n.fabric is null or n.fabric = any(s.fabrics))
        and (n.style is null or n.style = any(s.styles)) then 'exact'
      when n.category is not null and (
        s.canonical_category = n.category or
        case n.category
          when 'tops' then lower(p.title) ~ '\m(top|tops)\M'
          when 'kurtis' then lower(p.title) ~ '\m(kurti|kurtis)\M'
          when 'short-kurtis' then lower(p.title) ~ '\mshort kurti(s)?\M'
          when 'sarees' then lower(p.title) ~ '\msaree(s)?\M'
          when 'lehengas' then lower(p.title) ~ '\mlehenga(s)?\M'
          when 'anarkalis' then lower(p.title) ~ '\manarkali(s)?\M'
          when 'shararas' then lower(p.title) ~ '\msharara(s)?\M'
          when 'gifting' then lower(p.title) ~ '\m(gift|hamper)(s)?\M'
          else false
        end
      ) then 'substitute'
      when n.category is not null then 'irrelevant'
      else 'exact'
    end as class
  from public.product_search_index s
  join public.products p on p.id = s.product_id
  cross join input i
  cross join intent n
  where s.is_available
    and (
      (n.category is not null and (
        s.canonical_category = n.category or
        case n.category
          when 'tops' then lower(p.title) ~ '\m(top|tops)\M'
          when 'kurtis' then lower(p.title) ~ '\m(kurti|kurtis)\M'
          when 'short-kurtis' then lower(p.title) ~ '\mshort kurti(s)?\M'
          when 'sarees' then lower(p.title) ~ '\msaree(s)?\M'
          when 'lehengas' then lower(p.title) ~ '\mlehenga(s)?\M'
          when 'anarkalis' then lower(p.title) ~ '\manarkali(s)?\M'
          when 'shararas' then lower(p.title) ~ '\msharara(s)?\M'
          when 'gifting' then lower(p.title) ~ '\m(gift|hamper)(s)?\M'
          else false
        end
      ))
      or (n.category is null and n.color is not null and n.color = any(s.colors))
      or (n.category is null and n.fabric is not null and n.fabric = any(s.fabrics))
      or (n.category is null and n.style is not null and n.style = any(s.styles))
      or (n.category is null and i.prefix_q is not null and s.search_tsv @@ i.prefix_q)
      or (n.category is null and greatest(similarity(lower(p.title), i.q), word_similarity(i.q, lower(p.title))) >= .28)
    )
)
select product_id, lex, structured, fuzzy, category, color, fabric, style, class
from scored
where class <> 'irrelevant'
order by
  case class when 'exact' then 0 when 'substitute' then 1 else 2 end,
  structured desc,
  lex desc,
  fuzzy desc
limit greatest(1, least(coalesce(p_limit, 200), 500));
$$;

create or replace function public.search_catalog_semantic(p_embedding extensions.halfvec(512), p_limit integer default 200)
returns table (product_id uuid, semantic_rank double precision)
language sql stable security definer set search_path = public, extensions as $$
  select s.product_id, (1 - (s.embedding <=> p_embedding))::float as semantic_rank
  from public.product_search_index s
  where s.is_available and s.embedding_status = 'ready' and s.embedding is not null
  order by s.embedding <=> p_embedding
  limit greatest(1, least(coalesce(p_limit, 200), 500));
$$;

grant execute on function public.search_catalog_lexical(text, integer) to anon, authenticated, service_role;
grant execute on function public.search_catalog_semantic(extensions.halfvec, integer) to anon, authenticated, service_role;

-- Backfill the complete catalogue after all search objects exist.
do $$ declare r record; begin
  for r in select id from public.products loop
    perform public.refresh_product_search_index(r.id);
  end loop;
end $$;
