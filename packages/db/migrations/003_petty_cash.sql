-- ============================================================
-- Migración 003: Caja chica (petty cash)
-- ============================================================

create type payment_method as enum ('cash', 'transfer');

create table if not exists petty_cash_expenses (
  id          uuid primary key default uuid_generate_v4(),
  expense_date date not null default current_date,
  description text not null,
  amount      numeric(12,2) not null check (amount > 0),
  method      payment_method not null default 'cash',
  category    text not null default 'Varios',
  notes       text,
  created_by  text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists idx_petty_cash_date     on petty_cash_expenses(expense_date desc);
create index if not exists idx_petty_cash_category on petty_cash_expenses(category);
create index if not exists idx_petty_cash_method   on petty_cash_expenses(method);

create or replace trigger petty_cash_updated_at
  before update on petty_cash_expenses
  for each row execute function set_updated_at();
