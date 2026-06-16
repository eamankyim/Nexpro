import { api } from './api';
import { buildScopedQueryString, withActiveShopScope } from '@/utils/shopScope';

type ProductParams = {
  page?: number;
  limit?: number;
  search?: string;
  barcode?: string;
  isActive?: boolean;
  shopId?: string;
};

export type CreateProductPayload = {
  name: string;
  sku?: string;
  barcode?: string;
  barcodeAliases?: string[];
  description?: string;
  sellingPrice: number;
  costPrice?: number;
  quantityOnHand?: number;
  reorderLevel?: number;
  unit?: string;
  isActive?: boolean;
  trackStock?: boolean;
  shopId?: string;
  imageUrl?: string;
  metadata?: Record<string, unknown>;
};

type ProductEntity = {
  id: string;
  quantityOnHand?: number | string | null;
  metadata?: Record<string, unknown>;
};

const getProductEntity = (response: unknown): ProductEntity => {
  const body = response && typeof response === 'object' ? response as Record<string, unknown> : {};
  const data = body.data && typeof body.data === 'object' ? body.data as Record<string, unknown> : undefined;
  const product = data?.product && typeof data.product === 'object'
    ? data.product as ProductEntity
    : data
      ? data as ProductEntity
      : body as ProductEntity;
  return product;
};

const isNotFoundError = (error: unknown) =>
  typeof error === 'object' &&
  error !== null &&
  'response' in error &&
  (error as { response?: { status?: number } }).response?.status === 404;

export const productService = {
  getProducts: async (params: ProductParams = {}) => {
    const query = await buildScopedQueryString(params);
    const res = await api.get(query ? `/products?${query}` : '/products');
    // Backend returns: { success: true, count: N, pagination: {...}, data: [...] }
    return res.data;
  },

  getProductByBarcode: async (barcode: string) => {
    const res = await api.get(`/products/barcode/${encodeURIComponent(barcode)}`);
    // Backend returns: { success: true, data: {...} }
    return res.data;
  },

  getProductByBarcodeCandidates: async (barcodes: string[]) => {
    const candidates = [...new Set(barcodes.map((barcode) => barcode.trim()).filter(Boolean))];
    let lastNotFoundError: unknown;

    for (const barcode of candidates) {
      try {
        return await productService.getProductByBarcode(barcode);
      } catch (error) {
        if (!isNotFoundError(error)) {
          throw error;
        }
        lastNotFoundError = error;
      }
    }

    throw lastNotFoundError ?? new Error('Product not found');
  },

  getProductById: async (id: string) => {
    const res = await api.get(`/products/${id}`);
    // Backend returns: { success: true, data: {...} }
    return res.data;
  },

  createProduct: async (data: CreateProductPayload) => {
    const { metadata, shopId, barcodeAliases, ...rest } = data;
    const scoped = await withActiveShopScope({ ...rest, shopId });
    const res = await api.post('/products', {
      unit: 'pcs',
      isActive: true,
      trackStock: true,
      costPrice: 0,
      quantityOnHand: 0,
      reorderLevel: 0,
      ...scoped,
      ...(barcodeAliases ? { barcodeAliases } : {}),
      ...(metadata && Object.keys(metadata).length > 0 ? { metadata } : {}),
    });
    return res.data;
  },

  uploadProductImage: async (uri: string, mimeType = 'image/jpeg') => {
    const formData = new FormData();
    const ext = mimeType.includes('png') ? 'png' : mimeType.includes('webp') ? 'webp' : 'jpg';
    formData.append('file', {
      uri,
      name: `product.${ext}`,
      type: mimeType,
    } as unknown as Blob);
    const res = await api.post('/products/upload-image', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 120000,
    });
    const body = res.data as { imageUrl?: string; data?: { imageUrl?: string } };
    const imageUrl = body?.imageUrl ?? body?.data?.imageUrl;
    if (!imageUrl) {
      throw new Error('Upload succeeded but no image URL was returned');
    }
    return imageUrl;
  },

  updateProduct: async (id: string, data: {
    name?: string;
    sku?: string;
    barcode?: string;
    barcodeAliases?: string[];
    sellingPrice?: number;
    costPrice?: number;
    quantityOnHand?: number;
    isActive?: boolean;
    imageUrl?: string;
    metadata?: Record<string, unknown>;
  }) => {
    const res = await api.put(`/products/${id}`, data);
    // Backend returns: { success: true, data: {...} }
    return res.data;
  },

  adjustStock: async (id: string, quantity: number, mode: 'set' | 'delta' = 'set', reason = '') => {
    const response = await productService.getProductById(id);
    const product = getProductEntity(response);
    const currentQuantity = Number(product.quantityOnHand ?? 0);
    const baseQuantity = Number.isFinite(currentQuantity) ? currentQuantity : 0;
    const newQuantity = mode === 'delta' ? baseQuantity + quantity : quantity;

    return productService.updateProduct(id, {
      quantityOnHand: Math.max(0, newQuantity),
      metadata: {
        ...(product.metadata ?? {}),
        lastStockAdjustment: {
          previousQuantity: baseQuantity,
          newQuantity,
          mode,
          reason,
          timestamp: new Date().toISOString(),
        },
      },
    });
  },

  deleteProduct: async (id: string) => {
    const res = await api.delete(`/products/${id}`);
    // Backend returns: { success: true, message: '...' }
    return res.data;
  },
};
