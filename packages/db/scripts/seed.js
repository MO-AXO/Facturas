#!/usr/bin/env node
/**
 * Inserta datos base en PostgreSQL (Railway)
 * Uso: node scripts/seed.js
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

async function seed() {
  const client = await pool.connect();
  try {
    const seedsDir = path.join(__dirname, '../seeds');
    const files = fs.readdirSync(seedsDir)
      .filter(f => f.endsWith('.sql'))
      .sort();

    console.log(`Encontrados ${files.length} seeds`);

    for (const file of files) {
      const sql = fs.readFileSync(path.join(seedsDir, file), 'utf8');
      console.log(`  →  ${file}...`);
      await client.query(sql);
      console.log(`  ✓  ${file}`);
    }

    console.log('Seeds completados');
  } finally {
    client.release();
    await pool.end();
  }
}

seed().catch((err) => {
  console.error('Error en seed:', err.message);
  process.exit(1);
});
