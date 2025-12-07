const { Notification } = require('../models');

const logPrefix = '[Notifications]';

const createNotification = async ({
  tenantId,
  userId,
  title,
  message,
  type = 'info',
  priority = 'normal',
  metadata = {},
  channels = ['in_app'],
  icon = null,
  link = null,
  triggeredBy = null,
  transaction = null
}) => {
  if (!tenantId || !userId || !title) {
    console.warn(`${logPrefix} Skipping notification creation: missing tenantId, userId or title`, {
      tenantId,
      userId,
      title
    });
    return null;
  }

  try {
    const notification = await Notification.create(
      {
        tenantId,
        userId,
        title,
        message,
        type,
        priority,
        metadata,
        channels,
        icon,
        link,
        triggeredBy
      },
      { transaction }
    );

    console.log(`${logPrefix} Created notification`, {
      id: notification.id,
      userId,
      title,
      type
    });

    return notification;
  } catch (error) {
    console.error(`${logPrefix} Failed to create notification`, {
      userId,
      title,
      error: error.message
    });
    throw error;
  }
};

const notifyUsers = async ({ tenantId, userIds, payload = {}, transaction = null }) => {
  if (!tenantId) {
    console.warn(`${logPrefix} notifyUsers missing tenantId`, { userIds });
    return [];
  }

  if (!userIds || userIds.length === 0) {
    console.warn(`${logPrefix} notifyUsers called with empty userIds`);
    return [];
  }

  const uniqueUserIds = [...new Set(userIds.filter(Boolean))];
  if (uniqueUserIds.length === 0) {
    console.warn(`${logPrefix} notifyUsers filtered userIds to zero`, { userIds });
    return [];
  }

  const notifications = uniqueUserIds.map((userId) => ({
    ...payload,
    tenantId,
    userId,
    title: payload.title || 'Notification',
    type: payload.type || 'info',
    priority: payload.priority || 'normal',
    channels: payload.channels || ['in_app']
  }));

  try {
    const created = await Notification.bulkCreate(notifications, { transaction });
    console.log(`${logPrefix} bulkCreate`, {
      count: created.length,
      userIds: uniqueUserIds,
      title: payload.title
    });
    return created;
  } catch (error) {
    console.error(`${logPrefix} Failed bulkCreate`, {
      userIds: uniqueUserIds,
      title: payload.title,
      error: error.message
    });
    throw error;
  }
};

const formatJobTitle = (job) => {
  if (!job) return 'Job update';
  return `${job.jobNumber || job.title || 'Job'}${job.title ? ` • ${job.title}` : ''}`;
};

const notifyJobAssigned = async ({ job, triggeredBy = null }) => {
  if (!job || !job.assignedTo) {
    console.warn(`${logPrefix} notifyJobAssigned skipped`, {
      jobId: job?.id,
      hasAssignedTo: Boolean(job?.assignedTo)
    });
    return null;
  }

  const tenantId = job.tenantId;
  if (!tenantId) {
    console.warn(`${logPrefix} notifyJobAssigned missing tenantId`, {
      jobId: job.id
    });
    return null;
  }

  const jobTitle = formatJobTitle(job);
  const link = `/jobs/${job.id}`;

  const payload = {
    userId: job.assignedTo,
    title: 'New Job Assigned',
    message: `You have been assigned to ${jobTitle}.`,
    type: 'job',
    priority: 'high',
    metadata: {
      jobId: job.id,
      jobNumber: job.jobNumber,
      status: job.status
    },
    icon: 'team',
    link,
    triggeredBy
  };

  console.log(`${logPrefix} notifyJobAssigned`, {
    jobId: job.id,
    assignedTo: job.assignedTo,
    triggeredBy
  });

  return createNotification({
    tenantId,
    ...payload
  });
};

const notifyJobStatusChanged = async ({ job, oldStatus, newStatus, triggeredBy = null }) => {
  if (!job || !newStatus || oldStatus === newStatus) {
    console.warn(`${logPrefix} notifyJobStatusChanged skipped`, {
      jobId: job?.id,
      oldStatus,
      newStatus
    });
    return [];
  }

  const recipientSet = new Set();
  if (job.assignedTo) recipientSet.add(job.assignedTo);
  if (job.createdBy) recipientSet.add(job.createdBy);
  if (triggeredBy) recipientSet.add(triggeredBy);

  const recipients = Array.from(recipientSet).filter(Boolean);
  if (recipients.length === 0) {
    console.warn(`${logPrefix} notifyJobStatusChanged no recipients`, {
      jobId: job.id,
      oldStatus,
      newStatus
    });
    return [];
  }

  const tenantId = job.tenantId;
  if (!tenantId) {
    console.warn(`${logPrefix} notifyJobStatusChanged missing tenantId`, {
      jobId: job.id
    });
    return [];
  }

  const jobTitle = formatJobTitle(job);
  const link = `/jobs/${job.id}`;

  const payload = {
    title: 'Job Status Updated',
    message: `${jobTitle} moved from ${oldStatus?.replace('_', ' ')} to ${newStatus.replace('_', ' ')}.`,
    type: 'job',
    priority: 'normal',
    metadata: {
      jobId: job.id,
      jobNumber: job.jobNumber,
      oldStatus,
      newStatus
    },
    icon: 'swap',
    link,
    triggeredBy
  };

  console.log(`${logPrefix} notifyJobStatusChanged`, {
    jobId: job.id,
    recipients,
    oldStatus,
    newStatus,
    triggeredBy
  });

  return notifyUsers({
    tenantId,
    userIds: recipients,
    payload
  });
};

const notifyLeadCreated = async ({ lead, triggeredBy = null }) => {
  if (!lead) {
    console.warn(`${logPrefix} notifyLeadCreated skipped`, {
      leadId: lead?.id
    });
    return null;
  }

  if (!lead.assignedTo) {
    console.warn(`${logPrefix} notifyLeadCreated no assignee`, {
      leadId: lead.id
    });
    return null;
  }

  const tenantId = lead.tenantId;
  if (!tenantId) {
    console.warn(`${logPrefix} notifyLeadCreated missing tenantId`, {
      leadId: lead.id
    });
    return null;
  }

  const payload = {
    userId: lead.assignedTo,
    title: 'New Lead Assigned',
    message: `${lead.name || lead.company || 'A new lead'} has been assigned to you.`,
    type: 'lead',
    priority: 'high',
    metadata: {
      leadId: lead.id,
      status: lead.status,
      priority: lead.priority
    },
    icon: 'user-add',
    link: `/leads/${lead.id}`,
    triggeredBy
  };

  console.log(`${logPrefix} notifyLeadCreated`, {
    leadId: lead.id,
    assignedTo: lead.assignedTo,
    triggeredBy
  });

  return createNotification({
    tenantId,
    ...payload
  });
};

const notifyLeadStatusChanged = async ({ lead, oldStatus, newStatus, triggeredBy = null }) => {
  if (!lead || !newStatus || oldStatus === newStatus) {
    console.warn(`${logPrefix} notifyLeadStatusChanged skipped`, {
      leadId: lead?.id,
      oldStatus,
      newStatus
    });
    return [];
  }

  const recipientSet = new Set();
  if (lead.assignedTo) recipientSet.add(lead.assignedTo);
  if (triggeredBy && triggeredBy !== lead.assignedTo) recipientSet.add(triggeredBy);

  const recipients = Array.from(recipientSet).filter(Boolean);
  if (recipients.length === 0) {
    console.warn(`${logPrefix} notifyLeadStatusChanged no recipients`, {
      leadId: lead.id,
      oldStatus,
      newStatus
    });
    return [];
  }

  const tenantId = lead.tenantId;
  if (!tenantId) {
    console.warn(`${logPrefix} notifyLeadStatusChanged missing tenantId`, {
      leadId: lead.id
    });
    return [];
  }

  const link = `/leads/${lead.id}`;

  const payload = {
    title: 'Lead Status Updated',
    message: `${lead.name || lead.company || 'Lead'} moved from ${oldStatus?.replace('_', ' ')} to ${newStatus.replace('_', ' ')}.`,
    type: 'lead',
    priority: 'normal',
    metadata: {
      leadId: lead.id,
      oldStatus,
      newStatus
    },
    icon: 'flag',
    link,
    triggeredBy
  };

  console.log(`${logPrefix} notifyLeadStatusChanged`, {
    leadId: lead.id,
    recipients,
    oldStatus,
    newStatus,
    triggeredBy
  });

  return notifyUsers({
    tenantId,
    userIds: recipients,
    payload
  });
};

const notifyLeadActivityLogged = async ({ lead, activity, triggeredBy = null }) => {
  if (!lead || !activity) {
    console.warn(`${logPrefix} notifyLeadActivityLogged skipped`, {
      leadId: lead?.id,
      hasActivity: Boolean(activity)
    });
    return [];
  }

  const recipientSet = new Set();
  if (lead.assignedTo) recipientSet.add(lead.assignedTo);
  if (triggeredBy && triggeredBy !== lead.assignedTo) recipientSet.add(triggeredBy);

  const recipients = Array.from(recipientSet).filter(Boolean);
  if (recipients.length === 0) {
    console.warn(`${logPrefix} notifyLeadActivityLogged no recipients`, {
      leadId: lead.id,
      activityId: activity.id
    });
    return [];
  }

  const tenantId = lead.tenantId;
  if (!tenantId) {
    console.warn(`${logPrefix} notifyLeadActivityLogged missing tenantId`, {
      leadId: lead.id,
      activityId: activity?.id
    });
    return [];
  }

  const link = `/leads/${lead.id}`;

  const payload = {
    title: 'New Lead Activity',
    message: `${lead.name || lead.company || 'Lead'} has a new ${activity.type || 'activity'} logged.`,
    type: 'lead',
    priority: 'normal',
    metadata: {
      leadId: lead.id,
      activityId: activity.id,
      activityType: activity.type
    },
    icon: 'message',
    link,
    triggeredBy
  };

  console.log(`${logPrefix} notifyLeadActivityLogged`, {
    leadId: lead.id,
    activityId: activity.id,
    recipients,
    triggeredBy
  });

  return notifyUsers({
    tenantId,
    userIds: recipients,
    payload
  });
};

const notifyInvoiceSent = async ({ invoice, triggeredBy = null }) => {
  console.log(`${logPrefix} notifyInvoiceSent called`, {
    invoiceId: invoice?.id,
    invoiceNumber: invoice?.invoiceNumber,
    hasInvoice: !!invoice,
    hasJob: !!invoice?.job,
    jobId: invoice?.job?.id,
    jobCreatedBy: invoice?.job?.createdBy,
    jobAssignedTo: invoice?.job?.assignedTo
  });

  if (!invoice) {
    console.warn(`${logPrefix} notifyInvoiceSent skipped - no invoice`, {
      invoiceId: invoice?.id
    });
    return [];
  }

  const tenantId = invoice.tenantId;
  if (!tenantId) {
    console.warn(`${logPrefix} notifyInvoiceSent missing tenantId`, {
      invoiceId: invoice.id
    });
    return [];
  }

  // For financial notifications, notify ALL managers and admins in the tenant
  const { User, UserTenant } = require('../models');
  
  const recipientSet = new Set();
  
  // Add job team members
  if (invoice.job) {
    console.log(`${logPrefix} notifyInvoiceSent - processing job`, {
      jobId: invoice.job.id,
      createdBy: invoice.job.createdBy,
      assignedTo: invoice.job.assignedTo
    });
    if (invoice.job.createdBy) recipientSet.add(invoice.job.createdBy);
    if (invoice.job.assignedTo) recipientSet.add(invoice.job.assignedTo);
  }
  
  // Add ALL managers and admins in the tenant for financial visibility
  try {
    const managerUsers = await UserTenant.findAll({
      where: {
        tenantId,
        role: { [require('sequelize').Op.in]: ['admin', 'manager'] }
      },
      attributes: ['userId']
    });
    
    console.log(`${logPrefix} notifyInvoiceSent - found managers/admins`, {
      count: managerUsers.length,
      userIds: managerUsers.map(u => u.userId)
    });
    
    managerUsers.forEach(ut => {
      if (ut.userId) recipientSet.add(ut.userId);
    });
  } catch (error) {
    console.error(`${logPrefix} notifyInvoiceSent - failed to fetch managers`, error.message);
  }

  const recipients = Array.from(recipientSet).filter(Boolean);
  console.log(`${logPrefix} notifyInvoiceSent recipients determined`, {
    invoiceId: invoice.id,
    recipientCount: recipients.length,
    recipients: recipients
  });

  if (recipients.length === 0) {
    console.warn(`${logPrefix} notifyInvoiceSent no recipients - NOTIFICATION WILL NOT BE SENT!`, {
      invoiceId: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      hasJob: !!invoice.job,
      jobId: invoice.jobId
    });
    return [];
  }

  const link = `/invoices`;

  const payload = {
    title: 'Invoice Sent',
    message: `Invoice ${invoice.invoiceNumber} for ${invoice.customer?.company || invoice.customer?.name || 'customer'} has been sent (GHS ${parseFloat(invoice.totalAmount).toLocaleString()}).`,
    type: 'invoice',
    priority: 'normal',
    metadata: {
      invoiceId: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      customerId: invoice.customerId,
      totalAmount: invoice.totalAmount
    },
    icon: 'mail',
    link,
    triggeredBy
  };

  console.log(`${logPrefix} notifyInvoiceSent`, {
    invoiceId: invoice.id,
    invoiceNumber: invoice.invoiceNumber,
    recipients,
    triggeredBy
  });

  return notifyUsers({
    tenantId,
    userIds: recipients,
    payload
  });
};

const notifyInvoicePaid = async ({ invoice, triggeredBy = null }) => {
  console.log(`${logPrefix} notifyInvoicePaid called`, {
    invoiceId: invoice?.id,
    invoiceNumber: invoice?.invoiceNumber,
    hasInvoice: !!invoice,
    hasJob: !!invoice?.job,
    jobId: invoice?.job?.id,
    jobCreatedBy: invoice?.job?.createdBy,
    jobAssignedTo: invoice?.job?.assignedTo
  });

  if (!invoice) {
    console.warn(`${logPrefix} notifyInvoicePaid skipped - no invoice`, {
      invoiceId: invoice?.id
    });
    return [];
  }

  const tenantId = invoice.tenantId;
  if (!tenantId) {
    console.warn(`${logPrefix} notifyInvoicePaid missing tenantId`, {
      invoiceId: invoice.id
    });
    return [];
  }

  // For financial notifications, notify ALL managers and admins in the tenant
  const { User, UserTenant } = require('../models');
  
  const recipientSet = new Set();
  
  // Add job team members
  if (invoice.job) {
    console.log(`${logPrefix} notifyInvoicePaid - processing job`, {
      jobId: invoice.job.id,
      createdBy: invoice.job.createdBy,
      assignedTo: invoice.job.assignedTo
    });
    if (invoice.job.createdBy) recipientSet.add(invoice.job.createdBy);
    if (invoice.job.assignedTo) recipientSet.add(invoice.job.assignedTo);
  }
  
  // Add ALL managers and admins in the tenant for financial visibility
  try {
    const managerUsers = await UserTenant.findAll({
      where: {
        tenantId,
        role: { [require('sequelize').Op.in]: ['admin', 'manager'] }
      },
      attributes: ['userId']
    });
    
    console.log(`${logPrefix} notifyInvoicePaid - found managers/admins`, {
      count: managerUsers.length,
      userIds: managerUsers.map(u => u.userId)
    });
    
    managerUsers.forEach(ut => {
      if (ut.userId) recipientSet.add(ut.userId);
    });
  } catch (error) {
    console.error(`${logPrefix} notifyInvoicePaid - failed to fetch managers`, error.message);
  }

  const recipients = Array.from(recipientSet).filter(Boolean);
  console.log(`${logPrefix} notifyInvoicePaid recipients determined`, {
    invoiceId: invoice.id,
    recipientCount: recipients.length,
    recipients: recipients
  });

  if (recipients.length === 0) {
    console.warn(`${logPrefix} notifyInvoicePaid no recipients - NOTIFICATION WILL NOT BE SENT!`, {
      invoiceId: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      hasJob: !!invoice.job,
      jobId: invoice.jobId
    });
    return [];
  }

  const link = `/invoices`;

  const payload = {
    title: 'Payment Received',
    message: `Invoice ${invoice.invoiceNumber} for ${invoice.customer?.company || invoice.customer?.name || 'customer'} has been paid (GHS ${parseFloat(invoice.amountPaid).toLocaleString()}).`,
    type: 'payment',
    priority: 'high',
    metadata: {
      invoiceId: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      customerId: invoice.customerId,
      amountPaid: invoice.amountPaid,
      totalAmount: invoice.totalAmount
    },
    icon: 'dollar',
    link,
    triggeredBy
  };

  console.log(`${logPrefix} notifyInvoicePaid`, {
    invoiceId: invoice.id,
    invoiceNumber: invoice.invoiceNumber,
    recipients,
    triggeredBy
  });

  return notifyUsers({
    tenantId,
    userIds: recipients,
    payload
  });
};

module.exports = {
  createNotification,
  notifyUsers,
  notifyJobAssigned,
  notifyJobStatusChanged,
  notifyLeadCreated,
  notifyLeadStatusChanged,
  notifyLeadActivityLogged,
  notifyInvoiceSent,
  notifyInvoicePaid
};


