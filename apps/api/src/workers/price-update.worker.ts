import { Worker } from 'bullmq'
import { redis } from '../lib/redis.js'
import { query, queryOne } from '../lib/db.js'
import type { PriceUpdateJobData } from '../lib/queue.js'

const ALERT_THRESHOLD_PCT = 15

export function startPriceUpdateWorker() {
  const worker = new Worker<PriceUpdateJobData>(
    'price-update',
    async (job) => {
      const { invoiceId, approvedBy } = job.data

      const invoice = await queryOne<any>(`
        select id, supplier_id, invoice_date, currency
        from invoices where id = $1
      `, [invoiceId])

      if (!invoice) throw new Error(`Factura no encontrada: ${invoiceId}`)

      const lines = await query<any>(`
        select id, sku_id, matched_unit_price, matched_unit
        from invoice_lines
        where invoice_id = $1
          and sku_id is not null
          and matched_unit_price is not null
      `, [invoiceId])

      if (lines.length === 0) {
        console.log(`[PriceUpdateWorker] Sin líneas con SKU para ${invoiceId}`)
      }

      // Insertar price_history y evaluar alertas
      for (const line of lines) {
        await query(`
          insert into price_history
            (sku_id, supplier_id, invoice_id, invoice_line_id, invoice_date, unit_price, unit, currency)
          values ($1, $2, $3, $4, $5, $6, $7, $8)
        `, [
          line.sku_id, invoice.supplier_id, invoiceId, line.id,
          invoice.invoice_date, line.matched_unit_price,
          line.matched_unit, invoice.currency ?? 'MXN',
        ])

        await evaluatePriceAlert({
          skuId: line.sku_id,
          supplierId: invoice.supplier_id,
          invoiceId,
          newPrice: Number(line.matched_unit_price),
          unit: line.matched_unit,
        })
      }

      // Marcar aprobada
      await query(`
        update invoices set
          status      = 'approved',
          approved_at = now(),
          approved_by = $1,
          updated_at  = now()
        where id = $2
      `, [approvedBy, invoiceId])

      console.log(`[PriceUpdateWorker] Factura ${invoiceId} aprobada — ${lines.length} precios actualizados`)
    },
    { connection: redis, concurrency: 5 }
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
  unit: string
}) {
  const { skuId, supplierId, invoiceId, newPrice, unit } = params

  const previous = await queryOne<{ unit_price: string }>(`
    select unit_price from price_history
    where sku_id = $1 and supplier_id = $2 and invoice_id != $3
    order by invoice_date desc
    limit 1
  `, [skuId, supplierId, invoiceId])

  if (!previous) return

  const prevPrice = Number(previous.unit_price)
  const changePct = ((newPrice - prevPrice) / prevPrice) * 100

  if (Math.abs(changePct) >= ALERT_THRESHOLD_PCT) {
    const alertType = changePct > 0 ? 'price_increase' : 'price_decrease'
    await query(`
      insert into price_alerts
        (sku_id, supplier_id, invoice_id, alert_type, previous_price, new_price, change_pct, threshold_pct, message)
      values ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    `, [
      skuId, supplierId, invoiceId, alertType,
      prevPrice, newPrice, changePct, ALERT_THRESHOLD_PCT,
      `Precio ${changePct > 0 ? 'aumentó' : 'bajó'} ${Math.abs(changePct).toFixed(1)}% (de $${prevPrice.toFixed(2)} a $${newPrice.toFixed(2)}) — ${unit}`,
    ])
  }
}
