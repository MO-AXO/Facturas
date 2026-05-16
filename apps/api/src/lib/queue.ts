import { Queue } from 'bullmq'
import { redis } from './redis.js'

// Job: procesar factura subida (OCR con Claude)
export const invoiceQueue = new Queue('invoice-processing', {
  connection: redis,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 5000 },
    removeOnComplete: { count: 100 },
    removeOnFail: { count: 50 },
  },
})

// Job: actualizar price_history + evaluar alertas post-aprobación
export const priceUpdateQueue = new Queue('price-update', {
  connection: redis,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 2000 },
  },
})

export type InvoiceJobData = {
  invoiceId: string
  storagePath: string
  fileType: string
}

export type PriceUpdateJobData = {
  invoiceId: string
  approvedBy: string
}
