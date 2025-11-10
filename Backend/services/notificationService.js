const { Notification } = require('../models');

const createNotification = async ({
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
  if (!userId || !title) {
    return null;
  }

  return Notification.create(
    {
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
};

const notifyUsers = async (userIds, payload = {}) => {
  if (!userIds || userIds.length === 0) {
    return [];
  }

  const uniqueUserIds = [...new Set(userIds.filter(Boolean))];
  if (uniqueUserIds.length === 0) {
    return [];
  }

  const notifications = uniqueUserIds.map((userId) => ({
    ...payload,
    userId,
    title: payload.title || 'Notification',
    type: payload.type || 'info',
    priority: payload.priority || 'normal',
    channels: payload.channels || ['in_app']
  }));

  return Notification.bulkCreate(notifications);
};

const formatJobTitle = (job) => {
  if (!job) return 'Job update';
  return `${job.jobNumber || job.title || 'Job'}${job.title ? ` • ${job.title}` : ''}`;
};

const notifyJobAssigned = async ({ job, triggeredBy = null }) => {
  if (!job || !job.assignedTo) {
    return null;
  }

  const jobTitle = formatJobTitle(job);
  const link = `/jobs/${job.id}`;

  return createNotification({
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
  });
};

const notifyJobStatusChanged = async ({ job, oldStatus, newStatus, triggeredBy = null }) => {
  if (!job || !newStatus || oldStatus === newStatus) {
    return [];
  }

  const recipientSet = new Set();
  if (job.assignedTo) recipientSet.add(job.assignedTo);
  if (job.createdBy) recipientSet.add(job.createdBy);
  if (triggeredBy) recipientSet.add(triggeredBy);

  const recipients = Array.from(recipientSet).filter(Boolean);
  if (recipients.length === 0) {
    return [];
  }

  const jobTitle = formatJobTitle(job);
  const link = `/jobs/${job.id}`;

  return notifyUsers(recipients, {
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
  });
};

const notifyLeadStatusChanged = async ({ lead, oldStatus, newStatus, triggeredBy = null }) => {
  if (!lead || !newStatus || oldStatus === newStatus) {
    return [];
  }

  const recipientSet = new Set();
  if (lead.assignedTo) recipientSet.add(lead.assignedTo);
  if (triggeredBy && triggeredBy !== lead.assignedTo) recipientSet.add(triggeredBy);

  const recipients = Array.from(recipientSet).filter(Boolean);
  if (recipients.length === 0) {
    return [];
  }

  const link = `/leads/${lead.id}`;

  return notifyUsers(recipients, {
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
  });
};

const notifyLeadActivityLogged = async ({ lead, activity, triggeredBy = null }) => {
  if (!lead || !activity) {
    return [];
  }

  const recipientSet = new Set();
  if (lead.assignedTo) recipientSet.add(lead.assignedTo);
  if (triggeredBy && triggeredBy !== lead.assignedTo) recipientSet.add(triggeredBy);

  const recipients = Array.from(recipientSet).filter(Boolean);
  if (recipients.length === 0) {
    return [];
  }

  const link = `/leads/${lead.id}`;

  return notifyUsers(recipients, {
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
  });
};

module.exports = {
  createNotification,
  notifyUsers,
  notifyJobAssigned,
  notifyJobStatusChanged,
  notifyLeadStatusChanged,
  notifyLeadActivityLogged
};


