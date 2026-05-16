/**
 * Worker: procesamiento de facturas
 * Se activa cuando se sube una nueva factura
 * 1. Descarga el archivo de Supabase Storage
 * 2. Llama a Claude para extraer datos
 * 3. Hace matching de líneas contra el catálogo
 * 4. Guarda resultados y pone la factura en status "review"
 */
import { Worker } from 'bullmq'
import { redis } from '../lib/redis.js'
import { supabase } from '../lib/supabase.js'
import { extractInvoiceData } from '../services/extraction.js'
import { matchLine } from '../services/matching.js'
import type { InvoiceJobData } from '../lib/queue.js'

export function startInvoiceWorker() {
  const worker = new Worker<InvoiceJobData>(
    'invoice-processing',
    async (job) => {
      const { invoiceId, storagePath, fileType } = job.data

      console.log(`[InvoiceWorker] Procesando factura ${invoiceId}`)

      // ── 1. Marcar como extrayendo ──────────────────────────────────────────
      await supabase
        .from('invoices')
        .update({ status: 'extracting' })
        .eq('id', invoiceId)

      // ── 2. Descargar archivo de Storage ───────────────────────────────────
      const { data: fileData, error: downloadError } = await supabase.storage
        .from('facturas')
        .download(storagePath)

      if (downloadError || !fileData) {
        throw new Error(`Error descargando archivo: ${downloadError?.message}`)
      }

      const arrayBuffer = await fileData.arrayBuffer()
      const base64 = Buffer.from(arrayBuffer).toString('base64')
      const mediaType = fileType as any

      // ── 3. Extraer datos con Claude ────────────────────────────────────────
      await job.updateProgress(25)
      const extracted = await extractInvoiceData(base64, mediaType)

      // ── 4. Buscar/crear proveedor ─────────────────────────────────────────
      let supplierId: string | null = null

      if (extracted.supplier_name) {
        // Buscar por alias exacto
        const { data: alias } = await supabase
          .from('supplier_aliases')
          .select('supplier_id')
          .ilike('alias', extracted.supplier_name.trim())
          .single()

        if (alias) {
          supplierId = alias.supplier_id
        } else if (extracted.supplier_rfc) {
          // Buscar por RFC
          const { data: supplier } = await supabase
            .from('suppliers')
            .select('id')
            .eq('rfc', extracted.supplier_rfc)
            .single()

          supplierId = supplier?.id ?? null
        }
      }

      // ── 5. Actualizar header de factura ───────────────────────────────────
      await supabase
        .from('invoices')
        .update({
          supplier_id: supplierId,
          folio: extracted.folio,
          invoice_date: extracted.invoice_date,
          subtotal: extracted.subtotal,
          tax_amount: extracted.tax_amount,
          total: extracted.total,
          currency: extracted.currency ?? 'MXN',
          raw_extraction: extracted as any,
          extracted_at: new Date().toISOString(),
        })
        .eq('id', invoiceId)

      // ── 6. Procesar y hacer match de cada línea ───────────────────────────
      await job.updateProgress(50)

      const lineInserts = await Promise.all(
        extracted.lines.map(async (line, idx) => {
          const match = await matchLine(line, supplierId)
          return {
            invoice_id: invoiceId,
            line_number: idx + 1,
            raw_description: line.description,
            raw_quantity: line.quantity,
            raw_unit: line.unit,
            raw_unit_price: line.unit_price,
            raw_subtotal: line.subtotal,
            sku_id: match.sku_id,
            matched_quantity: match.matched_quantity,
            matched_unit: match.matched_unit,
            matched_unit_price: match.matched_unit_price,
            match_status: match.match_status,
            match_confidence: match.match_confidence,
            match_method: match.match_method,
          }
        })
      )

      await supabase.from('invoice_lines').insert(lineInserts)

      // ── 7. Poner en revisión ───────────────────────────────────────────────
      await job.updateProgress(90)
      await supabase
        .from('invoices')
        .update({ status: 'review' })
        .eq('id', invoiceId)

      await job.updateProgress(100)
      console.log(`[InvoiceWorker] Factura ${invoiceId} lista para revisión`)
    },
    {
      connection: redis,
      concurrency: 3,
    }
  )

  worker.on('failed', async (job, err) => {
    if (job) {
      console.error(`[InvoiceWorker] Job ${job.id} fallido:`, err.message)
      await supabase
        .from('invoices')
        .update({ status: 'error', error_message: err.message })
        .eq('id', job.data.invoiceId)
    }
  })

  console.log('[InvoiceWorker] Iniciado')
  return worker
}
