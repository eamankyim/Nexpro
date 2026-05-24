const {
  getCreateApprovalDefaults,
  stripCreateApprovalFields
} = require('../../../utils/expenseApprovalDefaults');

describe('Expense Approval Defaults', () => {
  it('defaults normal expense creation to approved', () => {
    const result = getCreateApprovalDefaults({}, 'user-123');

    expect(result.isExpenseRequest).toBe(false);
    expect(result.approvalStatus).toBe('approved');
    expect(result.approvedBy).toBe('user-123');
    expect(result.approvedAt).toBeInstanceOf(Date);
  });

  it('keeps expense request creation pending approval', () => {
    const result = getCreateApprovalDefaults({ approvalStatus: 'pending_approval' }, 'user-123');

    expect(result.isExpenseRequest).toBe(true);
    expect(result.approvalStatus).toBe('pending_approval');
    expect(result.approvedBy).toBeNull();
    expect(result.approvedAt).toBeNull();
  });

  it('strips client-controlled approval audit fields before create', () => {
    const payload = {
      approvalStatus: 'rejected',
      approvedBy: 'other-user',
      approvedAt: new Date(),
      category: 'Supplies'
    };

    stripCreateApprovalFields(payload);

    expect(payload).toEqual({ category: 'Supplies' });
  });
});
