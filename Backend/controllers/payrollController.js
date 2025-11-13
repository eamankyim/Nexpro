const { Op } = require('sequelize');
const dayjs = require('dayjs');
const {
  PayrollRun,
  PayrollEntry,
  Employee,
  Setting
} = require('../models');
const accountingService = require('../services/accountingService');
const { applyTenantFilter, sanitizePayload } = require('../utils/tenantUtils');

const getPayrollSettings = async (tenantId) => {
  const payrollSetting = await Setting.findOne({
    where: applyTenantFilter(tenantId, { key: 'payroll' })
  });
  return payrollSetting?.value || {
    incomeTaxRate: 0.15,
    ssnitEmployeeRate: 0.055,
    ssnitEmployerRate: 0.13,
    bonusTaxRate: 0.05,
    overtimeRate: 1.5
  };
};

const computeEmployeePayroll = (employee, settings) => {
  const salary = parseFloat(employee.salaryAmount || 0);
  const gross = salary;
  const incomeTax = parseFloat((gross * (settings.incomeTaxRate || 0)).toFixed(2));
  const ssnitEmployee = parseFloat((gross * (settings.ssnitEmployeeRate || 0)).toFixed(2));
  const ssnitEmployer = parseFloat((gross * (settings.ssnitEmployerRate || 0)).toFixed(2));

  const net = parseFloat((gross - incomeTax - ssnitEmployee).toFixed(2));

  return {
    gross,
    incomeTax,
    ssnitEmployee,
    ssnitEmployer,
    net,
    allowances: [],
    deductions: []
  };
};

exports.getPayrollRuns = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 20;
    const offset = (page - 1) * limit;

    const where = applyTenantFilter(req.tenantId, {});
    if (req.query.status && req.query.status !== 'all') {
      where.status = req.query.status;
    }

    const { count, rows } = await PayrollRun.findAndCountAll({
      where,
      limit,
      offset,
      order: [['payDate', 'DESC']],
      include: [
        {
          model: PayrollEntry,
          as: 'entries',
          where: applyTenantFilter(req.tenantId, {}),
          required: false
        }
      ]
    });

    res.status(200).json({
      success: true,
      count,
      pagination: {
        page,
        limit,
        totalPages: Math.ceil(count / limit)
      },
      data: rows
    });
  } catch (error) {
    next(error);
  }
};

exports.getPayrollRun = async (req, res, next) => {
  try {
    const run = await PayrollRun.findOne({
      where: applyTenantFilter(req.tenantId, { id: req.params.id }),
      include: [
        {
          model: PayrollEntry,
          as: 'entries',
          where: applyTenantFilter(req.tenantId, {}),
          required: false,
          include: [
            {
              model: Employee,
              as: 'employee',
              where: applyTenantFilter(req.tenantId, {}),
              required: false
            }
          ],
          order: [['createdAt', 'DESC']]
        }
      ]
    });

    if (!run) {
      return res.status(404).json({ success: false, message: 'Payroll run not found' });
    }

    res.status(200).json({ success: true, data: run });
  } catch (error) {
    next(error);
  }
};

exports.createPayrollRun = async (req, res, next) => {
  try {
    const {
      periodStart,
      periodEnd,
      payDate,
      employeeIds = [],
      notes = null
    } = sanitizePayload(req.body || {});

    if (!periodStart || !periodEnd || !payDate) {
      return res.status(400).json({ success: false, message: 'periodStart, periodEnd and payDate are required' });
    }

    const employeeWhere = applyTenantFilter(req.tenantId, {
      status: { [Op.ne]: 'terminated' },
      isActive: true
    });
    if (employeeIds.length) {
      employeeWhere.id = { [Op.in]: employeeIds };
    }

    const employees = await Employee.findAll({ where: employeeWhere });
    if (!employees.length) {
      return res.status(400).json({ success: false, message: 'No employees found for this run' });
    }

    const settings = await getPayrollSettings(req.tenantId);

    let totalGross = 0;
    let totalNet = 0;
    let totalTax = 0;
    let totalEmployerContribution = 0;

    const entriesPayload = [];

    employees.forEach((employee) => {
      const payroll = computeEmployeePayroll(employee, settings);
      totalGross += payroll.gross;
      totalNet += payroll.net;
      totalTax += payroll.incomeTax + payroll.ssnitEmployee;
      totalEmployerContribution += payroll.ssnitEmployer;

      entriesPayload.push({
        employeeId: employee.id,
        grossPay: payroll.gross,
        netPay: payroll.net,
        allowances: payroll.allowances,
        deductions: payroll.deductions,
        taxes: [
          { type: 'income_tax', label: 'PAYE', amount: payroll.incomeTax },
          { type: 'ssnit_employee', label: 'SSNIT Employee', amount: payroll.ssnitEmployee },
          { type: 'ssnit_employer', label: 'SSNIT Employer', amount: payroll.ssnitEmployer }
        ],
        metadata: {
          employee: {
            firstName: employee.firstName,
            lastName: employee.lastName,
            jobTitle: employee.jobTitle
          }
        }
      });
    });

    const run = await PayrollRun.create({
      periodStart,
      periodEnd,
      payDate,
      status: 'draft',
      totalGross,
      totalNet,
      totalTax,
      totalEmployees: employees.length,
      notes: notes || null,
      metadata: { settingsUsed: settings },
      tenantId: req.tenantId
    });

    const entries = entriesPayload.map((entry) => ({
      ...entry,
      payrollRunId: run.id,
      tenantId: req.tenantId
    }));

    await PayrollEntry.bulkCreate(entries);

    const createdRun = await PayrollRun.findOne({
      where: applyTenantFilter(req.tenantId, { id: run.id }),
      include: [
        {
          model: PayrollEntry,
          as: 'entries',
          where: applyTenantFilter(req.tenantId, {}),
          required: false,
          include: [{ model: Employee, as: 'employee', where: applyTenantFilter(req.tenantId, {}), required: false }]
        }
      ]
    });

    res.status(201).json({ success: true, data: createdRun });
  } catch (error) {
    next(error);
  }
};

exports.postPayrollRun = async (req, res, next) => {
  try {
    const run = await PayrollRun.findOne({
      where: applyTenantFilter(req.tenantId, { id: req.params.id }),
      include: [
        {
          model: PayrollEntry,
          as: 'entries',
          include: [{ model: Employee, as: 'employee' }]
        }
      ]
    });

    if (!run) {
      return res.status(404).json({ success: false, message: 'Payroll run not found' });
    }

    if (run.status === 'posted') {
      return res.status(400).json({ success: false, message: 'Payroll run already posted' });
    }

    const totalGross = run.entries.reduce((sum, entry) => sum + parseFloat(entry.grossPay || 0), 0);
    const totalNet = run.entries.reduce((sum, entry) => sum + parseFloat(entry.netPay || 0), 0);
    const totalIncomeTax = run.entries.reduce(
      (sum, entry) =>
        sum +
        entry.taxes
          .filter((tax) => tax.type === 'income_tax')
          .reduce((acc, tax) => acc + parseFloat(tax.amount || 0), 0),
      0
    );
    const totalEmployeeSSNIT = run.entries.reduce(
      (sum, entry) =>
        sum +
        entry.taxes
          .filter((tax) => tax.type === 'ssnit_employee')
          .reduce((acc, tax) => acc + parseFloat(tax.amount || 0), 0),
      0
    );
    const totalEmployerSSNIT = run.entries.reduce(
      (sum, entry) =>
        sum +
        entry.taxes
          .filter((tax) => tax.type === 'ssnit_employer')
          .reduce((acc, tax) => acc + parseFloat(tax.amount || 0), 0),
      0
    );

    const salaryAccount = await accountingService.getAccountByCode(req.tenantId, '5000');
    const employerExpenseAccount = await accountingService.getAccountByCode(req.tenantId, '5100');
    const payrollPayableAccount = await accountingService.getAccountByCode(req.tenantId, '2000');
    const taxPayableAccount = await accountingService.getAccountByCode(req.tenantId, '2100');
    const employerContributionPayableAccount = await accountingService.getAccountByCode(req.tenantId, '2200');

    if (!salaryAccount || !payrollPayableAccount || !taxPayableAccount || !employerExpenseAccount || !employerContributionPayableAccount) {
      return res.status(400).json({ success: false, message: 'Required accounts are missing. Ensure default chart of accounts is seeded.' });
    }

    const journal = await accountingService.createJournalEntry({
      tenantId: req.tenantId,
      reference: `PR-${dayjs(run.payDate).format('YYYYMMDD')}-${run.id.slice(0, 6)}`,
      description: `Payroll for ${dayjs(run.periodStart).format('MMM DD')} - ${dayjs(run.periodEnd).format('MMM DD, YYYY')}`,
      entryDate: run.payDate,
      status: 'posted',
      source: 'payroll',
      sourceId: run.id,
      userId: req.user?.id || null,
      lines: [
        {
          accountId: salaryAccount.id,
          debit: totalGross,
          credit: 0,
          description: 'Payroll gross salaries'
        },
        {
          accountId: employerExpenseAccount.id,
          debit: totalEmployerSSNIT,
          credit: 0,
          description: 'Employer SSNIT contributions'
        },
        {
          accountId: payrollPayableAccount.id,
          debit: 0,
          credit: totalNet,
          description: 'Net pay payable to employees'
        },
        {
          accountId: taxPayableAccount.id,
          debit: 0,
          credit: totalIncomeTax + totalEmployeeSSNIT,
          description: 'PAYE and employee SSNIT contributions'
        },
        {
          accountId: employerContributionPayableAccount.id,
          debit: 0,
          credit: totalEmployerSSNIT,
          description: 'Employer SSNIT contributions payable'
        }
      ]
    });

    await run.update({
      status: 'posted',
      journalEntryId: journal.id
    });

    const updatedRun = await PayrollRun.findOne({
      where: applyTenantFilter(req.tenantId, { id: run.id }),
      include: [
        {
          model: PayrollEntry,
          as: 'entries',
          where: applyTenantFilter(req.tenantId, {}),
          required: false,
          include: [{ model: Employee, as: 'employee', where: applyTenantFilter(req.tenantId, {}), required: false }]
        }
      ]
    });

    res.status(200).json({ success: true, data: updatedRun });
  } catch (error) {
    next(error);
  }
};

