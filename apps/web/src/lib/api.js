import axios from 'axios';
export const api = axios.create({
    baseURL: import.meta.env.VITE_API_URL ?? '',
});
// ── API calls ─────────────────────────────────────────────────────────────────
export const invoicesApi = {
    upload: (file) => {
        const form = new FormData();
        form.append('file', file);
        return api.post('/api/invoices', form);
    },
    list: (params) => api.get('/api/invoices', { params }),
    get: (id) => api.get(`/api/invoices/${id}`),
    updateLine: (invoiceId, lineId, data) => api.patch(`/api/invoices/${invoiceId}/lines/${lineId}`, data),
    approve: (id) => api.post(`/api/invoices/${id}/approve`),
    reject: (id, reason) => api.post(`/api/invoices/${id}/reject`, { reason }),
};
export const catalogApi = {
    searchSkus: (search) => api.get('/api/skus', { params: { search } }),
    listSuppliers: () => api.get('/api/suppliers'),
    priceHistory: (skuId, days) => api.get(`/api/price-history/${skuId}`, { params: { days } }),
    alerts: () => api.get('/api/alerts'),
    acknowledgeAlert: (id) => api.patch(`/api/alerts/${id}/acknowledge`),
};
