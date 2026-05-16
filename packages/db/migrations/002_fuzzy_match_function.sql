-- ============================================================
-- Migración 002: Función de fuzzy matching con trigrams
-- Usada por el backend para el matching de SKU aliases
-- ============================================================

create or replace function match_sku_alias_fuzzy(
  p_description text,
  p_supplier_id uuid default null,
  p_limit int default 5,
  p_threshold float default 0.3
)
returns table (
  alias_id      uuid,
  sku_id        uuid,
  sku_code      text,
  sku_name      text,
  sku_unit      text,
  alias         text,
  unit_alias    text,
  unit_factor   numeric,
  similarity    float,
  supplier_id   uuid
) language sql stable as $$
  select
    sa.id          as alias_id,
    sa.sku_id,
    s.code         as sku_code,
    s.name         as sku_name,
    s.unit         as sku_unit,
    sa.alias,
    sa.unit_alias,
    sa.unit_factor,
    similarity(sa.alias, p_description) as similarity,
    sa.supplier_id
  from sku_aliases sa
  join skus s on s.id = sa.sku_id
  where
    similarity(sa.alias, p_description) >= p_threshold
    and (p_supplier_id is null or sa.supplier_id = p_supplier_id)
  order by similarity desc
  limit p_limit;
$$;
