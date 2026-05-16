-- ============================================================
-- Seed 001: Datos base
-- Unidades de medida comunes en restaurante mexicano
-- ============================================================

-- Unidades de medida
insert into units_of_measure (code, name, base_unit) values
  ('kg',   'Kilogramo',    null),
  ('g',    'Gramo',        'kg'),
  ('lt',   'Litro',        null),
  ('ml',   'Mililitro',    'lt'),
  ('pza',  'Pieza',        null),
  ('cja',  'Caja',         null),
  ('blt',  'Bulto',        null),
  ('cos',  'Costal',       null),
  ('lta',  'Lata',         null),
  ('bot',  'Botella',      null),
  ('doc',  'Docena',       'pza'),
  ('por',  'Porción',      null)
on conflict (code) do nothing;

-- Conversiones comunes
insert into unit_conversions (from_unit, to_unit, factor, notes) values
  ('g',   'kg',  0.001,   '1 gramo = 0.001 kg'),
  ('kg',  'g',   1000.0,  '1 kg = 1000 gramos'),
  ('ml',  'lt',  0.001,   '1 ml = 0.001 litro'),
  ('lt',  'ml',  1000.0,  '1 litro = 1000 ml'),
  ('doc', 'pza', 12.0,    '1 docena = 12 piezas')
on conflict (from_unit, to_unit) do nothing;
