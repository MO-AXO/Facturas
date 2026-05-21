import type { FastifyInstance } from 'fastify'
import { query, queryOne } from '../lib/db.js'

const CATEGORIES = [
  'Insumos cocina',
  'Limpieza',
  'Mantenimiento',
  'Personal',
  'Marketing',
  'Servicios',
  'Varios',
]

export async function cashRoutes(fastify: FastifyInstance) {

  // ── GET /cash/categories ──────────────────────────────────────────────────
  fastify.get('/cash/categories', async () => ({ data: CATEGORIES }))

  // ── GET /cash/expenses ────────────────────────────────────────────────────
  fastify.get('/cash/expenses', async (request) => {
    const q      = request.query as any
    const month  = q.month  ?? null   // YYYY-MM
    const method = q.method ?? null   // cash | transfer
    const page   = parseInt(q.page  ?? '1')
    const limit  = parseInt(q.limit ?? '50')
    const offset = (page - 1) * limit

    const rows = await query<any>(`
      select id, expense_date, description, amount, method, category, notes, created_by, created_at
      from petty_cash_expenses
      where ($1::text is null or to_char(expense_date, 'YYYY-MM') = $1)
        and ($2::text is null or method::text = $2)
      order by expense_date desc, created_at desc
      limit $3 offset $4
    `, [month, method, limit, offset])

    const totals = await queryOne<any>(`
      select
        count(*)                                               as total_count,
        sum(amount)                                            as total_amount,
        sum(case when method = 'cash'     then amount else 0 end) as cash_amount,
        sum(case when method = 'transfer' then amount else 0 end) as transfer_amount
      from petty_cash_expenses
      where ($1::text is null or to_char(expense_date, 'YYYY-MM') = $1)
        and ($2::text is null or method::text = $2)
    `, [month, method])

    // Totales por categoría para el periodo
    const byCategory = await query<any>(`
      select category, sum(amount) as total
      from petty_cash_expenses
      where ($1::text is null or to_char(expense_date, 'YYYY-MM') = $1)
      group by category
      order by total desc
    `, [month])

    return {
      data: rows.map(r => ({ ...r, amount: Number(r.amount) })),
      summary: {
        total_count:     Number(totals?.total_count    ?? 0),
        total_amount:    Number(totals?.total_amount   ?? 0),
        cash_amount:     Number(totals?.cash_amount    ?? 0),
        transfer_amount: Number(totals?.transfer_amount ?? 0),
      },
      by_category: byCategory.map(r => ({ category: r.category, total: Number(r.total) })),
      page,
      limit,
    }
  })

  // ── POST /cash/expenses ───────────────────────────────────────────────────
  fastify.post('/cash/expenses', async (request, reply) => {
    const body = request.body as {
      expense_date?: string
      description: string
      amount: number
      method: 'cash' | 'transfer'
      category?: string
      notes?: string
      created_by?: string
    }

    if (!body.description || !body.amount || !body.method) {
      return reply.status(400).send({ error: 'description, amount y method son requeridos' })
    }

    const row = await queryOne<any>(`
      insert into petty_cash_expenses
        (expense_date, description, amount, method, category, notes, created_by)
      values
        (coalesce($1::date, current_date), $2, $3, $4, coalesce($5, 'Varios'), $6, $7)
      returning id, expense_date, description, amount, method, category, notes, created_at
    `, [
      body.expense_date ?? null,
      body.description,
      body.amount,
      body.method,
      body.category ?? null,
      body.notes ?? null,
      body.created_by ?? null,
    ])

    return reply.status(201).send({ ...row, amount: Number(row.amount) })
  })

  // ── PATCH /cash/expenses/:id ──────────────────────────────────────────────
  fastify.patch('/cash/expenses/:id', async (request, reply) => {
    const { id } = request.params as { id: string }
    const body = (request.body as any) ?? {}

    const row = await queryOne<any>(`
      update petty_cash_expenses set
        expense_date = coalesce($1::date, expense_date),
        description  = coalesce($2,       description),
        amount       = coalesce($3,       amount),
        method       = coalesce($4::payment_method, method),
        category     = coalesce($5,       category),
        notes        = coalesce($6,       notes),
        updated_at   = now()
      where id = $7
      returning id, expense_date, description, amount, method, category, notes
    `, [
      body.expense_date ?? null,
      body.description  ?? null,
      body.amount       ?? null,
      body.method       ?? null,
      body.category     ?? null,
      body.notes        ?? null,
      id,
    ])

    if (!row) return reply.status(404).send({ error: 'Gasto no encontrado' })
    return { ...row, amount: Number(row.amount) }
  })

  // ── DELETE /cash/expenses/:id ─────────────────────────────────────────────
  fastify.delete('/cash/expenses/:id', async (request, reply) => {
    const { id } = request.params as { id: string }
    await query(`delete from petty_cash_expenses where id = $1`, [id])
    return { ok: true }
  })
}
