import IORedis from 'ioredis'

const redisUrl = process.env.REDIS_URL ?? 'redis://localhost:6379'

export const redis = new IORedis(redisUrl, {
  maxRetriesPerRequest: null, // requerido por BullMQ
})

redis.on('error', (err) => {
  console.error('[Redis] Error de conexión:', err.message)
})

redis.on('connect', () => {
  console.log('[Redis] Conectado')
})
