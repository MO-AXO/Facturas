-- ============================================================
-- Migración 001: Schema inicial
-- Sistema de procesamiento de facturas de proveedores
-- ============================================================

-- Habilitar extensiones necesarias
create extension if not exists "uuid-ossp";
create extension if not exists "vector";        -- pgvector para embeddings
create extension if not exists "pg_trgm";       -- trigram para fuzzy match

-- ============================================================
-- UNIDADES DE MEDIDA
-- ============================================================

create table units_of_measure (
  id          uuid primary key default uuid_generate_v4(),
  code        text not null unique,               -- "kg", "lt", "pza", "cja"
  name        text not null,                      -- "Kilogramo", "Litro"
  base_unit   text,                               -- si es derivada, su unidad base
  created_at  timestamptz not null default now()
);

-- Factores de conversión entre unidades
-- Ejemplo: caja_12kg → kg = 12.0
create table unit_conversions (
  id              uuid primary key default uuid_generate_v4(),
  from_unit       text not null references units_of_measure(code),
  to_unit         text not null references units_of_measure(code),
  factor          numeric(18, 6) not null,        -- from × factor = to
  notes           text,
  created_at      timestamptz not null default now(),
  unique(from_unit, to_unit)
);

-- ============================================================
-- PROVEEDORES
-- ============================================================

create table suppliers (
  id              uuid primary key default uuid_generate_v4(),
  name            text not null,                  -- nombre canónico interno
  rfc             text unique,                    -- RFC fiscal mexicano
  email           text,
  phone           text,
  active          boolean not null default true,
  notes           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- Cómo aparece el proveedor en facturas (puede variar)
create table supplier_aliases (
  id              uuid primary key default uuid_generate_v4(),
  supplier_id     uuid not null references suppliers(id) on delete cascade,
  alias           text not null,                  -- "Carnes del Norte SA de CV"
  source          text,                           -- "factura", "email", "manual"
  created_at      timestamptz not null default now(),
  unique(alias)
);

create index idx_supplier_aliases_alias on supplier_aliases using gin(alias gin_trgm_ops);

-- ============================================================
-- CATÁLOGO DE SKUs
-- ============================================================

create table skus (
  id              uuid primary key default uuid_generate_v4(),
  code            text not null unique,           -- código interno "CARNE-RES-MOLIDA"
  name            text not null,                  -- "Carne de res molida"
  description     text,
  category        text,                           -- "Carnes", "Lácteos", "Abarrotes"
  unit            text not null references units_of_measure(code),  -- unidad canónica
  active          boolean not null default true,
  -- Embedding de la descripción para matching semántico (v2)
  embedding       vector(1536),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index idx_skus_embedding on skus using ivfflat (embedding vector_cosine_ops)
  with (lists = 100);
create index idx_skus_name_trgm on skus using gin(name gin_trgm_ops);

-- Cómo cada proveedor llama a cada SKU (la tabla más valiosa del sistema)
-- Se llena automáticamente con cada factura confirmada
create table sku_aliases (
  id              uuid primary key default uuid_generate_v4(),
  sku_id          uuid not null references skus(id) on delete cascade,
  supplier_id     uuid not null references suppliers(id) on delete cascade,
  alias           text not null,                  -- descripción cruda de la factura
  unit_alias      text,                           -- cómo el proveedor llama a la unidad
  unit_factor     numeric(18, 6) default 1.0,     -- factor para convertir a unidad canónica
  confirmed_by    uuid,                           -- user_id que confirmó este alias
  confirmed_at    timestamptz,
  times_seen      integer not null default 1,     -- cuántas veces se usó este alias
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique(supplier_id, alias)
);

create index idx_sku_aliases_alias on sku_aliases using gin(alias gin_trgm_ops);
create index idx_sku_aliases_supplier on sku_aliases(supplier_id);
create index idx_sku_aliases_sku on sku_aliases(sku_id);

-- ============================================================
-- FACTURAS
-- ============================================================

create type invoice_status as enum (
  'pending',      -- recién subida, pendiente de extracción
  'extracting',   -- worker procesando con Claude
  'review',       -- extracción lista, esperando revisión humana
  'approved',     -- revisada y aprobada, precio_history actualizado
  'rejected',     -- rechazada por el operador
  'error'         -- falló la extracción
);

create table invoices (
  id              uuid primary key default uuid_generate_v4(),
  supplier_id     uuid references suppliers(id),  -- null hasta que se confirme
  folio           text,                           -- número de factura del proveedor
  invoice_date    date,
  subtotal        numeric(14, 2),
  tax_amount      numeric(14, 2),
  total           numeric(14, 2),
  currency        text not null default 'MXN',
  status          invoice_status not null default 'pending',
  -- Archivo original en Supabase Storage
  storage_path    text not null,                  -- path en bucket "facturas"
  storage_bucket  text not null default 'facturas',
  file_type       text,                           -- "image/jpeg", "application/pdf"
  -- Datos crudos extraídos por Claude (para debugging)
  raw_extraction  jsonb,
  -- Metadatos de procesamiento
  extracted_at    timestamptz,
  approved_at     timestamptz,
  approved_by     uuid,
  error_message   text,
  notes           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index idx_invoices_status on invoices(status);
create index idx_invoices_supplier on invoices(supplier_id);
create index idx_invoices_date on invoices(invoice_date desc);

-- ============================================================
-- LÍNEAS DE FACTURA
-- ============================================================

create type match_status as enum (
  'auto',         -- match automático con confianza alta (>= 0.92)
  'suggested',    -- sugerencia esperando confirmación (0.75 - 0.92)
  'manual',       -- requiere match manual (< 0.75 o sin match)
  'confirmed',    -- confirmado por humano
  'new_sku'       -- descripción no tiene SKU equivalente (SKU nuevo)
);

create table invoice_lines (
  id                  uuid primary key default uuid_generate_v4(),
  invoice_id          uuid not null references invoices(id) on delete cascade,
  line_number         integer not null,
  -- Datos crudos de la factura
  raw_description     text not null,              -- tal como aparece en la factura
  raw_quantity        numeric(14, 4),
  raw_unit            text,                       -- unidad según el proveedor
  raw_unit_price      numeric(14, 4),
  raw_subtotal        numeric(14, 2),
  -- Match al catálogo interno
  sku_id              uuid references skus(id),
  matched_quantity    numeric(14, 4),             -- cantidad en unidad canónica
  matched_unit        text references units_of_measure(code),
  matched_unit_price  numeric(14, 4),             -- precio por unidad canónica
  -- Metadata del matching
  match_status        match_status not null default 'manual',
  match_confidence    numeric(4, 3),              -- 0.000 a 1.000
  match_method        text,                       -- "alias_exact", "alias_fuzzy", "embedding", "manual"
  -- Correcciones del operador
  override_sku_id     uuid references skus(id),   -- si el operador cambió el match
  override_notes      text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index idx_invoice_lines_invoice on invoice_lines(invoice_id);
create index idx_invoice_lines_sku on invoice_lines(sku_id);
create index idx_invoice_lines_match_status on invoice_lines(match_status);

-- ============================================================
-- HISTORIAL DE PRECIOS
-- ============================================================

create table price_history (
  id              uuid primary key default uuid_generate_v4(),
  sku_id          uuid not null references skus(id),
  supplier_id     uuid not null references suppliers(id),
  invoice_id      uuid references invoices(id),
  invoice_line_id uuid references invoice_lines(id),
  invoice_date    date not null,
  unit_price      numeric(14, 4) not null,        -- precio por unidad canónica
  unit            text not null references units_of_measure(code),
  currency        text not null default 'MXN',
  created_at      timestamptz not null default now()
);

create index idx_price_history_sku_supplier on price_history(sku_id, supplier_id);
create index idx_price_history_date on price_history(invoice_date desc);
create index idx_price_history_sku_date on price_history(sku_id, invoice_date desc);

-- Vista útil: último precio por SKU × proveedor
create view latest_prices as
select distinct on (ph.sku_id, ph.supplier_id)
  ph.sku_id,
  ph.supplier_id,
  s.name  as sku_name,
  sup.name as supplier_name,
  ph.unit_price,
  ph.unit,
  ph.invoice_date,
  ph.invoice_id
from price_history ph
join skus s on s.id = ph.sku_id
join suppliers sup on sup.id = ph.supplier_id
order by ph.sku_id, ph.supplier_id, ph.invoice_date desc;

-- ============================================================
-- ALERTAS DE PRECIO
-- ============================================================

create type alert_type as enum (
  'price_increase',       -- subió más de X% vs último precio
  'price_increase_avg',   -- subió más de X% vs promedio 30 días
  'recipe_cost_threshold' -- costo de receta cruzó umbral (v2)
);

create type alert_status as enum (
  'active',
  'acknowledged',
  'resolved'
);

create table price_alerts (
  id              uuid primary key default uuid_generate_v4(),
  sku_id          uuid not null references skus(id),
  supplier_id     uuid not null references suppliers(id),
  invoice_id      uuid references invoices(id),
  alert_type      alert_type not null,
  status          alert_status not null default 'active',
  -- Datos del alert
  previous_price  numeric(14, 4),
  new_price       numeric(14, 4),
  change_pct      numeric(8, 4),                  -- porcentaje de cambio
  threshold_pct   numeric(8, 4),                  -- umbral que se configuró
  message         text,
  -- Seguimiento
  acknowledged_by uuid,
  acknowledged_at timestamptz,
  created_at      timestamptz not null default now()
);

create index idx_price_alerts_status on price_alerts(status);
create index idx_price_alerts_sku on price_alerts(sku_id);

-- ============================================================
-- TRIGGERS: updated_at automático
-- ============================================================

create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger suppliers_updated_at
  before update on suppliers
  for each row execute function set_updated_at();

create trigger skus_updated_at
  before update on skus
  for each row execute function set_updated_at();

create trigger sku_aliases_updated_at
  before update on sku_aliases
  for each row execute function set_updated_at();

create trigger invoices_updated_at
  before update on invoices
  for each row execute function set_updated_at();

create trigger invoice_lines_updated_at
  before update on invoice_lines
  for each row execute function set_updated_at();

-- ============================================================
-- RLS (Row Level Security) — base mínima
-- ============================================================

alter table suppliers enable row level security;
alter table supplier_aliases enable row level security;
alter table skus enable row level security;
alter table sku_aliases enable row level security;
alter table invoices enable row level security;
alter table invoice_lines enable row level security;
alter table price_history enable row level security;
alter table price_alerts enable row level security;

-- Por ahora: service_role tiene acceso total (el backend usa service_role key)
-- Agregar políticas de usuario cuando integres auth de PB Control
create policy "service_role_all" on suppliers to service_role using (true) with check (true);
create policy "service_role_all" on supplier_aliases to service_role using (true) with check (true);
create policy "service_role_all" on skus to service_role using (true) with check (true);
create policy "service_role_all" on sku_aliases to service_role using (true) with check (true);
create policy "service_role_all" on invoices to service_role using (true) with check (true);
create policy "service_role_all" on invoice_lines to service_role using (true) with check (true);
create policy "service_role_all" on price_history to service_role using (true) with check (true);
create policy "service_role_all" on price_alerts to service_role using (true) with check (true);
