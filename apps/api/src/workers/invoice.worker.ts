import { Worker } from 'bullmq'
import { redis } from '../lib/redis.js'
import { query, queryOne } from '../lib/db.js'
import { extractInvoiceData } from '../services/extraction.js'
import { matchLine } from '../services/matching.js'
import type { InvoiceJobData } from '../lib/queue.js'

export function startInvoiceWorker() {
  const worker = new Worker<InvoiceJobData>(
    'invoice-processing',
    async (job) => {
      const { invoiceId, base64, mediaType, fileName } = job.data

      console.log(`[InvoiceWorker] Procesando factura ${invoiceId} (${fileName})`)

      // ── 1. Extraer con Claude ──────────────────────────────────────────────
      await job.updateProgress(10)
      const extracted = await extractInvoiceData(base64, mediaType as any)

      // ── 2. Resolver proveedor (o crearlo si no existe) ────────────────────
      await job.updateProgress(40)
      let supplierId: string | null = null

      if (extracted.supplier_name) {
        const name = extracted.supplier_name.trim()
        const rfc  = extracted.supplier_rfc?.trim() ?? null

        // 1) Buscar por alias exacto
        const byAlias = await queryOne<{ supplier_id: string }>(`
          select supplier_id from supplier_aliases
          where lower(alias) = lower($1)
          limit 1
        `, [name])

        if (byAlias) {
          supplierId = byAlias.supplier_id
        } else if (rfc) {
          // 2) Buscar por RFC
          const byRfc = await queryOne<{ id: string }>(`
            select id from suppliers where rfc = $1 limit 1
          `, [rfc])
          supplierId = byRfc?.id ?? null
        }

        if (!supplierId) {
          // 3) Buscar por nombre exacto (case-insensitive)
          const byName = await queryOne<{ id: string }>(`
            select id from suppliers where lower(name) = lower($1) limit 1
          `, [name])
          supplierId = byName?.id ?? null
        }

        if (!supplierId) {
          // 4) No existe — crear el proveedor
          const newSupplier = await queryOne<{ id: string }>(`
            insert into suppliers (name, rfc)
            values ($1, $2)
            returning id
          `, [name, rfc])
          supplierId = newSupplier?.id ?? null
          console.log(`[InvoiceWorker] Proveedor creado: "${name}" (${rfc ?? 'sin RFC'})`)
        }

        // Registrar el nombre exacto como alias para futuros matches
        if (supplierId) {
          await query(`
            insert into supplier_aliases (supplier_id, alias, source)
            values ($1, $2, 'auto')
            on conflict (alias) do nothing
          `, [supplierId, name])
        }
      }

      // ── 3. Actualizar header de factura ────────────────────────────────────
      await query(`
        update invoices set
          supplier_id    = $1,
          folio          = $2,
          invoice_date   = $3,
          subtotal       = $4,
          tax_amount     = $5,
          total          = $6,
          currency       = $7,
          raw_extraction = $8,
          extracted_at   = now(),
          updated_at     = now()
        where id = $9
      `, [
        supplierId,
        extracted.folio,
        extracted.invoice_date,
        extracted.subtotal,
        extracted.tax_amount,
        extracted.total,
        extracted.currency ?? 'MXN',
        JSON.stringify(extracted),
        invoiceId,
      ])

      // ── 4. Match de líneas ─────────────────────────────────────────────────
      await job.updateProgress(60)

      for (let i = 0; i < extracted.lines.length; i++) {
        const line = extracted.lines[i]
        const match = await matchLine(line, supplierId)

        // Guardar sugerencia de SKU nuevo en override_notes como JSON
        const suggestionNote = (match.match_status === 'manual' && line.suggested_sku_name)
          ? JSON.stringify({
              suggested_sku_name: line.suggested_sku_name,
              suggested_sku_code: line.suggested_sku_code ?? null,
              suggested_sku_unit: line.unit ?? null,
            })
          : null

        await query(`
          insert into invoice_lines (
            invoice_id, line_number,
            raw_description, raw_quantity, raw_unit, raw_unit_price, raw_subtotal,
            sku_id, matched_quantity, matched_unit, matched_unit_price,
            match_status, match_confidence, match_method, override_notes
          ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
        `, [
          invoiceId, i + 1,
          line.description, line.quantity, line.unit, line.unit_price, line.subtotal,
          match.sku_id, match.matched_quantity, match.matched_unit, match.matched_unit_price,
          match.match_status, match.match_confidence, match.match_method,
          suggestionNote,
        ])
      }

      // ── 5. Poner en revisión ───────────────────────────────────────────────
      await job.updateProgress(100)
      await query(`
        update invoices set status = 'review', updated_at = now() where id = $1
      `, [invoiceId])

      console.log(`[InvoiceWorker] Factura ${invoiceId} lista para revisión (${extracted.lines.length} líneas)`)
    },
    { connection: redis, concurrency: 3 }
  )

  worker.on('failed', async (job, err) => {
    console.error(`[InvoiceWorker] Job ${job?.id} fallido:`, err.message)
    if (job) {
      await query(`
        update invoices set status = 'error', error_message = $1, updated_at = now()
        where id = $2
      `, [err.message, job.data.invoiceId])
    }
  })

  console.log('[InvoiceWorker] Iniciado')
  return worker
}
