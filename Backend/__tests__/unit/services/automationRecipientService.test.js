jest.mock('../../../models', () => ({
  User: { findAll: jest.fn() },
  UserTenant: { findAll: jest.fn(), findOne: jest.fn() },
  Employee: { findAll: jest.fn() },
}));

const { User, UserTenant, Employee } = require('../../../models');
const {
  normalizeRecipientConfig,
  isInternalAudience,
  resolveStaffRecipients,
} = require('../../../services/automationRecipientService');

describe('automationRecipientService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('normalizeRecipientConfig', () => {
    it('normalizes assignee, role, and user shapes', () => {
      expect(normalizeRecipientConfig({ type: 'assignee' })).toEqual({ type: 'assignee' });
      expect(normalizeRecipientConfig({ type: 'role', roles: ['Owner', 'manager', 'bogus'] })).toEqual({
        type: 'role',
        roles: ['owner', 'manager'],
      });
      expect(normalizeRecipientConfig({ type: 'user', userId: 'u-1' })).toEqual({
        type: 'user',
        userId: 'u-1',
      });
      expect(normalizeRecipientConfig({ type: 'role', roles: [] })).toBeNull();
    });
  });

  describe('isInternalAudience', () => {
    it('detects audience flags, recipient config, and *_staff triggers', () => {
      expect(isInternalAudience({ action: { audience: 'internal' } })).toBe(true);
      expect(isInternalAudience({
        action: { recipient: { type: 'role', roles: ['owner'] } },
      })).toBe(true);
      expect(isInternalAudience({ rule: { triggerType: 'job_assigned_staff' } })).toBe(true);
      expect(isInternalAudience({
        action: { type: 'send_email_platform' },
        rule: { triggerType: 'payment_received' },
      })).toBe(false);
    });
  });

  describe('resolveStaffRecipients', () => {
    it('resolves assignee from trigger context and attaches Employee phone', async () => {
      User.findAll.mockResolvedValue([{ id: 'user-1', name: 'Kwame', email: 'kwame@example.com' }]);
      Employee.findAll.mockResolvedValue([{ userId: 'user-1', phone: '+233201111111' }]);

      const recipients = await resolveStaffRecipients({
        tenantId: 'tenant-1',
        recipient: { type: 'assignee' },
        triggerContext: { assigneeId: 'user-1' },
      });

      expect(recipients).toEqual([{
        userId: 'user-1',
        name: 'Kwame',
        email: 'kwame@example.com',
        phone: '+233201111111',
        role: null,
      }]);
      expect(UserTenant.findAll).not.toHaveBeenCalled();
    });

    it('resolves role recipients without falling back to customer contacts', async () => {
      UserTenant.findAll.mockResolvedValue([
        { userId: 'owner-1', role: 'owner' },
        { userId: 'mgr-1', role: 'manager' },
      ]);
      User.findAll.mockResolvedValue([
        { id: 'owner-1', name: 'Owner', email: 'owner@example.com' },
        { id: 'mgr-1', name: 'Manager', email: 'manager@example.com' },
      ]);
      Employee.findAll.mockResolvedValue([]);

      const recipients = await resolveStaffRecipients({
        tenantId: 'tenant-1',
        recipient: { type: 'role', roles: ['owner', 'manager'] },
        triggerContext: { email: 'customer@example.com', phone: '+233209999999' },
      });

      expect(recipients).toHaveLength(2);
      expect(recipients.map((r) => r.email).sort()).toEqual([
        'manager@example.com',
        'owner@example.com',
      ]);
      expect(recipients.every((r) => r.phone === null)).toBe(true);
    });

    it('returns empty list when assignee is missing', async () => {
      const recipients = await resolveStaffRecipients({
        tenantId: 'tenant-1',
        recipient: { type: 'assignee' },
        triggerContext: {},
      });
      expect(recipients).toEqual([]);
      expect(User.findAll).not.toHaveBeenCalled();
    });

    it('uses forceTestRecipient override for manual staff tests', async () => {
      User.findAll.mockResolvedValue([{ id: 'user-9', name: 'Ama', email: 'ama@example.com' }]);
      Employee.findAll.mockResolvedValue([{ userId: 'user-9', phone: '+233201112233' }]);

      const recipients = await resolveStaffRecipients({
        tenantId: 'tenant-1',
        recipient: { type: 'role', roles: ['owner', 'manager'] },
        triggerContext: {
          manualTest: true,
          forceTestRecipient: true,
          testRecipientUserId: 'user-9',
          email: 'ama-test@example.com',
          phone: '+233209998877',
          recipientName: 'Ama Test',
        },
      });

      expect(recipients).toEqual([
        {
          userId: 'user-9',
          name: 'Ama Test',
          email: 'ama-test@example.com',
          phone: '+233209998877',
          role: null,
        },
      ]);
      expect(UserTenant.findAll).not.toHaveBeenCalled();
    });

    it('allows manual email/phone override without a user id', async () => {
      const recipients = await resolveStaffRecipients({
        tenantId: 'tenant-1',
        recipient: { type: 'role', roles: ['owner'] },
        triggerContext: {
          test: true,
          forceTestRecipient: true,
          email: 'you@example.com',
          recipientName: 'You',
        },
      });

      expect(recipients).toEqual([
        { userId: null, name: 'You', email: 'you@example.com', phone: null },
      ]);
      expect(User.findAll).not.toHaveBeenCalled();
    });
  });
});
