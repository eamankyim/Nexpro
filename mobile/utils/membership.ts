/**
 * Normalize membership rows from login or GET /auth/me (Sequelize may nest fields under dataValues).
 */

export type MembershipLike = {
  tenantId?: string;
  tenant_id?: string;
  isDefault?: boolean;
  invitedBy?: string | null;
  tenant?: { id?: string; tenantId?: string; [key: string]: unknown };
  dataValues?: {
    tenantId?: string;
    tenant_id?: string;
    isDefault?: boolean;
    invitedBy?: string | null;
    tenant?: { id?: string; [key: string]: unknown };
    [key: string]: unknown;
  };
  [key: string]: unknown;
};

/** Tenant id from a membership row — mirrors web authService.membershipTenantId. */
export function membershipTenantId(m: MembershipLike | null | undefined): string | null {
  if (!m || typeof m !== 'object') return null;

  const direct = m.tenantId ?? m.tenant_id;
  if (direct != null && direct !== '') return String(direct);

  const fromDataValues = m.dataValues?.tenantId ?? m.dataValues?.tenant_id;
  if (fromDataValues != null && fromDataValues !== '') return String(fromDataValues);

  const nested = m.tenant ?? m.dataValues?.tenant;
  if (nested && typeof nested === 'object') {
    const tid = nested.id ?? (nested as { tenantId?: string }).tenantId;
    if (tid != null && tid !== '') return String(tid);
  }

  return null;
}

/** Flatten Sequelize-shaped membership for storage and in-memory use. */
export function normalizeMembership(raw: MembershipLike): MembershipLike {
  if (!raw || typeof raw !== 'object') return raw;

  const base =
    raw.dataValues && typeof raw.dataValues === 'object'
      ? { ...raw.dataValues }
      : { ...raw };

  const tenantId = membershipTenantId(raw);
  if (tenantId) base.tenantId = tenantId;

  const tenantSource = (base.tenant as MembershipLike['tenant']) ?? raw.tenant ?? raw.dataValues?.tenant;
  if (tenantSource && typeof tenantSource === 'object') {
    const tenant =
      (tenantSource as { dataValues?: Record<string, unknown> }).dataValues &&
      typeof (tenantSource as { dataValues?: Record<string, unknown> }).dataValues === 'object'
        ? { ...(tenantSource as { dataValues: Record<string, unknown> }).dataValues }
        : { ...tenantSource };
    if (tenantId && !tenant.id) tenant.id = tenantId;
    base.tenant = tenant;
  }

  delete base.dataValues;
  return base;
}

export function normalizeMemberships(list: MembershipLike[] | null | undefined): MembershipLike[] {
  if (!Array.isArray(list)) return [];
  return list.map((m) => normalizeMembership(m));
}
