import 'dotenv/config'
import Fastify from 'fastify'
import cors from '@fastify/cors'
import multipart from '@fastify/multipart'
import { invoiceRoutes } from './routes/invoices.js'
import { catalogRoutes } from './routes/catalog.js'
import { startInvoiceWorker } from './workers/invoice.worker.js'
import { startPriceUpdateWorker } from './workers/price-update.worker.js'

const app = Fastify({ logger: true })

// Plugins
await app.register(cors, {
  origin: process.env.CORS_ORIGIN ?? 'http://localhost:5173',
})

await app.register(multipart, {
  limits: {
    fileSize: 20 * 1024 * 1024,  // 20 MB máx
  },
})

// Routes
await app.register(invoiceRoutes, { prefix: '/api' })
await app.register(catalogRoutes, { prefix: '/api' })

// Health check
app.get('/health', async () => ({ ok: true, ts: new Date().toISOString() }))

// Iniciar workers
startInvoiceWorker()
startPriceUpdateWorker()

// Start
const port = parseInt(process.env.PORT ?? '3000')
await app.listen({ port, host: '0.0.0.0' })
console.log(`API corriendo en http://localhost:${port}`)
