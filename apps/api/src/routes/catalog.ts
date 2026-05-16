import type { FastifyInstance } from 'fastify'
import { supabase } from '../lib/supabase.js'

export async function catalogRoutes(fastify: FastifyInstance) {
  // ── GET /skus — buscar SKUs del catálogo ─────────────────────────────────
  fastify.get('/skus', async (request, reply) => {
    const query = request.query as any
    const search = query.search
    const category = query.category

    let q = supabase
      .from('skus')
      .select('id, code, name, description, category, unit, active')
      .eq('active', true)
      .order('name')
      .limit(50)

    if (search) q = q.ilike('name', `%${search}%`)
    if (category) q = q.eq('category', category)

    const { data, error } = await q
    if (error) return reply.status(500).send({ error: error.message })
    return { data }
  })

  // ── POST /skus — crear nuevo SKU ─────────────────────────────────────────
  fastify.post('/skus', async (request, reply) => {
    const body = request.body as {
      code: string
      name: string
      description?: string
      category?: string
      unit: string
    }

    const { data, error } = await supabase
      .from('skus')
      .insert(body)
      .select('id, code, name')
      .single()

    if (error) return reply.status(500).send({ error: error.message })
    return reply.status(201).send(data)
  })

  // ── GET /suppliers — listar proveedores ───────────────────────────────────
  fastify.get('/suppliers', async (request, reply) => {
    const { data, error } = await supabase
      .from('suppliers')
      .select('id, name, rfc, email, active')
      .eq('active', true)
      .order('name')

    if (error) return reply.status(500).send({ error: error.message })
    return { data }
  })

  // ── GET /price-history/:skuId — historial de precios de un SKU ───────────
  fastify.get('/price-history/:skuId', async (request, reply) => {
    const { skuId } = request.params as { skuId: string }
    const query = request.query as any
    const supplierId = query.supplier_id
    const days = parseInt(query.days ?? '90')

    const since = new Date()
    since.setDate(since.getDate() - days)

    let q = supabase
      .from('price_history')
      .select(`
        id, invoice_date, unit_price, unit, currency,
        suppliers ( id, name )
      `)
      .eq('sku_id', skuId)
      .gte('invoice_date', since.toISOString().split('T')[0])
      .order('invoice_date', { ascending: false })

    if (supplierId) q = q.eq('supplier_id', supplierId)

    const { data, error } = await q
    if (error) return reply.status(500).send({ error: error.message })
    return { data }
  })

  // ── GET /alerts — alertas de precio activas ───────────────────────────────
  fastify.get('/alerts', async (request, reply) => {
    const { data, error } = await supabase
      .from('price_alerts')
      .select(`
        id, alert_type, status, change_pct, previous_price, new_price, message, created_at,
        skus ( id, code, name ),
        suppliers ( id, name )
      `)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(50)

    if (error) return reply.status(500).send({ error: error.message })
    return { data }
  })

  // ── PATCH /alerts/:id/acknowledge — marcar alerta como vista ─────────────
  fastify.patch('/alerts/:id/acknowledge', async (request, reply) => {
    const { id } = request.params as { id: string }
    const body = request.body as { acknowledged_by?: string }

    const { error } = await supabase
      .from('price_alerts')
      .update({
        status: 'acknowledged',
        acknowledged_by: body.acknowledged_by,
        acknowledged_at: new Date().toISOString(),
      })
      .eq('id', id)

    if (error) return reply.status(500).send({ error: error.message })
    return { ok: true }
  })
}
