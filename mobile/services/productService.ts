import { api } from './api';

type ProductParams = {
  page?: number;
  limit?: number;
  search?: string;
  barcode?: string;
  isActive?: boolean;
};

export const productService = {
  getProducts: async (params: ProductParams = {}) => {
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value === undefined || value === null || value === '') return;
      searchParams.append(key, String(value));
    });
    const query = searchParams.toString();
    const res = await api.get(query ? `/products?${query}` : '/products');
    // Backend returns: { success: true, count: N, pagination: {...}, data: [...] }
    return res.data;
  },

  getProductByBarcode: async (barcode: string) => {
    const res = await api.get(`/products/barcode/${encodeURIComponent(barcode)}`);
    // Backend returns: { success: true, data: {...} }
    return res.data;
  },

  getProductById: async (id: string) => {
    const res = await api.get(`/products/${id}`);
    // Backend returns: { success: true, data: {...} }
    return res.data;
  },

  updateProduct: async (id: string, data: {
    name?: string;
    sku?: string;
    barcode?: string;
    sellingPrice?: number;
    costPrice?: number;
    quantityOnHand?: number;
    isActive?: boolean;
  }) => {
    const res = await api.put(`/products/${id}`, data);
    // Backend returns: { success: true, data: {...} }
    return res.data;
  },

  deleteProduct: async (id: string) => {
    const res = await api.delete(`/products/${id}`);
    // Backend returns: { success: true, message: '...' }
    return res.data;
  },
};
