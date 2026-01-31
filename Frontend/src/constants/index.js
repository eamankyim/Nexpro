/**
 * Application Constants and Configuration
 * 
 * Centralized location for all constants, configuration values,
 * and business rules used throughout the application.
 */

// API Configuration
export const API_CONFIG = {
  TIMEOUT: 30000, // 30 seconds
  MAX_RETRIES: 3,
  RETRY_DELAY_BASE: 1000, // 1 second
};

// Pagination Configuration
export const PAGINATION = {
  DEFAULT_PAGE_SIZE: 10,
  PAGE_SIZE_OPTIONS: [10, 20, 50, 100],
  MAX_PAGE_SIZE: 100,
};

// Debounce Delays (in milliseconds)
export const DEBOUNCE_DELAYS = {
  SEARCH: 500,
  INPUT: 300,
  RESIZE: 250,
};

// React Query Cache Configuration (in milliseconds)
export const QUERY_CACHE = {
  STALE_TIME_STABLE: 5 * 60 * 1000, // 5 minutes for stable data (users, settings, categories)
  STALE_TIME_DEFAULT: 2 * 60 * 1000, // 2 minutes for default data
  STALE_TIME_VOLATILE: 30 * 1000, // 30 seconds for frequently changing data
  CACHE_TIME: 10 * 60 * 1000, // 10 minutes cache time
};

// Business Types
export const BUSINESS_TYPES = {
  PRINTING_PRESS: 'printing_press',
  SHOP: 'shop',
  PHARMACY: 'pharmacy',
};

// Job Statuses
export const JOB_STATUSES = {
  NEW: 'new',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
  ON_HOLD: 'on_hold',
  CANCELLED: 'cancelled',
};

// Invoice Statuses
export const INVOICE_STATUSES = {
  DRAFT: 'draft',
  SENT: 'sent',
  PAID: 'paid',
  PARTIAL: 'partial',
  OVERDUE: 'overdue',
  CANCELLED: 'cancelled',
};

// Expense Statuses
export const EXPENSE_STATUSES = {
  DRAFT: 'draft',
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  PAID: 'paid',
};

// Expense Approval Statuses
export const EXPENSE_APPROVAL_STATUSES = {
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected',
};

// Lead Statuses
export const LEAD_STATUSES = {
  NEW: 'new',
  CONTACTED: 'contacted',
  QUALIFIED: 'qualified',
  CONVERTED: 'converted',
  LOST: 'lost',
};

// Lead Priorities
export const LEAD_PRIORITIES = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
};

// User Roles
export const USER_ROLES = {
  ADMIN: 'admin',
  MANAGER: 'manager',
  EMPLOYEE: 'employee',
};

// Date Formats
export const DATE_FORMATS = {
  DISPLAY: 'MMM DD, YYYY',
  DISPLAY_WITH_TIME: 'MMM DD, YYYY HH:mm',
  INPUT: 'YYYY-MM-DD',
  DATETIME: 'YYYY-MM-DD HH:mm:ss',
};

// File Upload Configuration
export const FILE_UPLOAD = {
  MAX_SIZE_MB: 20,
  MAX_SIZE_BYTES: 20 * 1024 * 1024, // 20MB
  ALLOWED_IMAGE_TYPES: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
  ALLOWED_DOCUMENT_TYPES: ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
};

// Currency Configuration
export const CURRENCY = {
  SYMBOL: 'GHS',
  DECIMAL_PLACES: 2,
};

// Notification Types
export const NOTIFICATION_TYPES = {
  INFO: 'info',
  SUCCESS: 'success',
  WARNING: 'warning',
  ERROR: 'error',
};

// Notification Priorities
export const NOTIFICATION_PRIORITIES = {
  LOW: 'low',
  NORMAL: 'normal',
  HIGH: 'high',
  URGENT: 'urgent',
};

// Chart Colors (for consistent theming)
export const CHART_COLORS = [
  '#0088FE',
  '#00C49F',
  '#FFBB28',
  '#FF8042',
  '#8884d8',
  '#82ca9d',
  '#ffc658',
  '#ff7300',
];

// Status chip Tailwind class strings (single source of truth for StatusChip and status badges)
export const CHIP_GREEN = 'bg-green-100 text-green-800 border-green-300';
export const CHIP_RED = 'bg-red-100 text-red-800 border-red-300';
export const CHIP_ORANGE = 'bg-orange-100 text-orange-800 border-orange-300';
export const CHIP_BLUE = 'bg-blue-100 text-blue-800 border-blue-300';
export const CHIP_YELLOW = 'bg-yellow-100 text-yellow-800 border-yellow-300';
export const CHIP_PURPLE = 'bg-purple-100 text-purple-800 border-purple-300';
export const CHIP_GRAY = 'bg-gray-100 text-gray-800 border-gray-300';

/** Default chip class when status is unknown */
export const STATUS_CHIP_DEFAULT_CLASS = CHIP_GRAY;

/**
 * Status → Tailwind classes for StatusChip. Used by StatusChip component.
 * Semantic mapping: green = success/done, red = danger/closed negative,
 * orange = warning/pending, blue = in progress/info, yellow = draft/new,
 * purple = special/qualified, gray = neutral.
 */
export const STATUS_CHIP_CLASSES = {
  // Job statuses
  [JOB_STATUSES.NEW]: CHIP_YELLOW,
  [JOB_STATUSES.IN_PROGRESS]: CHIP_BLUE,
  [JOB_STATUSES.COMPLETED]: CHIP_GREEN,
  [JOB_STATUSES.ON_HOLD]: CHIP_ORANGE,
  [JOB_STATUSES.CANCELLED]: CHIP_RED,
  // Invoice statuses
  [INVOICE_STATUSES.DRAFT]: CHIP_YELLOW,
  [INVOICE_STATUSES.SENT]: CHIP_BLUE,
  [INVOICE_STATUSES.PAID]: CHIP_GREEN,
  [INVOICE_STATUSES.PARTIAL]: CHIP_ORANGE,
  [INVOICE_STATUSES.OVERDUE]: CHIP_RED,
  [INVOICE_STATUSES.CANCELLED]: CHIP_RED,
  // Expense statuses
  [EXPENSE_STATUSES.DRAFT]: CHIP_YELLOW,
  [EXPENSE_STATUSES.PENDING]: CHIP_ORANGE,
  [EXPENSE_STATUSES.APPROVED]: CHIP_GREEN,
  [EXPENSE_STATUSES.REJECTED]: CHIP_RED,
  [EXPENSE_STATUSES.PAID]: CHIP_GREEN,
  // Lead statuses
  [LEAD_STATUSES.NEW]: CHIP_YELLOW,
  [LEAD_STATUSES.CONTACTED]: CHIP_BLUE,
  [LEAD_STATUSES.QUALIFIED]: CHIP_PURPLE,
  [LEAD_STATUSES.CONVERTED]: CHIP_GREEN,
  [LEAD_STATUSES.LOST]: CHIP_RED,
  // Quote statuses
  draft: CHIP_YELLOW,
  sent: CHIP_BLUE,
  accepted: CHIP_GREEN,
  declined: CHIP_RED,
  expired: CHIP_RED,
  // Sale statuses
  completed: CHIP_GREEN,
  pending: CHIP_ORANGE,
  // Payroll run statuses (approved, paid same as expense)
  // Employee statuses
  active: CHIP_BLUE,
  inactive: CHIP_RED,
  on_leave: CHIP_PURPLE,
  probation: CHIP_PURPLE,
  terminated: CHIP_RED,
  // Tenant / billing statuses
  paused: CHIP_PURPLE,
  suspended: CHIP_RED,
  // Stock statuses
  in_stock: CHIP_GREEN,
  instock: CHIP_GREEN,
  low_stock: CHIP_ORANGE,
  lowstock: CHIP_ORANGE,
  out_of_stock: CHIP_RED,
  outofstock: CHIP_RED,
  // Product active flag (display)
  active_flag: CHIP_GREEN,
  inactive_flag: CHIP_RED,
  // Accounting
  posted: CHIP_GREEN,
  // Health / DB
  online: CHIP_GRAY,
  offline: CHIP_RED,
  // POS sync / receipt / export
  syncing: CHIP_BLUE,
  synced: CHIP_GREEN,
  failed: CHIP_RED,
  sending: CHIP_BLUE,
  ready: CHIP_GRAY,
  processing: CHIP_BLUE,
  // Subscription
  trialing: CHIP_YELLOW,
  // Prescriptions
  filled: CHIP_GREEN,
  dispensed: CHIP_GREEN,
  in_progress: CHIP_BLUE,
  inprogress: CHIP_BLUE,
  // Aliases for StatusChip (various forms)
  new: CHIP_YELLOW,
  cancelled: CHIP_RED,
  lost: CHIP_RED,
  converted: CHIP_GREEN,
  rejected: CHIP_RED,
  overdue: CHIP_ORANGE,
  partial: CHIP_ORANGE,
  on_hold: CHIP_ORANGE,
  pending_approval: CHIP_ORANGE,
  qualified: CHIP_PURPLE,
  declined: CHIP_RED,
  expired: CHIP_RED,
  contacted: CHIP_BLUE,
  accepted: CHIP_GREEN,
};

/** Priority → Tailwind classes for priority chips (Jobs, Leads). */
export const PRIORITY_CHIP_CLASSES = {
  low: CHIP_GRAY,
  medium: CHIP_BLUE,
  high: CHIP_ORANGE,
  urgent: CHIP_RED,
};

/** Role → Tailwind classes for role chips (Users). */
export const ROLE_CHIP_CLASSES = {
  admin: 'border-transparent bg-red-100 text-red-800 border-red-300',
  manager: 'border-transparent bg-primary text-primary-foreground',
  employee: CHIP_GRAY,
  staff: CHIP_GRAY,
};

// Payment Methods
export const PAYMENT_METHODS = {
  CASH: 'cash',
  MOBILE_MONEY: 'mobile_money',
  BANK_TRANSFER: 'bank_transfer',
  CHEQUE: 'cheque',
  CARD: 'card',
  OTHER: 'other',
};

// Default Values
export const DEFAULTS = {
  PRIORITY: LEAD_PRIORITIES.MEDIUM,
  STATUS: JOB_STATUSES.NEW,
  PAGE_SIZE: PAGINATION.DEFAULT_PAGE_SIZE,
};

// Error Messages
export const ERROR_MESSAGES = {
  NETWORK_ERROR: 'Unable to connect to server. Please check your internet connection.',
  TIMEOUT_ERROR: 'Request timed out. Please try again.',
  UNAUTHORIZED: 'You are not authorized to perform this action.',
  NOT_FOUND: 'The requested resource was not found.',
  VALIDATION_ERROR: 'Please check your input and try again.',
  SERVER_ERROR: 'An error occurred on the server. Please try again later.',
  UNKNOWN_ERROR: 'An unexpected error occurred. Please try again.',
};

// Success Messages
export const SUCCESS_MESSAGES = {
  CREATED: 'Created successfully',
  UPDATED: 'Updated successfully',
  DELETED: 'Deleted successfully',
  SAVED: 'Saved successfully',
};

// Header search placeholders (context-aware per page)
export const SEARCH_PLACEHOLDERS = {
  GLOBAL: 'Search products, customers and transactions',
  CUSTOMERS: 'Search for customers',
  INVOICES: 'Search for invoices',
  LEADS: 'Search for leads',
  JOBS: 'Search for jobs',
  QUOTES: 'Search for quotes',
  VENDORS: 'Search for vendors',
  INVENTORY: 'Search for inventory',
  EMPLOYEES: 'Search for employees',
  USERS: 'Search for users',
  EXPENSES: 'Search for expenses',
  SALES: 'Search for sales',
  PAYROLL: 'Search for payroll',
  ACCOUNTING: 'Search for accounting',
  REPORTS: 'Search for reports',
  SHOPS: 'Search for shops',
  PHARMACIES: 'Search for pharmacies',
  PRODUCTS: 'Search for products',
  DRUGS: 'Search for drugs',
  PRESCRIPTIONS: 'Search for prescriptions',
  PRICING: 'Search for pricing',
  ADMIN_TENANTS: 'Search tenants by name or slug',
};

// Responsive Breakpoints (in pixels)
export const RESPONSIVE = {
  BREAKPOINTS: {
    MOBILE: 768,
    TABLET: 1024,
    DESKTOP: 1280,
  },
  // Touch target sizes (in pixels)
  TOUCH_TARGETS: {
    MIN_SIZE: 44, // Minimum touch target size (iOS/Android guidelines)
    RECOMMENDED_SIZE: 48, // Recommended touch target size
    BUTTON_HEIGHT: 44, // Standard button height for mobile
  },
  // Spacing scale for mobile (in Tailwind units)
  SPACING: {
    MOBILE_PADDING: 4, // 16px
    TABLET_PADDING: 6, // 24px
    DESKTOP_PADDING: 8, // 32px
    MOBILE_GAP: 3, // 12px
    TABLET_GAP: 4, // 16px
    DESKTOP_GAP: 6, // 24px
  },
  // Typography scale
  TYPOGRAPHY: {
    MOBILE_BASE: 14, // Base font size for mobile (14px)
    TABLET_BASE: 15, // Base font size for tablet (15px)
    DESKTOP_BASE: 16, // Base font size for desktop (16px)
    MOBILE_LINE_HEIGHT: 1.5, // Line height for mobile
    DESKTOP_LINE_HEIGHT: 1.6, // Line height for desktop
  },
  // Grid columns
  GRID_COLUMNS: {
    MOBILE: 1,
    TABLET: 2,
    DESKTOP: 3,
    LARGE_DESKTOP: 4,
  },
};

// =============================================
// PRODUCT MANAGEMENT CONSTANTS
// =============================================

// Product Units (common African market units)
export const PRODUCT_UNITS = [
  { value: 'pcs', label: 'Pieces' },
  { value: 'bag', label: 'Bag' },
  { value: 'crate', label: 'Crate' },
  { value: 'carton', label: 'Carton' },
  { value: 'dozen', label: 'Dozen' },
  { value: 'sachet', label: 'Sachet' },
  { value: 'pack', label: 'Pack' },
  { value: 'bundle', label: 'Bundle' },
  { value: 'kg', label: 'Kilogram (kg)' },
  { value: 'g', label: 'Gram (g)' },
  { value: 'L', label: 'Litre (L)' },
  { value: 'mL', label: 'Millilitre (mL)' },
  { value: 'box', label: 'Box' },
  { value: 'roll', label: 'Roll' },
  { value: 'pair', label: 'Pair' },
  { value: 'set', label: 'Set' },
  { value: 'meter', label: 'Meter' },
  { value: 'yard', label: 'Yard' },
];

// Profit Margin Thresholds (for color coding)
export const MARGIN_THRESHOLDS = {
  LOW: 10, // Below 10% - red/danger
  MEDIUM: 30, // 10-30% - yellow/warning
  // Above 30% - green/success
};

// Get margin color based on percentage
export const getMarginColor = (marginPercent) => {
  if (marginPercent < MARGIN_THRESHOLDS.LOW) return 'destructive';
  if (marginPercent < MARGIN_THRESHOLDS.MEDIUM) return 'secondary';
  return 'default';
};

// Calculate profit margin
export const calculateMargin = (costPrice, sellingPrice) => {
  const cost = parseFloat(costPrice) || 0;
  const sell = parseFloat(sellingPrice) || 0;
  if (sell === 0) return 0;
  return ((sell - cost) / sell) * 100;
};

// Shop Types (from backend config)
export const SHOP_TYPES = {
  SUPERMARKET: 'supermarket',
  HARDWARE: 'hardware',
  ELECTRONICS: 'electronics',
  CLOTHING: 'clothing',
  FURNITURE: 'furniture',
  BOOKSTORE: 'bookstore',
  AUTO_PARTS: 'auto_parts',
  CONVENIENCE: 'convenience',
  BEAUTY: 'beauty',
  SPORTS: 'sports',
  TOYS: 'toys',
  PET: 'pet',
  STATIONERY: 'stationery',
  OTHER: 'other',
};

// Shop Type Display Labels
export const SHOP_TYPE_LABELS = {
  [SHOP_TYPES.SUPERMARKET]: 'Supermarket/Grocery',
  [SHOP_TYPES.HARDWARE]: 'Hardware Store',
  [SHOP_TYPES.ELECTRONICS]: 'Electronics Store',
  [SHOP_TYPES.CLOTHING]: 'Clothing/Fashion',
  [SHOP_TYPES.FURNITURE]: 'Furniture Store',
  [SHOP_TYPES.BOOKSTORE]: 'Bookstore',
  [SHOP_TYPES.AUTO_PARTS]: 'Auto Parts',
  [SHOP_TYPES.CONVENIENCE]: 'Convenience Store',
  [SHOP_TYPES.BEAUTY]: 'Beauty/Cosmetics',
  [SHOP_TYPES.SPORTS]: 'Sports Store',
  [SHOP_TYPES.TOYS]: 'Toy Store',
  [SHOP_TYPES.PET]: 'Pet Store',
  [SHOP_TYPES.STATIONERY]: 'Stationery',
  [SHOP_TYPES.OTHER]: 'Other',
};

// Conditional Fields by Shop Type
export const SHOP_TYPE_FIELDS = {
  // Fields for supermarket and convenience stores
  [SHOP_TYPES.SUPERMARKET]: ['expiryDate', 'batchNumber', 'isPerishable'],
  [SHOP_TYPES.CONVENIENCE]: ['expiryDate', 'batchNumber', 'isPerishable'],
  
  // Fields for electronics stores
  [SHOP_TYPES.ELECTRONICS]: ['serialNumber', 'warrantyPeriod', 'specifications'],
  
  // Fields for hardware stores
  [SHOP_TYPES.HARDWARE]: ['dimensions', 'weight', 'material'],
  
  // Fields for clothing and beauty (variants)
  [SHOP_TYPES.CLOTHING]: ['hasVariants', 'sizes', 'colors'],
  [SHOP_TYPES.BEAUTY]: ['expiryDate', 'batchNumber', 'hasVariants', 'sizes'],
  
  // Fields for auto parts
  [SHOP_TYPES.AUTO_PARTS]: ['partNumber', 'compatibility', 'vehicleModels'],
  
  // Fields for bookstore and stationery
  [SHOP_TYPES.BOOKSTORE]: ['isbn', 'author', 'publisher'],
  [SHOP_TYPES.STATIONERY]: ['isbn', 'brand'],
  
  // Fields for furniture
  [SHOP_TYPES.FURNITURE]: ['dimensions', 'material', 'assemblyRequired'],
  
  // Default fields for other types
  [SHOP_TYPES.SPORTS]: [],
  [SHOP_TYPES.TOYS]: [],
  [SHOP_TYPES.PET]: ['expiryDate'],
  [SHOP_TYPES.OTHER]: [],
};

// Product Field Labels
export const PRODUCT_FIELD_LABELS = {
  expiryDate: 'Expiry Date (optional)',
  batchNumber: 'Batch Number (optional)',
  isPerishable: 'Perishable (optional)',
  serialNumber: 'Serial Number (optional)',
  warrantyPeriod: 'Warranty Period (optional)',
  specifications: 'Specifications (optional)',
  dimensions: 'Dimensions (optional)',
  weight: 'Weight (optional)',
  material: 'Material (optional)',
  hasVariants: 'Has Variants',
  sizes: 'Available Sizes',
  colors: 'Available Colors',
  partNumber: 'Part Number (optional)',
  compatibility: 'Compatibility (optional)',
  vehicleModels: 'Vehicle Models (optional)',
  isbn: 'ISBN/Code (optional)',
  author: 'Author (optional)',
  publisher: 'Publisher (optional)',
  assemblyRequired: 'Assembly Required (optional)',
};

// Common Size Options (for clothing/beauty)
export const SIZE_OPTIONS = [
  { value: 'XS', label: 'Extra Small (XS)' },
  { value: 'S', label: 'Small (S)' },
  { value: 'M', label: 'Medium (M)' },
  { value: 'L', label: 'Large (L)' },
  { value: 'XL', label: 'Extra Large (XL)' },
  { value: 'XXL', label: 'Double XL (XXL)' },
  { value: '3XL', label: 'Triple XL (3XL)' },
];

// Common Color Options
export const COLOR_OPTIONS = [
  { value: 'black', label: 'Black' },
  { value: 'white', label: 'White' },
  { value: 'red', label: 'Red' },
  { value: 'blue', label: 'Blue' },
  { value: 'green', label: 'Green' },
  { value: 'yellow', label: 'Yellow' },
  { value: 'orange', label: 'Orange' },
  { value: 'purple', label: 'Purple' },
  { value: 'pink', label: 'Pink' },
  { value: 'brown', label: 'Brown' },
  { value: 'grey', label: 'Grey' },
  { value: 'navy', label: 'Navy Blue' },
  { value: 'beige', label: 'Beige' },
];

// Warranty Period Options (in months)
export const WARRANTY_OPTIONS = [
  { value: 0, label: 'No Warranty' },
  { value: 3, label: '3 Months' },
  { value: 6, label: '6 Months' },
  { value: 12, label: '1 Year' },
  { value: 24, label: '2 Years' },
  { value: 36, label: '3 Years' },
];

// Stock Status Helpers
export const STOCK_STATUS = {
  IN_STOCK: 'in_stock',
  LOW_STOCK: 'low_stock',
  OUT_OF_STOCK: 'out_of_stock',
};

export const getStockStatus = (quantity, reorderLevel) => {
  const qty = parseFloat(quantity) || 0;
  const reorder = parseFloat(reorderLevel) || 0;
  
  if (qty <= 0) return STOCK_STATUS.OUT_OF_STOCK;
  if (qty <= reorder) return STOCK_STATUS.LOW_STOCK;
  return STOCK_STATUS.IN_STOCK;
};

export const getStockStatusConfig = (quantity, reorderLevel) => {
  const status = getStockStatus(quantity, reorderLevel);
  
  switch (status) {
    case STOCK_STATUS.OUT_OF_STOCK:
      return { color: 'destructive', label: 'Out of Stock' };
    case STOCK_STATUS.LOW_STOCK:
      return { color: 'secondary', label: 'Low Stock' };
    default:
      return { color: 'default', label: 'In Stock' };
  }
};
