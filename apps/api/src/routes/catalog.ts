import type { FastifyInstance } from 'fastify'
import { query, queryOne } from '../lib/db.js'

export async function catalogRoutes(fastify: FastifyInstance) {

  // ── GET /skus ──────────────────────────────────────────────────────────────
  fastify.get('/skus', async (request, reply) => {
    const q = request.query as any
    const search   = q.search   ?? ''
    const category = q.category ?? ''

    const rows = await query<any>(`
      select id, code, name, description, category, unit, active
      from skus
      where active = true
        and ($1 = '' or name ilike '%' || $1 || '%')
        and ($2 = '' or category = $2)
      order by name
      limit 50
    `, [search, category])

    return { data: rows }
  })

  // ── POST /skus ─────────────────────────────────────────────────────────────
  fastify.post('/skus', async (request, reply) => {
    const body = request.body as {
      code: string
      name: string
      description?: string
      category?: string
      unit: string
    }

    const row = await queryOne<any>(`
      insert into skus (code, name, description, category, unit)
      values ($1, $2, $3, $4, $5)
      returning id, code, name
    `, [body.code, body.name, body.description ?? null, body.category ?? null, body.unit])

    return reply.status(201).send(row)
  })

  // ── GET /suppliers ─────────────────────────────────────────────────────────
  fastify.get('/suppliers', async (_request, reply) => {
    const rows = await query<any>(`
      select id, name, rfc, email, active
      from suppliers
      where active = true
      order by name
    `)
    return { data: rows }
  })

  // ── POST /suppliers ────────────────────────────────────────────────────────
  fastify.post('/suppliers', async (request, reply) => {
    const body = request.body as {
      name: string
      rfc?: string
      email?: string
      phone?: string
    }

    const row = await queryOne<any>(`
      insert into suppliers (name, rfc, email, phone)
      values ($1, $2, $3, $4)
      returning id, name, rfc
    `, [body.name, body.rfc ?? null, body.email ?? null, body.phone ?? null])

    return reply.status(201).send(row)
  })

  // ── GET /price-history/:skuId ──────────────────────────────────────────────
  fastify.get('/price-history/:skuId', async (request, reply) => {
    const { skuId } = request.params as { skuId: string }
    const q = request.query as any
    const supplierId = q.supplier_id ?? null
    const days = parseInt(q.days ?? '90')

    const rows = await query<any>(`
      select
        ph.id, ph.invoice_date, ph.unit_price, ph.unit, ph.currency,
        s.id as supplier_id, s.name as supplier_name
      from price_history ph
      join suppliers s on s.id = ph.supplier_id
      where ph.sku_id = $1
        and ph.invoice_date >= current_date - ($2 || ' days')::interval
        and ($3::uuid is null or ph.supplier_id = $3::uuid)
      order by ph.invoice_date desc
    `, [skuId, days, supplierId])

    return {
      data: rows.map(r => ({
        ...r,
        suppliers: { id: r.supplier_id, name: r.supplier_name },
      }))
    }
  })

  // ── GET /alerts ────────────────────────────────────────────────────────────
  fastify.get('/alerts', async (_request, reply) => {
    const rows = await query<any>(`
      select
        pa.id, pa.alert_type, pa.status, pa.change_pct,
        pa.previous_price, pa.new_price, pa.message, pa.created_at,
        sk.id as sku_id, sk.code as sku_code, sk.name as sku_name,
        sup.id as supplier_id, sup.name as supplier_name
      from price_alerts pa
      join skus sk on sk.id = pa.sku_id
      join suppliers sup on sup.id = pa.supplier_id
      where pa.status = 'active'
      order by pa.created_at desc
      limit 50
    `)

    return {
      data: rows.map(r => ({
        ...r,
        skus:      { id: r.sku_id,      code: r.sku_code, name: r.sku_name },
        suppliers: { id: r.supplier_id, name: r.supplier_name },
      }))
    }
  })

  // ── GET /suppliers/:id ────────────────────────────────────────────────────
  fastify.get('/suppliers/:id', async (request, reply) => {
    const { id } = request.params as { id: string }
    const row = await queryOne<any>(`
      select id, name, rfc, email, phone, active, notes, created_at
      from suppliers where id = $1
    `, [id])
    if (!row) return reply.status(404).send({ error: 'Proveedor no encontrado' })
    return row
  })

  // ── PATCH /suppliers/:id ───────────────────────────────────────────────────
  fastify.patch('/suppliers/:id', async (request, reply) => {
    const { id } = request.params as { id: string }
    const body = (request.body as { name?: string; rfc?: string; email?: string; phone?: string; notes?: string }) ?? {}
    const row = await queryOne<any>(`
      update suppliers set
        name       = coalesce($1, name),
        rfc        = coalesce($2, rfc),
        email      = coalesce($3, email),
        phone      = coalesce($4, phone),
        notes      = coalesce($5, notes),
        updated_at = now()
      where id = $6
      returning id, name, rfc, email, phone, notes
    `, [body.name ?? null, body.rfc ?? null, body.email ?? null, body.phone ?? null, body.notes ?? null, id])
    return row
  })

  // ── GET /analytics/spend-by-supplier ──────────────────────────────────────
  // Gasto total por proveedor usando total de facturas aprobadas
  fastify.get('/analytics/spend-by-supplier', async (request, reply) => {
    const q = request.query as any
    const days = parseInt(q.days ?? '90')

    const rows = await query<any>(`
      select
        s.id,
        s.name,
        sum(i.total)                as total_spend,
        count(*)                    as invoice_count,
        max(i.invoice_date::date)   as last_invoice_date
      from invoices i
      join suppliers s on s.id = i.supplier_id
      where i.status = 'approved'
        and i.invoice_date is not null
        and i.invoice_date::date >= current_date - ($1 || ' days')::interval
        and i.total is not null
      group by s.id, s.name
      order by total_spend desc
    `, [days])

    return { data: rows.map(r => ({ ...r, total_spend: Number(r.total_spend ?? 0) })) }
  })

  // ── GET /analytics/spend-over-time ────────────────────────────────────────
  // Gasto mensual usando total de facturas aprobadas
  fastify.get('/analytics/spend-over-time', async (request, reply) => {
    const q = request.query as any
    const days       = parseInt(q.days ?? '365')
    const supplierId = q.supplier_id ?? null

    const rows = await query<any>(`
      select
        to_char(date_trunc('month', i.invoice_date::date), 'YYYY-MM') as month,
        sum(i.total) as total_spend
      from invoices i
      where i.status = 'approved'
        and i.invoice_date is not null
        and i.invoice_date::date >= current_date - ($1 || ' days')::interval
        and i.total is not null
        and ($2::uuid is null or i.supplier_id = $2::uuid)
      group by date_trunc('month', i.invoice_date::date)
      order by date_trunc('month', i.invoice_date::date)
    `, [days, supplierId])

    return { data: rows.map(r => ({ month: r.month, total_spend: Number(r.total_spend ?? 0) })) }
  })

  // ── GET /analytics/top-skus ───────────────────────────────────────────────
  // Top productos por gasto (desde price_history cuando hay SKUs, sino vacío)
  fastify.get('/analytics/top-skus', async (request, reply) => {
    const q = request.query as any
    const days       = parseInt(q.days ?? '90')
    const supplierId = q.supplier_id ?? null
    const limit      = parseInt(q.limit ?? '10')

    const rows = await query<any>(`
      select
        sk.id, sk.code, sk.name, sk.unit,
        sum(ph.unit_price * coalesce(il.matched_quantity, 1)) as total_spend,
        avg(ph.unit_price)                                     as avg_price,
        max(ph.unit_price)                                     as max_price,
        min(ph.unit_price)                                     as min_price,
        count(*)                                               as purchase_count
      from price_history ph
      join skus sk on sk.id = ph.sku_id
      left join invoice_lines il on il.id = ph.invoice_line_id
      where ph.invoice_date >= current_date - ($1 || ' days')::interval
        and ($2::uuid is null or ph.supplier_id = $2::uuid)
      group by sk.id, sk.code, sk.name, sk.unit
      order by total_spend desc
      limit $3
    `, [days, supplierId, limit])

    return {
      data: rows.map(r => ({
        ...r,
        total_spend:    Number(r.total_spend   ?? 0),
        avg_price:      Number(r.avg_price     ?? 0),
        max_price:      Number(r.max_price     ?? 0),
        min_price:      Number(r.min_price     ?? 0),
        purchase_count: Number(r.purchase_count),
      }))
    }
  })

  // ── GET /analytics/monthly-summary ───────────────────────────────────────
  // Resumen completo de un mes: facturas por proveedor + caja chica
  fastify.get('/analytics/monthly-summary', async (request, reply) => {
    const q     = request.query as any
    const month = q.month ?? new Date().toISOString().slice(0, 7) // YYYY-MM

    // Facturas aprobadas del mes por proveedor
    const invoicesBySupplier = await query<any>(`
      select
        s.id                as supplier_id,
        s.name              as supplier_name,
        count(*)            as invoice_count,
        sum(i.total)        as total_spend,
        array_agg(json_build_object(
          'id',           i.id,
          'folio',        i.folio,
          'invoice_date', i.invoice_date,
          'total',        i.total,
          'currency',     i.currency
        ) order by i.invoice_date) as invoices
      from invoices i
      join suppliers s on s.id = i.supplier_id
      where i.status = 'approved'
        and i.total is not null
        and to_char(i.invoice_date::date, 'YYYY-MM') = $1
      group by s.id, s.name
      order by total_spend desc
    `, [month])

    // Total facturas del mes (incluyendo sin proveedor)
    const invoiceTotals = await queryOne<any>(`
      select
        count(*)     as invoice_count,
        sum(total)   as total_amount
      from invoices
      where status = 'approved'
        and total is not null
        and to_char(invoice_date::date, 'YYYY-MM') = $1
    `, [month])

    // Gastos de caja chica del mes
    const cashExpenses = await query<any>(`
      select
        id, expense_date, description, amount, method, category
      from petty_cash_expenses
      where to_char(expense_date, 'YYYY-MM') = $1
      order by expense_date desc
    `, [month])

    const cashTotals = await queryOne<any>(`
      select
        count(*)                                                    as expense_count,
        sum(amount)                                                 as total_amount,
        sum(case when method = 'cash'     then amount else 0 end)  as cash_amount,
        sum(case when method = 'transfer' then amount else 0 end)  as transfer_amount
      from petty_cash_expenses
      where to_char(expense_date, 'YYYY-MM') = $1
    `, [month])

    // Gasto total combinado dia a dia (facturas + caja chica) para sparkline
    const dailySpend = await query<any>(`
      select day, sum(amount) as total from (
        select invoice_date::date as day, total as amount
        from invoices
        where status = 'approved' and total is not null
          and to_char(invoice_date::date, 'YYYY-MM') = $1
        union all
        select expense_date as day, amount
        from petty_cash_expenses
        where to_char(expense_date, 'YYYY-MM') = $1
      ) t
      group by day
      order by day
    `, [month])

    return {
      month,
      invoices: {
        by_supplier: invoicesBySupplier.map(r => ({
          ...r,
          total_spend:   Number(r.total_spend   ?? 0),
          invoice_count: Number(r.invoice_count),
        })),
        total_amount:  Number(invoiceTotals?.total_amount  ?? 0),
        invoice_count: Number(invoiceTotals?.invoice_count ?? 0),
      },
      cash: {
        expenses:        cashExpenses.map(r => ({ ...r, amount: Number(r.amount) })),
        total_amount:    Number(cashTotals?.total_amount    ?? 0),
        cash_amount:     Number(cashTotals?.cash_amount     ?? 0),
        transfer_amount: Number(cashTotals?.transfer_amount ?? 0),
        expense_count:   Number(cashTotals?.expense_count   ?? 0),
      },
      daily_spend: dailySpend.map(r => ({
        day:   r.day,
        total: Number(r.total ?? 0),
      })),
      grand_total: Number(invoiceTotals?.total_amount ?? 0) + Number(cashTotals?.total_amount ?? 0),
    }
  })

  // ── PATCH /alerts/:id/acknowledge ─────────────────────────────────────────
  fastify.patch('/alerts/:id/acknowledge', async (request, reply) => {
    const { id } = request.params as { id: string }
    const body = (request.body as { acknowledged_by?: string }) ?? {}

    await query(`
      update price_alerts set
        status          = 'acknowledged',
        acknowledged_by = $1,
        acknowledged_at = now()
      where id = $2
    `, [body.acknowledged_by ?? 'system', id])

    return { ok: true }
  })
}
