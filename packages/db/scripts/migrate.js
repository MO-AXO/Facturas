#!/usr/bin/env node
/**
 * Ejecuta migraciones SQL en orden contra Supabase
 * Uso: node scripts/migrate.js
 */
require('dotenv').config({ path: '../../.env' });

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function migrate() {
  const migrationsDir = path.join(__dirname, '../migrations');
  const files = fs.readdirSync(migrationsDir)
    .filter(f => f.endsWith('.sql'))
    .sort();

  console.log(`Encontradas ${files.length} migraciones`);

  for (const file of files) {
    const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
    console.log(`Ejecutando: ${file}...`);
    const { error } = await supabase.rpc('exec_sql', { sql });
    if (error) {
      console.error(`Error en ${file}:`, error.message);
      // Para el schema inicial puedes ejecutar directamente en el SQL editor de Supabase
      // Las migraciones via RPC requieren crear la función exec_sql primero
      console.log('NOTA: Para el schema inicial, ejecuta el SQL directamente en Supabase Dashboard > SQL Editor');
      process.exit(1);
    }
    console.log(`  ✓ ${file}`);
  }

  console.log('Migraciones completadas');
}

migrate().catch(console.error);
