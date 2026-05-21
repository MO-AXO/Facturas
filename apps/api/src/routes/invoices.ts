import type { FastifyInstance } from 'fastify'
import { query, queryOne } from '../lib/db.js'
import { invoiceQueue, priceUpdateQueue } from '../lib/queue.js'
import { learnAlias } from '../services/matching.js'
import { extractInvoiceData } from '../services/extraction.js'
import { matchLine } from '../services/matching.js'

export async function invoiceRoutes(fastify: FastifyInstance) {

  // ── POST /invoices — subir factura y procesar en el mismo request ──────────
  // Sin storage: recibimos el archivo, lo procesamos con Claude en memoria,
  // guardamos solo los datos extraídos en PostgreSQL.
  fastify.post('/invoices', async (request, reply) => {
    const data = await (request as any).file()

    if (!data) {
      return reply.status(400).send({ error: 'No se recibió archivo' })
    }

    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
    if (!allowedTypes.includes(data.mimetype)) {
      return reply.status(400).send({ error: `Tipo de archivo no permitido: ${data.mimetype}` })
    }

    const buffer = await data.toBuffer()
    const base64  = buffer.toString('base64')
    const mediaType = data.mimetype as any

    // Crear registro inicial
    const invoice = await queryOne<{ id: string }>(`
      insert into invoices (file_name, file_type, status)
      values ($1, $2, 'extracting')
      returning id
    `, [data.filename, data.mimetype])

    if (!invoice) {
      return reply.status(500).send({ error: 'Error creando factura' })
    }

    // Encolar job de extracción — pasamos base64 en el job (imagen en memoria)
    await invoiceQueue.add('process', {
      invoiceId: invoice.id,
      base64,
      mediaType,
      fileName: data.filename,
    })

    return reply.status(201).send({ invoiceId: invoice.id, status: 'extracting' })
  })

  // ── GET /invoices ──────────────────────────────────────────────────────────
  fastify.get('/invoices', async (request, reply) => {
    const q = request.query as any
    const status = q.status
    const page   = parseInt(q.page  ?? '1')
    const limit  = parseInt(q.limit ?? '20')
    const offset = (page - 1) * limit

    const whereClause = status ? `where i.status = $3` : ''
    const params: any[] = [limit, offset]
    if (status) params.push(status)

    const rows = await query<any>(`
      select
        i.id, i.folio, i.invoice_date, i.total, i.currency, i.status,
        i.created_at, i.extracted_at, i.approved_at, i.file_name,
        s.id as supplier_id, s.name as supplier_name
      from invoices i
      left join suppliers s on s.id = i.supplier_id
      ${whereClause}
      order by i.created_at desc
      limit $1 offset $2
    `, params)

    const countRow = await queryOne<{ count: string }>(`
      select count(*) as count from invoices ${status ? 'where status = $1' : ''}
    `, status ? [status] : [])

    const data = rows.map(r => ({
      ...r,
      suppliers: r.supplier_id ? { id: r.supplier_id, name: r.supplier_name } : null,
    }))

    return { data, total: parseInt(countRow?.count ?? '0'), page, limit }
  })

  // ── GET /invoices/:id ──────────────────────────────────────────────────────
  fastify.get('/invoices/:id', async (request, reply) => {
    const { id } = request.params as { id: string }

    const invoice = await queryOne<any>(`
      select
        i.*,
        s.id as supplier_id, s.name as supplier_name, s.rfc as supplier_rfc
      from invoices i
      left join suppliers s on s.id = i.supplier_id
      where i.id = $1
    `, [id])

    if (!invoice) return reply.status(404).send({ error: 'Factura no encontrada' })

    const lines = await query<any>(`
      select
        il.*,
        sk.id as sku_id_rel, sk.code as sku_code, sk.name as sku_name, sk.unit as sku_unit
      from invoice_lines il
      left join skus sk on sk.id = il.sku_id
      where il.invoice_id = $1
      order by il.line_number
    `, [id])

    return {
      ...invoice,
      suppliers: invoice.supplier_id
        ? { id: invoice.supplier_id, name: invoice.supplier_name, rfc: invoice.supplier_rfc }
        : null,
      invoice_lines: lines.map(l => ({
        ...l,
        skus: l.sku_id_rel
          ? { id: l.sku_id_rel, code: l.sku_code, name: l.sku_name, unit: l.sku_unit }
          : null,
      })),
    }
  })

  // ── PATCH /invoices/:id/lines/:lineId ─────────────────────────────────────
  fastify.patch('/invoices/:id/lines/:lineId', async (request, reply) => {
    const { lineId } = request.params as { id: string; lineId: string }
    const body = request.body as {
      sku_id?: string
      matched_quantity?: number
      matched_unit?: string
      matched_unit_price?: number
      override_notes?: string
    }

    await query(`
      update invoice_lines set
        sku_id             = $1,
        override_sku_id    = $1,
        matched_quantity   = $2,
        matched_unit       = $3,
        matched_unit_price = $4,
        override_notes     = $5,
        match_status       = 'confirmed',
        match_confidence   = 1.0,
        updated_at         = now()
      where id = $6
    `, [body.sku_id, body.matched_quantity, body.matched_unit,
        body.matched_unit_price, body.override_notes, lineId])

    return { ok: true }
  })

  // ── POST /invoices/:id/lines/:lineId/create-sku ───────────────────────────
  // Crea un SKU nuevo a partir de la sugerencia de Claude, lo vincula a la línea
  // y aprende el alias para el proveedor.
  fastify.post('/invoices/:id/lines/:lineId/create-sku', async (request, reply) => {
    const { id, lineId } = request.params as { id: string; lineId: string }
    const body = (request.body as {
      name: string
      code: string
      unit: string
      category?: string
      description?: string
    }) ?? {}

    if (!body.name || !body.code || !body.unit) {
      return reply.status(400).send({ error: 'name, code y unit son requeridos' })
    }

    // Verificar que el código no esté duplicado
    const existing = await queryOne<{ id: string }>(`
      select id from skus where lower(code) = lower($1) limit 1
    `, [body.code])
    if (existing) {
      return reply.status(409).send({ error: `Ya existe un SKU con código "${body.code}"` })
    }

    // Crear el SKU
    const sku = await queryOne<{ id: string; code: string; name: string; unit: string }>(`
      insert into skus (code, name, unit, category, description)
      values ($1, $2, $3, $4, $5)
      returning id, code, name, unit
    `, [body.code.toUpperCase(), body.name, body.unit, body.category ?? null, body.description ?? null])

    if (!sku) return reply.status(500).send({ error: 'Error creando SKU' })

    // Leer la línea para obtener raw_description y la factura para obtener supplier_id
    const line = await queryOne<{ raw_description: string; raw_unit: string | null }>(`
      select raw_description, raw_unit from invoice_lines where id = $1
    `, [lineId])

    const invoice = await queryOne<{ supplier_id: string | null }>(`
      select supplier_id from invoices where id = $1
    `, [id])

    // Aprender el alias raw_description → nuevo SKU para este proveedor
    if (invoice?.supplier_id && line?.raw_description) {
      await query(`
        insert into sku_aliases (sku_id, supplier_id, alias, unit_alias, unit_factor, confirmed_by, confirmed_at, times_seen)
        values ($1, $2, $3, $4, 1, 'operator', now(), 1)
        on conflict (supplier_id, alias) do update set
          sku_id       = excluded.sku_id,
          confirmed_at = now(),
          times_seen   = sku_aliases.times_seen + 1
      `, [sku.id, invoice.supplier_id, line.raw_description.trim(), line.raw_unit])
    }

    // Vincular el SKU a la línea y marcarla como confirmed
    const lineData = await queryOne<any>(`
      select raw_quantity, raw_unit_price, raw_quantity as q from invoice_lines where id = $1
    `, [lineId])

    await query(`
      update invoice_lines set
        sku_id             = $1,
        match_status       = 'confirmed',
        match_confidence   = 1.0,
        match_method       = 'new_sku',
        matched_unit       = $2,
        matched_quantity   = $3,
        matched_unit_price = $4,
        override_notes     = null,
        updated_at         = now()
      where id = $5
    `, [sku.id, body.unit, lineData?.raw_quantity ?? null, lineData?.raw_unit_price ?? null, lineId])

    return reply.status(201).send({ ok: true, sku })
  })

  // ── POST /invoices/:id/approve ─────────────────────────────────────────────
  fastify.post('/invoices/:id/approve', async (request, reply) => {
    const { id } = request.params as { id: string }
    const body = (request.body as { approved_by?: string }) ?? {}

    const invoice = await queryOne<any>(`
      select status, supplier_id from invoices where id = $1
    `, [id])

    if (!invoice || invoice.status !== 'review') {
      return reply.status(400).send({ error: 'La factura debe estar en estado "review"' })
    }

    // Aprender aliases de líneas auto/confirmadas
    if (invoice.supplier_id) {
      const lines = await query<any>(`
        select raw_description, raw_unit, sku_id, match_status
        from invoice_lines
        where invoice_id = $1
          and sku_id is not null
          and match_status in ('confirmed', 'auto')
      `, [id])

      for (const line of lines) {
        await learnAlias({
          skuId: line.sku_id,
          supplierId: invoice.supplier_id,
          alias: line.raw_description,
          unitAlias: line.raw_unit,
          unitFactor: 1,
          confirmedBy: body.approved_by ?? 'system',
        })
      }
    }

    await priceUpdateQueue.add('update-prices', {
      invoiceId: id,
      approvedBy: body.approved_by ?? 'system',
    })

    return { ok: true }
  })

  // ── POST /invoices/:id/reject ──────────────────────────────────────────────
  fastify.post('/invoices/:id/reject', async (request, reply) => {
    const { id } = request.params as { id: string }
    const body = (request.body as { reason?: string }) ?? {}

    await query(`
      update invoices set status = 'rejected', notes = $1, updated_at = now()
      where id = $2
    `, [body.reason ?? null, id])

    return { ok: true }
  })
}
