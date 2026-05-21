// Tipos compartidos entre apps/api y apps/web

export type InvoiceStatus = 'pending' | 'extracting' | 'review' | 'approved' | 'rejected' | 'error'
export type MatchStatus = 'auto' | 'suggested' | 'manual' | 'confirmed' | 'new_sku'
export type AlertType = 'price_increase' | 'price_decrease' | 'price_increase_avg'
export type AlertStatus = 'active' | 'acknowledged' | 'resolved'

export const CONFIDENCE_AUTO = 0.92
export const CONFIDENCE_SUGGEST = 0.75
