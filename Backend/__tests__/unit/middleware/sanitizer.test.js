/**
 * Unit Tests for Input Sanitizer Middleware
 */

const {
  sanitizeValue,
  sanitizeObject,
  sanitizeEmail,
  sanitizePhone,
  sanitizeUrl,
  sanitizeFilename,
} = require('../../../middleware/sanitizer');

describe('Input Sanitizer Middleware', () => {
  describe('sanitizeValue', () => {
    it('should return non-string values unchanged', () => {
      expect(sanitizeValue(123)).toBe(123);
      expect(sanitizeValue(true)).toBe(true);
      expect(sanitizeValue(null)).toBe(null);
    });

    it('should trim whitespace', () => {
      expect(sanitizeValue('  hello  ')).toBe('hello');
    });

    it('should strip script tags', () => {
      const input = '<script>alert("xss")</script>Hello';
      const result = sanitizeValue(input);
      expect(result).not.toContain('<script>');
      expect(result).not.toContain('alert');
    });

    it('should skip password fields', () => {
      const input = 'password123';
      expect(sanitizeValue(input, 'password')).toBe(input);
    });

    it('should handle basic HTML in description fields', () => {
      const input = '<b>Bold</b> and <i>italic</i>';
      const result = sanitizeValue(input, 'description');
      expect(result).toContain('<b>');
      expect(result).toContain('<i>');
    });

    it('should strip dangerous tags even in HTML fields', () => {
      const input = '<script>bad()</script><b>Good</b>';
      const result = sanitizeValue(input, 'description');
      expect(result).not.toContain('script');
      expect(result).toContain('<b>');
    });
  });

  describe('sanitizeObject', () => {
    it('should sanitize all string fields in an object', () => {
      const input = {
        name: '  John  ',
        email: 'john@test.com',
        age: 30,
      };
      
      const result = sanitizeObject(input);
      expect(result.name).toBe('John');
      expect(result.age).toBe(30);
    });

    it('should handle nested objects', () => {
      const input = {
        user: {
          name: '  Jane  ',
        },
      };
      
      const result = sanitizeObject(input);
      expect(result.user.name).toBe('Jane');
    });

    it('should handle arrays', () => {
      const input = ['  hello  ', '  world  '];
      const result = sanitizeObject(input);
      expect(result[0]).toBe('hello');
      expect(result[1]).toBe('world');
    });

    it('should return null for null input', () => {
      expect(sanitizeObject(null)).toBeNull();
    });

    it('should return undefined for undefined input', () => {
      expect(sanitizeObject(undefined)).toBeUndefined();
    });
  });

  describe('sanitizeEmail', () => {
    it('should normalize valid email', () => {
      const result = sanitizeEmail('  John.Doe@GMAIL.com  ');
      expect(result).toBe('john.doe@gmail.com');
    });

    it('should return null for invalid email', () => {
      expect(sanitizeEmail('notanemail')).toBeNull();
    });

    it('should return null for empty string', () => {
      expect(sanitizeEmail('')).toBeNull();
    });

    it('should return null for null input', () => {
      expect(sanitizeEmail(null)).toBeNull();
    });
  });

  describe('sanitizePhone', () => {
    it('should clean phone number', () => {
      const result = sanitizePhone('+233 (024) 123-4567');
      expect(result).toBe('+2330241234567');
    });

    it('should return null for too short phone', () => {
      expect(sanitizePhone('123')).toBeNull();
    });

    it('should return null for too long phone', () => {
      expect(sanitizePhone('1234567890123456789')).toBeNull();
    });

    it('should return null for empty input', () => {
      expect(sanitizePhone('')).toBeNull();
    });
  });

  describe('sanitizeUrl', () => {
    it('should return valid URL unchanged', () => {
      const url = 'https://example.com/path';
      expect(sanitizeUrl(url)).toBe(url);
    });

    it('should add https:// to URL without protocol', () => {
      expect(sanitizeUrl('example.com')).toBe('https://example.com');
    });

    it('should return null for invalid URL', () => {
      expect(sanitizeUrl('not a url at all')).toBeNull();
    });

    it('should return null for empty input', () => {
      expect(sanitizeUrl('')).toBeNull();
    });
  });

  describe('sanitizeFilename', () => {
    it('should remove special characters', () => {
      const result = sanitizeFilename('my file!@#$.pdf');
      expect(result).toBe('my_file_.pdf');
    });

    it('should remove path traversal', () => {
      const result = sanitizeFilename('../../../etc/passwd');
      expect(result).not.toContain('..');
    });

    it('should truncate long filenames', () => {
      const longName = 'a'.repeat(300) + '.pdf';
      const result = sanitizeFilename(longName);
      expect(result.length).toBeLessThanOrEqual(255);
    });

    it('should return "file" for empty input', () => {
      expect(sanitizeFilename('')).toBe('file');
    });
  });
});
