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
  override_notes: string | null   // JSON con sugerencia de SKU nuevo cuando match_status = 'manual'
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
  file_name: string | null
  file_type: string | null
  created_at: string
  extracted_at: string | null
  approved_at: string | null
  error_message: string | null
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

  createSkuFromLine: (
    invoiceId: string,
    lineId: string,
    data: { name: string; code: string; unit: string; category?: string; description?: string }
  ) => api.post<{ ok: boolean; sku: Sku }>(`/api/invoices/${invoiceId}/lines/${lineId}/create-sku`, data),

  approve: (id: string) =>
    api.post(`/api/invoices/${id}/approve`),

  reject: (id: string, reason?: string) =>
    api.post(`/api/invoices/${id}/reject`, { reason }),
}

export type Supplier = {
  id: string
  name: string
  rfc: string | null
  email: string | null
  phone: string | null
  notes: string | null
  active: boolean
}

export const catalogApi = {
  searchSkus: (search: string) =>
    api.get<{ data: Sku[] }>('/api/skus', { params: { search } }),

  listSuppliers: () =>
    api.get<{ data: Supplier[] }>('/api/suppliers'),

  getSupplier: (id: string) =>
    api.get<Supplier>(`/api/suppliers/${id}`),

  updateSupplier: (id: string, data: Partial<Supplier>) =>
    api.patch<Supplier>(`/api/suppliers/${id}`, data),

  createSupplier: (data: { name: string; rfc?: string; email?: string; phone?: string }) =>
    api.post<Supplier>('/api/suppliers', data),

  priceHistory: (skuId: string, days?: number) =>
    api.get(`/api/price-history/${skuId}`, { params: { days } }),

  alerts: () =>
    api.get<{ data: any[] }>('/api/alerts'),

  acknowledgeAlert: (id: string) =>
    api.patch(`/api/alerts/${id}/acknowledge`),

  // Analytics
  spendBySupplier: (days = 90) =>
    api.get<{ data: { id: string; name: string; total_spend: number; invoice_count: number; last_invoice_date: string }[] }>(
      '/api/analytics/spend-by-supplier', { params: { days } }
    ),

  spendOverTime: (days = 365, supplierId?: string) =>
    api.get<{ data: { month: string; total_spend: number }[] }>(
      '/api/analytics/spend-over-time', { params: { days, supplier_id: supplierId } }
    ),

  topSkus: (days = 90, supplierId?: string, limit = 10) =>
    api.get<{ data: { id: string; code: string; name: string; unit: string; total_spend: number; avg_price: number; purchase_count: number }[] }>(
      '/api/analytics/top-skus', { params: { days, supplier_id: supplierId, limit } }
    ),
}
