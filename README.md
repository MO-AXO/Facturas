# Facturas — Agente de procesamiento de facturas de proveedores

Sistema para capturar, extraer y normalizar facturas de proveedores usando Claude Vision, con UI de revisión humana y actualización automática de precios en el catálogo.

## Arquitectura

```
facturas/
├── apps/
│   ├── api/          # Backend Node.js + Fastify + BullMQ
│   └── web/          # Frontend React (UI de revisión)
├── packages/
│   ├── db/           # Schema SQL, migraciones, seeds
│   └── shared/       # Tipos TypeScript compartidos
└── infra/            # Config Railway, variables de entorno
```

## Stack

- **Backend**: Node.js + Fastify, Railway
- **Frontend**: React + Vite
- **DB**: Supabase (PostgreSQL + pgvector + Storage + Auth)
- **AI**: Anthropic Claude (extracción OCR + matching)
- **Queue**: BullMQ + Redis
- **Monorepo**: Turborepo

## Flujo principal

1. Operador sube foto/PDF de factura desde la UI
2. Job async extrae datos con Claude Vision → JSON estructurado
3. Motor de matching busca proveedor y SKUs en catálogo (`sku_aliases` → fuzzy)
4. UI de revisión muestra resultado con nivel de confianza (verde/amarillo/rojo)
5. Operador aprueba o corrige inline
6. Al commit: inserta en `price_history`, dispara recálculo de recetas, evalúa alertas

## Modelo de datos (tablas clave)

| Tabla | Propósito |
|-------|-----------|
| `suppliers` | Proveedores canónicos |
| `supplier_aliases` | Nombres alternativos en facturas |
| `skus` | Catálogo interno con unidad canónica |
| `sku_aliases` | Cómo cada proveedor llama a cada SKU |
| `units_of_measure` | Unidades + factores de conversión |
| `invoices` | Header de factura (proveedor, fecha, folio, status) |
| `invoice_lines` | Líneas con descripción cruda + SKU matcheado |
| `price_history` | SKU × proveedor × fecha — fuente de verdad de precios |
| `price_alerts` | Reglas y notificaciones de variación de precio |

## Setup local

```bash
# 1. Instalar dependencias
npm install

# 2. Copiar variables de entorno
cp .env.example .env
# Editar .env con tus credenciales

# 3. Correr migraciones
npm run db:migrate

# 4. Desarrollo
npm run dev
```

## Variables de entorno requeridas

Ver `.env.example` para la lista completa. Las principales:

- `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`
- `ANTHROPIC_API_KEY`
- `REDIS_URL`

## Roadmap

### MVP (v1)
- [x] Modelo de datos
- [ ] Upload de foto/PDF
- [ ] Extracción con Claude Vision
- [ ] Matching exacto por `sku_aliases`
- [ ] UI de revisión (split view)
- [ ] Actualización de `price_history`

### v2
- [ ] Embeddings pgvector para matching semántico
- [ ] Recálculo automático de recetas
- [ ] Alertas de precio (WhatsApp / email)
- [ ] Ingreso por email (SendGrid Inbound Parse)
- [ ] CFDI XML parsing
