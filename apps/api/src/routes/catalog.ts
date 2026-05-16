import type { FastifyInstance } from 'fastify'
import { query, queryOne } from '../lib/db.js'

export async function catalogRoutes(fastify: FastifyInstance) {

  // ── GET /skus ──────────────────────────────────────────────────────────────
  fastify.get('/skus', async (request, reply) => {
    const q = request.query as any
    const search   = q.search   ?? ''
    const category = q.category ?? ''

    const rows = await query<any>(`
      select id, code, name, description, category, unit, active
      from skus
      where active = true
        and ($1 = '' or name ilike '%' || $1 || '%')
        and ($2 = '' or category = $2)
      order by name
      limit 50
    `, [search, category])

    return { data: rows }
  })

  // ── POST /skus ─────────────────────────────────────────────────────────────
  fastify.post('/skus', async (request, reply) => {
    const body = request.body as {
      code: string
      name: string
      description?: string
      category?: string
      unit: string
    }

    const row = await queryOne<any>(`
      insert into skus (code, name, description, category, unit)
      values ($1, $2, $3, $4, $5)
      returning id, code, name
    `, [body.code, body.name, body.description ?? null, body.category ?? null, body.unit])

    return reply.status(201).send(row)
  })

  // ── GET /suppliers ─────────────────────────────────────────────────────────
  fastify.get('/suppliers', async (_request, reply) => {
    const rows = await query<any>(`
      select id, name, rfc, email, active
      from suppliers
      where active = true
      order by name
    `)
    return { data: rows }
  })

  // ── POST /suppliers ────────────────────────────────────────────────────────
  fastify.post('/suppliers', async (request, reply) => {
    const body = request.body as {
      name: string
      rfc?: string
      email?: string
      phone?: string
    }

    const row = await queryOne<any>(`
      insert into suppliers (name, rfc, email, phone)
      values ($1, $2, $3, $4)
      returning id, name, rfc
    `, [body.name, body.rfc ?? null, body.email ?? null, body.phone ?? null])

    return reply.status(201).send(row)
  })

  // ── GET /price-history/:skuId ──────────────────────────────────────────────
  fastify.get('/price-history/:skuId', async (request, reply) => {
    const { skuId } = request.params as { skuId: string }
    const q = request.query as any
    const supplierId = q.supplier_id ?? null
    const days = parseInt(q.days ?? '90')

    const rows = await query<any>(`
      select
        ph.id, ph.invoice_date, ph.unit_price, ph.unit, ph.currency,
        s.id as supplier_id, s.name as supplier_name
      from price_history ph
      join suppliers s on s.id = ph.supplier_id
      where ph.sku_id = $1
        and ph.invoice_date >= current_date - ($2 || ' days')::interval
        and ($3::uuid is null or ph.supplier_id = $3::uuid)
      order by ph.invoice_date desc
    `, [skuId, days, supplierId])

    return {
      data: rows.map(r => ({
        ...r,
        suppliers: { id: r.supplier_id, name: r.supplier_name },
      }))
    }
  })

  // ── GET /alerts ────────────────────────────────────────────────────────────
  fastify.get('/alerts', async (_request, reply) => {
    const rows = await query<any>(`
      select
        pa.id, pa.alert_type, pa.status, pa.change_pct,
        pa.previous_price, pa.new_price, pa.message, pa.created_at,
        sk.id as sku_id, sk.code as sku_code, sk.name as sku_name,
        sup.id as supplier_id, sup.name as supplier_name
      from price_alerts pa
      join skus sk on sk.id = pa.sku_id
      join suppliers sup on sup.id = pa.supplier_id
      where pa.status = 'active'
      order by pa.created_at desc
      limit 50
    `)

    return {
      data: rows.map(r => ({
        ...r,
        skus:      { id: r.sku_id,      code: r.sku_code, name: r.sku_name },
        suppliers: { id: r.supplier_id, name: r.supplier_name },
      }))
    }
  })

  // ── PATCH /alerts/:id/acknowledge ─────────────────────────────────────────
  fastify.patch('/alerts/:id/acknowledge', async (request, reply) => {
    const { id } = request.params as { id: string }
    const body = request.body as { acknowledged_by?: string }

    await query(`
      update price_alerts set
        status          = 'acknowledged',
        acknowledged_by = $1,
        acknowledged_at = now()
      where id = $2
    `, [body.acknowledged_by ?? 'system', id])

    return { ok: true }
  })
}
