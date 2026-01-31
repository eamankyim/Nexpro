/**
 * Unit Tests for Data Export Utility
 */

const {
  toCSV,
  escapeCSVValue,
  getNestedValue,
  formatValue,
  COLUMN_DEFINITIONS,
} = require('../../../utils/dataExport');

describe('Data Export Utility', () => {
  describe('escapeCSVValue', () => {
    it('should return empty string for null', () => {
      expect(escapeCSVValue(null)).toBe('');
    });

    it('should return empty string for undefined', () => {
      expect(escapeCSVValue(undefined)).toBe('');
    });

    it('should return value as-is if no special characters', () => {
      expect(escapeCSVValue('hello')).toBe('hello');
    });

    it('should wrap value in quotes if contains comma', () => {
      expect(escapeCSVValue('hello, world')).toBe('"hello, world"');
    });

    it('should wrap value in quotes if contains newline', () => {
      expect(escapeCSVValue('hello\nworld')).toBe('"hello\nworld"');
    });

    it('should escape double quotes', () => {
      expect(escapeCSVValue('hello "world"')).toBe('"hello ""world"""');
    });

    it('should handle numbers', () => {
      expect(escapeCSVValue(123)).toBe('123');
    });
  });

  describe('getNestedValue', () => {
    const obj = {
      name: 'John',
      address: {
        city: 'Accra',
        country: {
          name: 'Ghana',
        },
      },
    };

    it('should get top-level value', () => {
      expect(getNestedValue(obj, 'name')).toBe('John');
    });

    it('should get nested value', () => {
      expect(getNestedValue(obj, 'address.city')).toBe('Accra');
    });

    it('should get deeply nested value', () => {
      expect(getNestedValue(obj, 'address.country.name')).toBe('Ghana');
    });

    it('should return null for non-existent path', () => {
      expect(getNestedValue(obj, 'address.zip')).toBeNull();
    });

    it('should return object if no path provided', () => {
      expect(getNestedValue(obj, '')).toBe(obj);
    });
  });

  describe('formatValue', () => {
    it('should format date value', () => {
      const date = new Date('2024-01-15T10:30:00Z');
      expect(formatValue(date, 'date')).toBe('2024-01-15');
    });

    it('should format date string', () => {
      expect(formatValue('2024-01-15T10:30:00Z', 'date')).toBe('2024-01-15');
    });

    it('should format datetime value', () => {
      const date = new Date('2024-01-15T10:30:45Z');
      expect(formatValue(date, 'datetime')).toBe('2024-01-15 10:30:45');
    });

    it('should format currency value', () => {
      expect(formatValue(100.5, 'currency')).toBe('100.50');
    });

    it('should format boolean true', () => {
      expect(formatValue(true, 'boolean')).toBe('Yes');
    });

    it('should format boolean false', () => {
      expect(formatValue(false, 'boolean')).toBe('No');
    });

    it('should return empty string for null', () => {
      expect(formatValue(null, 'string')).toBe('');
    });
  });

  describe('toCSV', () => {
    const data = [
      { name: 'John', age: 30, city: 'Accra' },
      { name: 'Jane', age: 25, city: 'Kumasi' },
    ];

    it('should generate CSV with headers', () => {
      const columns = [
        { key: 'name', header: 'Name' },
        { key: 'age', header: 'Age' },
        { key: 'city', header: 'City' },
      ];
      
      const csv = toCSV(data, columns);
      const lines = csv.split('\n');
      
      expect(lines[0]).toBe('Name,Age,City');
      expect(lines[1]).toBe('John,30,Accra');
      expect(lines[2]).toBe('Jane,25,Kumasi');
    });

    it('should return empty string for empty array', () => {
      expect(toCSV([], [])).toBe('');
    });

    it('should infer columns from data if not provided', () => {
      const csv = toCSV(data);
      const lines = csv.split('\n');
      
      expect(lines[0]).toContain('name');
      expect(lines[0]).toContain('age');
    });
  });

  describe('COLUMN_DEFINITIONS', () => {
    it('should have customer columns', () => {
      expect(COLUMN_DEFINITIONS.customers).toBeDefined();
      expect(COLUMN_DEFINITIONS.customers.length).toBeGreaterThan(0);
    });

    it('should have product columns', () => {
      expect(COLUMN_DEFINITIONS.products).toBeDefined();
      expect(COLUMN_DEFINITIONS.products.length).toBeGreaterThan(0);
    });

    it('should have invoice columns', () => {
      expect(COLUMN_DEFINITIONS.invoices).toBeDefined();
    });

    it('should have proper column structure', () => {
      const customerCols = COLUMN_DEFINITIONS.customers;
      customerCols.forEach(col => {
        expect(col.key).toBeDefined();
        expect(col.header).toBeDefined();
      });
    });
  });
});
