import type { FastifyInstance } from 'fastify'
import { supabase } from '../lib/supabase.js'
import { invoiceQueue, priceUpdateQueue } from '../lib/queue.js'
import { learnAlias } from '../services/matching.js'

export async function invoiceRoutes(fastify: FastifyInstance) {
  // ── POST /invoices — subir nueva factura ───────────────────────────────────
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
    const filename = `${Date.now()}-${data.filename}`
    const storagePath = `uploads/${filename}`

    // Subir a Supabase Storage
    const { error: uploadError } = await supabase.storage
      .from('facturas')
      .upload(storagePath, buffer, { contentType: data.mimetype })

    if (uploadError) {
      return reply.status(500).send({ error: `Error subiendo archivo: ${uploadError.message}` })
    }

    // Crear registro de factura
    const { data: invoice, error: insertError } = await supabase
      .from('invoices')
      .insert({
        storage_path: storagePath,
        storage_bucket: 'facturas',
        file_type: data.mimetype,
        status: 'pending',
      })
      .select('id')
      .single()

    if (insertError || !invoice) {
      return reply.status(500).send({ error: `Error creando factura: ${insertError?.message}` })
    }

    // Encolar job de procesamiento
    await invoiceQueue.add('process', {
      invoiceId: invoice.id,
      storagePath,
      fileType: data.mimetype,
    })

    return reply.status(201).send({ invoiceId: invoice.id, status: 'pending' })
  })

  // ── GET /invoices — listar facturas ───────────────────────────────────────
  fastify.get('/invoices', async (request, reply) => {
    const query = request.query as any
    const status = query.status
    const page = parseInt(query.page ?? '1')
    const limit = parseInt(query.limit ?? '20')
    const offset = (page - 1) * limit

    let q = supabase
      .from('invoices')
      .select(`
        id, folio, invoice_date, total, currency, status,
        created_at, extracted_at, approved_at,
        suppliers ( id, name )
      `, { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (status) q = q.eq('status', status)

    const { data, count, error } = await q

    if (error) return reply.status(500).send({ error: error.message })
    return { data, total: count, page, limit }
  })

  // ── GET /invoices/:id — detalle de factura con líneas ────────────────────
  fastify.get('/invoices/:id', async (request, reply) => {
    const { id } = request.params as { id: string }

    const { data: invoice, error } = await supabase
      .from('invoices')
      .select(`
        *,
        suppliers ( id, name, rfc ),
        invoice_lines (
          id, line_number,
          raw_description, raw_quantity, raw_unit, raw_unit_price, raw_subtotal,
          sku_id, matched_quantity, matched_unit, matched_unit_price,
          match_status, match_confidence, match_method,
          override_sku_id, override_notes,
          skus ( id, code, name, unit )
        )
      `)
      .eq('id', id)
      .single()

    if (error) return reply.status(404).send({ error: 'Factura no encontrada' })

    // Generar URL firmada para ver la imagen
    const { data: signedUrl } = await supabase.storage
      .from(invoice.storage_bucket)
      .createSignedUrl(invoice.storage_path, 3600)  // 1 hora

    return { ...invoice, signed_url: signedUrl?.signedUrl }
  })

  // ── PATCH /invoices/:id/lines/:lineId — corregir línea ───────────────────
  fastify.patch('/invoices/:id/lines/:lineId', async (request, reply) => {
    const { lineId } = request.params as { id: string; lineId: string }
    const body = request.body as {
      sku_id?: string
      matched_quantity?: number
      matched_unit?: string
      matched_unit_price?: number
      override_notes?: string
    }

    const { error } = await supabase
      .from('invoice_lines')
      .update({
        override_sku_id: body.sku_id,
        sku_id: body.sku_id,
        matched_quantity: body.matched_quantity,
        matched_unit: body.matched_unit,
        matched_unit_price: body.matched_unit_price,
        override_notes: body.override_notes,
        match_status: 'confirmed',
        match_confidence: 1.0,
      })
      .eq('id', lineId)

    if (error) return reply.status(500).send({ error: error.message })
    return { ok: true }
  })

  // ── POST /invoices/:id/approve — aprobar factura ─────────────────────────
  fastify.post('/invoices/:id/approve', async (request, reply) => {
    const { id } = request.params as { id: string }
    const body = request.body as { approved_by?: string }

    // Verificar que la factura está en estado "review"
    const { data: invoice } = await supabase
      .from('invoices')
      .select('status, supplier_id')
      .eq('id', id)
      .single()

    if (!invoice || invoice.status !== 'review') {
      return reply.status(400).send({ error: 'La factura debe estar en estado "review" para aprobarse' })
    }

    // Aprender aliases de las líneas confirmadas/auto-matched
    const { data: lines } = await supabase
      .from('invoice_lines')
      .select('raw_description, raw_unit, sku_id, matched_unit, match_status')
      .eq('invoice_id', id)
      .not('sku_id', 'is', null)
      .in('match_status', ['confirmed', 'auto'])

    if (lines && invoice.supplier_id) {
      for (const line of lines) {
        await learnAlias({
          skuId: line.sku_id!,
          supplierId: invoice.supplier_id,
          alias: line.raw_description,
          unitAlias: line.raw_unit,
          unitFactor: 1,  // TODO: calcular factor real
          confirmedBy: body.approved_by ?? 'system',
        })
      }
    }

    // Encolar job de actualización de precios
    await priceUpdateQueue.add('update-prices', {
      invoiceId: id,
      approvedBy: body.approved_by ?? 'system',
    })

    return { ok: true, message: 'Factura enviada a aprobación' }
  })

  // ── POST /invoices/:id/reject — rechazar factura ─────────────────────────
  fastify.post('/invoices/:id/reject', async (request, reply) => {
    const { id } = request.params as { id: string }
    const body = request.body as { reason?: string }

    const { error } = await supabase
      .from('invoices')
      .update({ status: 'rejected', notes: body.reason })
      .eq('id', id)

    if (error) return reply.status(500).send({ error: error.message })
    return { ok: true }
  })
}
