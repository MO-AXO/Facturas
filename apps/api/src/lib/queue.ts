import { Queue } from 'bullmq'
import { redis } from './redis.js'

export const invoiceQueue = new Queue('invoice-processing', {
  connection: redis,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 5000 },
    removeOnComplete: { count: 100 },
    removeOnFail: { count: 50 },
  },
})

export const priceUpdateQueue = new Queue('price-update', {
  connection: redis,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 2000 },
  },
})

export type InvoiceJobData = {
  invoiceId: string
  base64: string        // imagen en memoria, no en disco
  mediaType: string
  fileName: string
}

export type PriceUpdateJobData = {
  invoiceId: string
  approvedBy: string
}
