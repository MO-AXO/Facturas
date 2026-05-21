import 'dotenv/config'
import Fastify from 'fastify'
import cors from '@fastify/cors'
import multipart from '@fastify/multipart'
import { db } from './lib/db.js'
import { runMigrations } from './lib/migrate.js'
import { invoiceRoutes } from './routes/invoices.js'
import { catalogRoutes } from './routes/catalog.js'
import { startInvoiceWorker } from './workers/invoice.worker.js'
import { startPriceUpdateWorker } from './workers/price-update.worker.js'

// Correr migraciones antes de arrancar el servidor
console.log('[Migrate] Corriendo migraciones...')
await runMigrations()

const app = Fastify({ logger: true })

await app.register(cors, {
  origin: process.env.CORS_ORIGIN ?? 'http://localhost:5173',
})

await app.register(multipart, {
  limits: { fileSize: 20 * 1024 * 1024 },  // 20 MB
})

await app.register(invoiceRoutes, { prefix: '/api' })
await app.register(catalogRoutes, { prefix: '/api' })

app.get('/health', async () => ({
  ok: true,
  ts: new Date().toISOString(),
  db: await db.query('select 1').then(() => 'ok').catch(() => 'error'),
}))

// Workers
startInvoiceWorker()
startPriceUpdateWorker()

const port = parseInt(process.env.PORT ?? '3000')
await app.listen({ port, host: '0.0.0.0' })
console.log(`API corriendo en http://localhost:${port}`)
