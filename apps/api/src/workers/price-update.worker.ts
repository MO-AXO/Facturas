/**
 * Worker: actualización de precios post-aprobación
 * Se activa cuando el operador aprueba una factura en la UI de revisión
 * 1. Inserta registros en price_history por cada línea confirmada
 * 2. Evalúa reglas de alerta de precio
 */
import { Worker } from 'bullmq'
import { redis } from '../lib/redis.js'
import { supabase } from '../lib/supabase.js'
import type { PriceUpdateJobData } from '../lib/queue.js'

const ALERT_THRESHOLD_PCT = 15  // alerta si sube más del 15%

export function startPriceUpdateWorker() {
  const worker = new Worker<PriceUpdateJobData>(
    'price-update',
    async (job) => {
      const { invoiceId, approvedBy } = job.data

      console.log(`[PriceUpdateWorker] Procesando aprobación de factura ${invoiceId}`)

      // Obtener header de la factura
      const { data: invoice, error: invoiceError } = await supabase
        .from('invoices')
        .select('id, supplier_id, invoice_date, currency')
        .eq('id', invoiceId)
        .single()

      if (invoiceError || !invoice) {
        throw new Error(`Factura no encontrada: ${invoiceId}`)
      }

      // Obtener líneas confirmadas con SKU
      const { data: lines, error: linesError } = await supabase
        .from('invoice_lines')
        .select('id, sku_id, matched_unit_price, matched_unit, matched_quantity')
        .eq('invoice_id', invoiceId)
        .not('sku_id', 'is', null)
        .not('matched_unit_price', 'is', null)

      if (linesError) throw new Error(linesError.message)
      if (!lines || lines.length === 0) {
        console.log(`[PriceUpdateWorker] Sin líneas con SKU para actualizar`)
        return
      }

      // ── Insertar en price_history ─────────────────────────────────────────
      const priceHistoryRows = lines.map((line) => ({
        sku_id: line.sku_id,
        supplier_id: invoice.supplier_id,
        invoice_id: invoiceId,
        invoice_line_id: line.id,
        invoice_date: invoice.invoice_date,
        unit_price: line.matched_unit_price,
        unit: line.matched_unit,
        currency: invoice.currency ?? 'MXN',
      }))

      const { error: insertError } = await supabase
        .from('price_history')
        .insert(priceHistoryRows)

      if (insertError) throw new Error(`Error insertando price_history: ${insertError.message}`)

      // ── Evaluar alertas de precio ─────────────────────────────────────────
      for (const line of lines) {
        await evaluatePriceAlert({
          skuId: line.sku_id!,
          supplierId: invoice.supplier_id!,
          invoiceId,
          newPrice: line.matched_unit_price!,
        })
      }

      // Marcar factura como aprobada
      await supabase
        .from('invoices')
        .update({
          status: 'approved',
          approved_at: new Date().toISOString(),
          approved_by: approvedBy,
        })
        .eq('id', invoiceId)

      console.log(`[PriceUpdateWorker] Factura ${invoiceId} aprobada, ${lines.length} precios actualizados`)
    },
    {
      connection: redis,
      concurrency: 5,
    }
  )

  worker.on('failed', (job, err) => {
    console.error(`[PriceUpdateWorker] Job ${job?.id} fallido:`, err.message)
  })

  console.log('[PriceUpdateWorker] Iniciado')
  return worker
}

async function evaluatePriceAlert(params: {
  skuId: string
  supplierId: string
  invoiceId: string
  newPrice: number
}) {
  const { skuId, supplierId, invoiceId, newPrice } = params

  // Obtener el precio anterior para este SKU × proveedor
  const { data: previous } = await supabase
    .from('price_history')
    .select('unit_price')
    .eq('sku_id', skuId)
    .eq('supplier_id', supplierId)
    .neq('invoice_id', invoiceId)
    .order('invoice_date', { ascending: false })
    .limit(1)
    .single()

  if (!previous) return  // primer precio, sin historial para comparar

  const prevPrice = previous.unit_price
  const changePct = ((newPrice - prevPrice) / prevPrice) * 100

  if (Math.abs(changePct) >= ALERT_THRESHOLD_PCT) {
    await supabase.from('price_alerts').insert({
      sku_id: skuId,
      supplier_id: supplierId,
      invoice_id: invoiceId,
      alert_type: changePct > 0 ? 'price_increase' : 'price_increase',
      previous_price: prevPrice,
      new_price: newPrice,
      change_pct: changePct,
      threshold_pct: ALERT_THRESHOLD_PCT,
      message: `Precio ${changePct > 0 ? 'aumentó' : 'bajó'} ${Math.abs(changePct).toFixed(1)}% (de $${prevPrice} a $${newPrice})`,
    })
  }
}
