const REQUEST_APPROVAL_STATUS = 'pending_approval';
const APPROVED_STATUS = 'approved';

const isApprovalRequestPayload = (payload = {}) => payload.approvalStatus === REQUEST_APPROVAL_STATUS;

const getCreateApprovalDefaults = (payload = {}, userId) => {
  const isExpenseRequest = isApprovalRequestPayload(payload);

  return {
    isExpenseRequest,
    approvalStatus: isExpenseRequest ? REQUEST_APPROVAL_STATUS : APPROVED_STATUS,
    approvedBy: isExpenseRequest ? null : userId,
    approvedAt: isExpenseRequest ? null : new Date()
  };
};

const stripCreateApprovalFields = (payload = {}) => {
  delete payload.approvalStatus;
  delete payload.approvedBy;
  delete payload.approvedAt;
};

module.exports = {
  getCreateApprovalDefaults,
  stripCreateApprovalFields
};
