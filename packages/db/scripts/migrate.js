#!/usr/bin/env node
/**
 * Ejecuta migraciones SQL en orden contra PostgreSQL (Railway)
 * Uso: node scripts/migrate.js
 */
require('dotenv').config({ path: '../../.env' });

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

if (!process.env.DATABASE_URL) {
  console.error('ERROR: DATABASE_URL no está definida en .env');
  process.exit(1);
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function migrate() {
  const client = await pool.connect();
  try {
    // Crear tabla de control de migraciones si no existe
    await client.query(`
      create table if not exists _migrations (
        filename   text primary key,
        applied_at timestamptz not null default now()
      )
    `);

    const migrationsDir = path.join(__dirname, '../migrations');
    const files = fs.readdirSync(migrationsDir)
      .filter(f => f.endsWith('.sql'))
      .sort();

    console.log(`Encontradas ${files.length} migraciones`);

    for (const file of files) {
      const { rowCount } = await client.query(
        'select 1 from _migrations where filename = $1', [file]
      );
      if (rowCount > 0) {
        console.log(`  ↩  ${file} (ya aplicada)`);
        continue;
      }

      const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
      console.log(`  →  ${file}...`);
      await client.query(sql);
      await client.query('insert into _migrations (filename) values ($1)', [file]);
      console.log(`  ✓  ${file}`);
    }

    console.log('Migraciones completadas');
  } finally {
    client.release();
    await pool.end();
  }
}

migrate().catch((err) => {
  console.error('Error en migraciones:', err.message);
  process.exit(1);
});
