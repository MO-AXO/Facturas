import axios from 'axios'

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? '',
})

// ── Tipos compartidos ─────────────────────────────────────────────────────────

export type InvoiceStatus = 'pending' | 'extracting' | 'review' | 'approved' | 'rejected' | 'error'
export type MatchStatus = 'auto' | 'suggested' | 'manual' | 'confirmed' | 'new_sku'

export type InvoiceLine = {
  id: string
  line_number: number
  raw_description: string
  raw_quantity: number | null
  raw_unit: string | null
  raw_unit_price: number | null
  raw_subtotal: number | null
  sku_id: string | null
  matched_quantity: number | null
  matched_unit: string | null
  matched_unit_price: number | null
  match_status: MatchStatus
  match_confidence: number | null
  match_method: string | null
  skus: { id: string; code: string; name: string; unit: string } | null
}

export type Invoice = {
  id: string
  folio: string | null
  invoice_date: string | null
  subtotal: number | null
  tax_amount: number | null
  total: number | null
  currency: string
  status: InvoiceStatus
  storage_path: string
  signed_url?: string
  created_at: string
  extracted_at: string | null
  approved_at: string | null
  suppliers: { id: string; name: string; rfc: string | null } | null
  invoice_lines: InvoiceLine[]
}

export type Sku = {
  id: string
  code: string
  name: string
  description: string | null
  category: string | null
  unit: string
}

// ── API calls ─────────────────────────────────────────────────────────────────

export const invoicesApi = {
  upload: (file: File) => {
    const form = new FormData()
    form.append('file', file)
    return api.post<{ invoiceId: string; status: string }>('/api/invoices', form)
  },

  list: (params?: { status?: string; page?: number }) =>
    api.get<{ data: Invoice[]; total: number }>('/api/invoices', { params }),

  get: (id: string) =>
    api.get<Invoice>(`/api/invoices/${id}`),

  updateLine: (invoiceId: string, lineId: string, data: Partial<InvoiceLine> & { sku_id?: string }) =>
    api.patch(`/api/invoices/${invoiceId}/lines/${lineId}`, data),

  approve: (id: string) =>
    api.post(`/api/invoices/${id}/approve`),

  reject: (id: string, reason?: string) =>
    api.post(`/api/invoices/${id}/reject`, { reason }),
}

export const catalogApi = {
  searchSkus: (search: string) =>
    api.get<{ data: Sku[] }>('/api/skus', { params: { search } }),

  listSuppliers: () =>
    api.get<{ data: { id: string; name: string; rfc: string | null }[] }>('/api/suppliers'),

  priceHistory: (skuId: string, days?: number) =>
    api.get(`/api/price-history/${skuId}`, { params: { days } }),

  alerts: () =>
    api.get<{ data: any[] }>('/api/alerts'),

  acknowledgeAlert: (id: string) =>
    api.patch(`/api/alerts/${id}/acknowledge`),
}
