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

// Status Colors Mapping
export const STATUS_COLORS = {
  // Job statuses
  [JOB_STATUSES.NEW]: 'blue',
  [JOB_STATUSES.IN_PROGRESS]: 'orange',
  [JOB_STATUSES.COMPLETED]: 'green',
  [JOB_STATUSES.ON_HOLD]: 'yellow',
  [JOB_STATUSES.CANCELLED]: 'red',
  
  // Invoice statuses
  [INVOICE_STATUSES.DRAFT]: 'default',
  [INVOICE_STATUSES.SENT]: 'blue',
  [INVOICE_STATUSES.PAID]: 'green',
  [INVOICE_STATUSES.PARTIAL]: 'orange',
  [INVOICE_STATUSES.OVERDUE]: 'red',
  [INVOICE_STATUSES.CANCELLED]: 'red',
  
  // Expense statuses
  [EXPENSE_STATUSES.DRAFT]: 'default',
  [EXPENSE_STATUSES.PENDING]: 'blue',
  [EXPENSE_STATUSES.APPROVED]: 'green',
  [EXPENSE_STATUSES.REJECTED]: 'red',
  [EXPENSE_STATUSES.PAID]: 'green',
  
  // Lead statuses
  [LEAD_STATUSES.NEW]: 'blue',
  [LEAD_STATUSES.CONTACTED]: 'orange',
  [LEAD_STATUSES.QUALIFIED]: 'cyan',
  [LEAD_STATUSES.CONVERTED]: 'green',
  [LEAD_STATUSES.LOST]: 'red',
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
