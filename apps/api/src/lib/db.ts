import pg from 'pg'

const { Pool } = pg

const connectionString = process.env.DATABASE_URL

if (!connectionString) {
  throw new Error('Falta variable de entorno: DATABASE_URL')
}

export const db = new Pool({
  connectionString,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  max: 10,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
})

db.on('error', (err) => {
  console.error('[DB] Error inesperado en pool:', err.message)
})

/** Helper: query con tipado */
export async function query<T = any>(
  sql: string,
  params?: any[]
): Promise<T[]> {
  const result = await db.query(sql, params)
  return result.rows as T[]
}

/** Helper: primera fila o null */
export async function queryOne<T = any>(
  sql: string,
  params?: any[]
): Promise<T | null> {
  const rows = await query<T>(sql, params)
  return rows[0] ?? null
}
