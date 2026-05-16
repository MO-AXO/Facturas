# Deploy en Railway

## Servicios necesarios

1. **Redis** — agregar plugin Redis en Railway, se inyecta como `REDIS_URL`
2. **API** — apunta a `apps/api`, usa `railway.api.json`
3. **Web** — apunta a `apps/web`, usa `railway.web.json`

## Variables de entorno para el servicio API en Railway

```
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
ANTHROPIC_API_KEY=
REDIS_URL=           # se inyecta automáticamente si usas Redis plugin
NODE_ENV=production
CORS_ORIGIN=         # URL pública del servicio web
PORT=3000            # Railway lo inyecta automáticamente
```

## Variables de entorno para el servicio Web en Railway

```
VITE_API_URL=        # URL pública del servicio API (en build time)
```

## Pasos

1. Crear proyecto en Railway
2. Agregar plugin Redis
3. New Service → GitHub repo → carpeta `apps/api`
4. New Service → GitHub repo → carpeta `apps/web`
5. Configurar variables de entorno en cada servicio
6. Deploy

## Nota sobre monorepo

Railway detecta el root del repo. Para apuntar a un subdirectorio específico,
en la config del servicio en Railway UI: Settings → Source → Root Directory →
`apps/api` o `apps/web`.
