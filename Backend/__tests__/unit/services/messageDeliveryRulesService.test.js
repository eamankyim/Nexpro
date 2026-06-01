jest.mock('../../../models', () => ({
  Setting: {
    findOne: jest.fn(),
    findOrCreate: jest.fn(),
  },
}));

const { Setting } = require('../../../models');
const {
  mergeDeliveryRules,
  isChannelEnabledForEvent,
  saveDeliveryRules,
  buildDefaultChannelsForEvent,
} = require('../../../services/messageDeliveryRulesService');
const { MESSAGE_EVENTS_CATALOG } = require('../../../config/messageEventsCatalog');

describe('messageDeliveryRulesService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('mergeDeliveryRules', () => {
    it('uses catalog defaults when no stored value', () => {
      const merged = mergeDeliveryRules(null);
      expect(merged.events.invoice_sent.channels.email).toBe(true);
      expect(merged.events.invoice_sent.channels.whatsapp).toBe(true);
      expect(merged.events.team_invite.channels.email).toBe(true);
      expect(merged.events.team_invite.channels.sms).toBe(false);
    });

    it('applies tenant overrides for allowed channels', () => {
      const merged = mergeDeliveryRules({
        events: {
          sales_receipt: { channels: { email: false, sms: true, whatsapp: false } },
        },
      });
      expect(merged.events.sales_receipt.channels.email).toBe(false);
      expect(merged.events.sales_receipt.channels.sms).toBe(true);
      expect(merged.events.sales_receipt.channels.whatsapp).toBe(false);
    });

    it('keeps required channels enabled even when tenant disables them', () => {
      const merged = mergeDeliveryRules({
        events: {
          team_invite: { channels: { email: false } },
          password_reset: { channels: { email: false } },
          otp: { channels: { email: false } },
        },
      });
      expect(merged.events.team_invite.channels.email).toBe(true);
      expect(merged.events.password_reset.channels.email).toBe(true);
      expect(merged.events.otp.channels.email).toBe(true);
    });

    it('ignores overrides for disallowed channels', () => {
      const merged = mergeDeliveryRules({
        events: {
          password_reset: { channels: { sms: true, whatsapp: true } },
        },
      });
      expect(merged.events.password_reset.channels.sms).toBe(false);
      expect(merged.events.password_reset.channels.whatsapp).toBe(false);
    });
  });

  describe('isChannelEnabledForEvent', () => {
    it('returns false when tenant disabled channel', async () => {
      Setting.findOne.mockResolvedValue({
        value: {
          events: {
            invoice_sent: { channels: { email: false, sms: true, whatsapp: true } },
          },
        },
      });
      const enabled = await isChannelEnabledForEvent('tenant-1', 'invoice_sent', 'email');
      expect(enabled).toBe(false);
    });

    it('returns true for unknown events (do not block sends)', async () => {
      const enabled = await isChannelEnabledForEvent('tenant-1', 'not_a_real_event', 'email');
      expect(enabled).toBe(true);
      expect(Setting.findOne).not.toHaveBeenCalled();
    });
  });

  describe('saveDeliveryRules', () => {
    it('persists merged rules and enforces required channels', async () => {
      const save = jest.fn();
      const settingMock = { value: {}, description: null, save };
      Setting.findOne.mockResolvedValue(null);
      Setting.findOrCreate.mockResolvedValue([settingMock, true]);

      await saveDeliveryRules('tenant-1', {
        events: {
          team_invite: { channels: { email: false } },
        },
      });

      expect(save).toHaveBeenCalled();
      expect(settingMock.value.events.team_invite.channels.email).toBe(true);
    });
  });

  describe('buildDefaultChannelsForEvent', () => {
    it('defaults job_completed to WhatsApp only', () => {
      const channels = buildDefaultChannelsForEvent(MESSAGE_EVENTS_CATALOG.job_completed);
      expect(channels.whatsapp).toBe(true);
      expect(channels.email).toBe(false);
      expect(channels.sms).toBe(false);
    });
  });
});
