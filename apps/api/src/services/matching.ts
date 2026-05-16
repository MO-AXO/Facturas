import { supabase } from '../lib/supabase.js'
import type { ExtractedLine } from './extraction.js'

export type MatchResult = {
  sku_id: string | null
  sku_code: string | null
  sku_name: string | null
  match_status: 'auto' | 'suggested' | 'manual'
  match_confidence: number
  match_method: 'alias_exact' | 'alias_fuzzy' | 'manual'
  matched_unit: string | null
  matched_unit_price: number | null
  matched_quantity: number | null
  unit_factor: number
}

const CONFIDENCE_AUTO = 0.92       // match automático
const CONFIDENCE_SUGGEST = 0.75    // sugerencia para confirmar

/**
 * Intenta hacer match de una línea de factura contra el catálogo.
 * Estrategia MVP: alias exacto → alias fuzzy (trigram) → manual
 */
export async function matchLine(
  line: ExtractedLine,
  supplierId: string | null
): Promise<MatchResult> {
  const defaultResult: MatchResult = {
    sku_id: null,
    sku_code: null,
    sku_name: null,
    match_status: 'manual',
    match_confidence: 0,
    match_method: 'manual',
    matched_unit: null,
    matched_unit_price: null,
    matched_quantity: null,
    unit_factor: 1,
  }

  if (!line.description) return defaultResult

  // ── 1. Alias exacto (mismo proveedor) ─────────────────────────────────────
  if (supplierId) {
    const { data: exactMatch } = await supabase
      .from('sku_aliases')
      .select(`
        id, alias, unit_alias, unit_factor,
        sku_id,
        skus!inner ( id, code, name, unit )
      `)
      .eq('supplier_id', supplierId)
      .ilike('alias', line.description.trim())
      .limit(1)
      .single()

    if (exactMatch) {
      const sku = exactMatch.skus as any
      const factor = exactMatch.unit_factor ?? 1
      return {
        sku_id: sku.id,
        sku_code: sku.code,
        sku_name: sku.name,
        match_status: 'auto',
        match_confidence: 1.0,
        match_method: 'alias_exact',
        matched_unit: sku.unit,
        matched_unit_price: line.unit_price ? line.unit_price / factor : null,
        matched_quantity: line.quantity ? line.quantity * factor : null,
        unit_factor: factor,
      }
    }
  }

  // ── 2. Alias fuzzy con trigram (todos los proveedores o sin filtro) ────────
  const { data: fuzzyMatches } = await supabase.rpc('match_sku_alias_fuzzy', {
    p_description: line.description,
    p_supplier_id: supplierId,
    p_limit: 1,
    p_threshold: CONFIDENCE_SUGGEST,
  })

  if (fuzzyMatches && fuzzyMatches.length > 0) {
    const top = fuzzyMatches[0]
    const confidence: number = top.similarity ?? 0
    const status = confidence >= CONFIDENCE_AUTO ? 'auto' : 'suggested'
    const factor = top.unit_factor ?? 1

    return {
      sku_id: top.sku_id,
      sku_code: top.sku_code,
      sku_name: top.sku_name,
      match_status: status,
      match_confidence: confidence,
      match_method: 'alias_fuzzy',
      matched_unit: top.sku_unit,
      matched_unit_price: line.unit_price ? line.unit_price / factor : null,
      matched_quantity: line.quantity ? line.quantity * factor : null,
      unit_factor: factor,
    }
  }

  // ── 3. Sin match — requiere intervención manual ────────────────────────────
  return defaultResult
}

/**
 * Al confirmar una línea, registra el alias en sku_aliases para futuras facturas.
 * Si ya existe el alias, incrementa times_seen.
 */
export async function learnAlias(params: {
  skuId: string
  supplierId: string
  alias: string
  unitAlias: string | null
  unitFactor: number
  confirmedBy: string
}): Promise<void> {
  const { skuId, supplierId, alias, unitAlias, unitFactor, confirmedBy } = params

  const { data: existing } = await supabase
    .from('sku_aliases')
    .select('id, times_seen')
    .eq('supplier_id', supplierId)
    .ilike('alias', alias.trim())
    .single()

  if (existing) {
    await supabase
      .from('sku_aliases')
      .update({
        sku_id: skuId,
        unit_alias: unitAlias,
        unit_factor: unitFactor,
        confirmed_by: confirmedBy,
        confirmed_at: new Date().toISOString(),
        times_seen: (existing.times_seen ?? 1) + 1,
      })
      .eq('id', existing.id)
  } else {
    await supabase.from('sku_aliases').insert({
      sku_id: skuId,
      supplier_id: supplierId,
      alias: alias.trim(),
      unit_alias: unitAlias,
      unit_factor: unitFactor,
      confirmed_by: confirmedBy,
      confirmed_at: new Date().toISOString(),
      times_seen: 1,
    })
  }
}
