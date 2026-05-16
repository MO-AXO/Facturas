-- Seed 001: Unidades de medida base

insert into units_of_measure (code, name, base_unit) values
  ('kg',  'Kilogramo', null),
  ('g',   'Gramo',     'kg'),
  ('lt',  'Litro',     null),
  ('ml',  'Mililitro', 'lt'),
  ('pza', 'Pieza',     null),
  ('cja', 'Caja',      null),
  ('blt', 'Bulto',     null),
  ('cos', 'Costal',    null),
  ('lta', 'Lata',      null),
  ('bot', 'Botella',   null),
  ('doc', 'Docena',    'pza'),
  ('por', 'Porción',   null)
on conflict (code) do nothing;

insert into unit_conversions (from_unit, to_unit, factor, notes) values
  ('g',   'kg',  0.001,  '1 g = 0.001 kg'),
  ('kg',  'g',   1000.0, '1 kg = 1000 g'),
  ('ml',  'lt',  0.001,  '1 ml = 0.001 lt'),
  ('lt',  'ml',  1000.0, '1 lt = 1000 ml'),
  ('doc', 'pza', 12.0,   '1 docena = 12 piezas')
on conflict (from_unit, to_unit) do nothing;
