-- ============================================================
-- Migración 001: Schema inicial — PostgreSQL estándar (Railway)
-- Sin extensiones de Supabase. Solo uuid-ossp y pg_trgm.
-- ============================================================

create extension if not exists "uuid-ossp";
create extension if not exists "pg_trgm";

-- ============================================================
-- UNIDADES DE MEDIDA
-- ============================================================

create table if not exists units_of_measure (
  id         uuid primary key default uuid_generate_v4(),
  code       text not null unique,
  name       text not null,
  base_unit  text,
  created_at timestamptz not null default now()
);

create table if not exists unit_conversions (
  id         uuid primary key default uuid_generate_v4(),
  from_unit  text not null references units_of_measure(code),
  to_unit    text not null references units_of_measure(code),
  factor     numeric(18,6) not null,
  notes      text,
  created_at timestamptz not null default now(),
  unique(from_unit, to_unit)
);

-- ============================================================
-- PROVEEDORES
-- ============================================================

create table if not exists suppliers (
  id         uuid primary key default uuid_generate_v4(),
  name       text not null,
  rfc        text unique,
  email      text,
  phone      text,
  active     boolean not null default true,
  notes      text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists supplier_aliases (
  id          uuid primary key default uuid_generate_v4(),
  supplier_id uuid not null references suppliers(id) on delete cascade,
  alias       text not null,
  source      text,
  created_at  timestamptz not null default now(),
  unique(alias)
);

create index if not exists idx_supplier_aliases_alias
  on supplier_aliases using gin(alias gin_trgm_ops);

-- ============================================================
-- CATÁLOGO DE SKUs
-- ============================================================

create table if not exists skus (
  id          uuid primary key default uuid_generate_v4(),
  code        text not null unique,
  name        text not null,
  description text,
  category    text,
  unit        text not null references units_of_measure(code),
  active      boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists idx_skus_name_trgm
  on skus using gin(name gin_trgm_ops);

create table if not exists sku_aliases (
  id           uuid primary key default uuid_generate_v4(),
  sku_id       uuid not null references skus(id) on delete cascade,
  supplier_id  uuid not null references suppliers(id) on delete cascade,
  alias        text not null,
  unit_alias   text,
  unit_factor  numeric(18,6) default 1.0,
  confirmed_by text,
  confirmed_at timestamptz,
  times_seen   integer not null default 1,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique(supplier_id, alias)
);

create index if not exists idx_sku_aliases_alias
  on sku_aliases using gin(alias gin_trgm_ops);
create index if not exists idx_sku_aliases_supplier
  on sku_aliases(supplier_id);
create index if not exists idx_sku_aliases_sku
  on sku_aliases(sku_id);

-- ============================================================
-- FACTURAS
-- ============================================================

create type invoice_status as enum (
  'pending', 'extracting', 'review', 'approved', 'rejected', 'error'
);

create table if not exists invoices (
  id            uuid primary key default uuid_generate_v4(),
  supplier_id   uuid references suppliers(id),
  folio         text,
  invoice_date  date,
  subtotal      numeric(14,2),
  tax_amount    numeric(14,2),
  total         numeric(14,2),
  currency      text not null default 'MXN',
  status        invoice_status not null default 'pending',
  -- Sin archivo físico: guardamos nombre original y tipo por referencia
  file_name     text,
  file_type     text,
  raw_extraction jsonb,
  extracted_at  timestamptz,
  approved_at   timestamptz,
  approved_by   text,
  error_message text,
  notes         text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists idx_invoices_status   on invoices(status);
create index if not exists idx_invoices_supplier on invoices(supplier_id);
create index if not exists idx_invoices_date     on invoices(invoice_date desc);

-- ============================================================
-- LÍNEAS DE FACTURA
-- ============================================================

create type match_status as enum (
  'auto', 'suggested', 'manual', 'confirmed', 'new_sku'
);

create table if not exists invoice_lines (
  id                 uuid primary key default uuid_generate_v4(),
  invoice_id         uuid not null references invoices(id) on delete cascade,
  line_number        integer not null,
  raw_description    text not null,
  raw_quantity       numeric(14,4),
  raw_unit           text,
  raw_unit_price     numeric(14,4),
  raw_subtotal       numeric(14,2),
  sku_id             uuid references skus(id),
  matched_quantity   numeric(14,4),
  matched_unit       text references units_of_measure(code),
  matched_unit_price numeric(14,4),
  match_status       match_status not null default 'manual',
  match_confidence   numeric(4,3),
  match_method       text,
  override_sku_id    uuid references skus(id),
  override_notes     text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create index if not exists idx_invoice_lines_invoice     on invoice_lines(invoice_id);
create index if not exists idx_invoice_lines_sku         on invoice_lines(sku_id);
create index if not exists idx_invoice_lines_match       on invoice_lines(match_status);

-- ============================================================
-- HISTORIAL DE PRECIOS
-- ============================================================

create table if not exists price_history (
  id              uuid primary key default uuid_generate_v4(),
  sku_id          uuid not null references skus(id),
  supplier_id     uuid not null references suppliers(id),
  invoice_id      uuid references invoices(id),
  invoice_line_id uuid references invoice_lines(id),
  invoice_date    date not null,
  unit_price      numeric(14,4) not null,
  unit            text not null references units_of_measure(code),
  currency        text not null default 'MXN',
  created_at      timestamptz not null default now()
);

create index if not exists idx_price_history_sku_supplier on price_history(sku_id, supplier_id);
create index if not exists idx_price_history_date         on price_history(invoice_date desc);

-- ============================================================
-- ALERTAS DE PRECIO
-- ============================================================

create type alert_type as enum (
  'price_increase', 'price_decrease', 'price_increase_avg'
);

create type alert_status as enum (
  'active', 'acknowledged', 'resolved'
);

create table if not exists price_alerts (
  id              uuid primary key default uuid_generate_v4(),
  sku_id          uuid not null references skus(id),
  supplier_id     uuid not null references suppliers(id),
  invoice_id      uuid references invoices(id),
  alert_type      alert_type not null,
  status          alert_status not null default 'active',
  previous_price  numeric(14,4),
  new_price       numeric(14,4),
  change_pct      numeric(8,4),
  threshold_pct   numeric(8,4),
  message         text,
  acknowledged_by text,
  acknowledged_at timestamptz,
  created_at      timestamptz not null default now()
);

create index if not exists idx_price_alerts_status on price_alerts(status);
create index if not exists idx_price_alerts_sku    on price_alerts(sku_id);

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

create or replace trigger suppliers_updated_at
  before update on suppliers
  for each row execute function set_updated_at();

create or replace trigger skus_updated_at
  before update on skus
  for each row execute function set_updated_at();

create or replace trigger sku_aliases_updated_at
  before update on sku_aliases
  for each row execute function set_updated_at();

create or replace trigger invoices_updated_at
  before update on invoices
  for each row execute function set_updated_at();

create or replace trigger invoice_lines_updated_at
  before update on invoice_lines
  for each row execute function set_updated_at();
