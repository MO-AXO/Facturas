-- ============================================================
-- Migración 003: Configuración de Supabase Storage
-- Ejecutar en SQL Editor de Supabase Dashboard
-- ============================================================

-- Crear bucket para facturas (si no existe)
-- NOTA: También puedes crearlo desde el Dashboard > Storage > New bucket
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'facturas',
  'facturas',
  false,                                          -- privado, se accede por signed URLs
  20971520,                                       -- 20 MB máx
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf']
)
on conflict (id) do nothing;

-- ── Políticas de Storage ─────────────────────────────────────────────────────

-- El service_role (backend) puede hacer todo
create policy "service_role_storage_all"
  on storage.objects
  for all
  to service_role
  using (bucket_id = 'facturas')
  with check (bucket_id = 'facturas');

-- Usuarios autenticados pueden subir sus propios archivos
-- (ajustar cuando integres auth de PB Control)
create policy "auth_users_upload"
  on storage.objects
  for insert
  to authenticated
  with check (bucket_id = 'facturas');

-- Usuarios autenticados pueden ver archivos (para signed URLs)
create policy "auth_users_select"
  on storage.objects
  for select
  to authenticated
  using (bucket_id = 'facturas');
