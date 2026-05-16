import { query, queryOne } from '../lib/db.js'
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

const CONFIDENCE_AUTO    = 0.92
const CONFIDENCE_SUGGEST = 0.75

export async function matchLine(
  line: ExtractedLine,
  supplierId: string | null
): Promise<MatchResult> {
  const defaultResult: MatchResult = {
    sku_id: null, sku_code: null, sku_name: null,
    match_status: 'manual', match_confidence: 0,
    match_method: 'manual', matched_unit: null,
    matched_unit_price: null, matched_quantity: null,
    unit_factor: 1,
  }

  if (!line.description) return defaultResult

  // ── 1. Alias exacto (mismo proveedor) ─────────────────────────────────────
  if (supplierId) {
    const exact = await queryOne<any>(`
      select sa.id, sa.unit_factor, s.id as sku_id, s.code as sku_code,
             s.name as sku_name, s.unit as sku_unit
      from sku_aliases sa
      join skus s on s.id = sa.sku_id
      where sa.supplier_id = $1
        and lower(sa.alias) = lower($2)
      limit 1
    `, [supplierId, line.description.trim()])

    if (exact) {
      const factor = Number(exact.unit_factor ?? 1)
      return {
        sku_id: exact.sku_id,
        sku_code: exact.sku_code,
        sku_name: exact.sku_name,
        match_status: 'auto',
        match_confidence: 1.0,
        match_method: 'alias_exact',
        matched_unit: exact.sku_unit,
        matched_unit_price: line.unit_price ? line.unit_price / factor : null,
        matched_quantity: line.quantity ? line.quantity * factor : null,
        unit_factor: factor,
      }
    }
  }

  // ── 2. Fuzzy con trigram ───────────────────────────────────────────────────
  const fuzzy = await queryOne<any>(`
    select * from match_sku_alias_fuzzy($1, $2, 1, $3)
  `, [line.description, supplierId, CONFIDENCE_SUGGEST])

  if (fuzzy) {
    const confidence = Number(fuzzy.similarity ?? 0)
    const status = confidence >= CONFIDENCE_AUTO ? 'auto' : 'suggested'
    const factor = Number(fuzzy.unit_factor ?? 1)
    return {
      sku_id: fuzzy.sku_id,
      sku_code: fuzzy.sku_code,
      sku_name: fuzzy.sku_name,
      match_status: status,
      match_confidence: confidence,
      match_method: 'alias_fuzzy',
      matched_unit: fuzzy.sku_unit,
      matched_unit_price: line.unit_price ? line.unit_price / factor : null,
      matched_quantity: line.quantity ? line.quantity * factor : null,
      unit_factor: factor,
    }
  }

  return defaultResult
}

export async function learnAlias(params: {
  skuId: string
  supplierId: string
  alias: string
  unitAlias: string | null
  unitFactor: number
  confirmedBy: string
}): Promise<void> {
  const { skuId, supplierId, alias, unitAlias, unitFactor, confirmedBy } = params

  const existing = await queryOne<any>(`
    select id, times_seen from sku_aliases
    where supplier_id = $1 and lower(alias) = lower($2)
  `, [supplierId, alias.trim()])

  if (existing) {
    await query(`
      update sku_aliases set
        sku_id       = $1,
        unit_alias   = $2,
        unit_factor  = $3,
        confirmed_by = $4,
        confirmed_at = now(),
        times_seen   = $5,
        updated_at   = now()
      where id = $6
    `, [skuId, unitAlias, unitFactor, confirmedBy, (existing.times_seen ?? 1) + 1, existing.id])
  } else {
    await query(`
      insert into sku_aliases
        (sku_id, supplier_id, alias, unit_alias, unit_factor, confirmed_by, confirmed_at, times_seen)
      values ($1, $2, $3, $4, $5, $6, now(), 1)
    `, [skuId, supplierId, alias.trim(), unitAlias, unitFactor, confirmedBy])
  }
}
