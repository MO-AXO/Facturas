/**
 * Corre las migraciones SQL al arrancar o manualmente:
 *   npm run db:migrate
 */
import 'dotenv/config'
import { readFileSync, readdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { db } from './db.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const migrationsDir = join(__dirname, '../../../../packages/db/migrations')

async function migrate() {
  // Tabla de control de migraciones
  await db.query(`
    create table if not exists _migrations (
      id        serial primary key,
      filename  text not null unique,
      run_at    timestamptz not null default now()
    )
  `)

  const files = readdirSync(migrationsDir)
    .filter(f => f.endsWith('.sql'))
    .sort()

  for (const file of files) {
    const { rows } = await db.query(
      'select id from _migrations where filename = $1',
      [file]
    )
    if (rows.length > 0) {
      console.log(`  skip: ${file}`)
      continue
    }

    const sql = readFileSync(join(migrationsDir, file), 'utf8')
    console.log(`  run:  ${file}`)
    await db.query(sql)
    await db.query('insert into _migrations (filename) values ($1)', [file])
  }

  console.log('Migraciones listas.')
  await db.end()
}

migrate().catch((err) => {
  console.error('Error en migración:', err.message)
  process.exit(1)
})
