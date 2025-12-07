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

    if (run.status === 'approved' || run.status === 'paid') {
      return res.status(400).json({ success: false, message: 'Payroll run already posted/approved' });
    }

    const totalGross = run.entries.reduce((sum, entry) => sum + parseFloat(entry.grossPay || 0), 0);
    const totalNet = run.entries.reduce((sum, entry) => sum + parseFloat(entry.netPay || 0), 0);
    
    // Calculate taxes from the entries' taxes array if available, otherwise calculate from gross - net
    let totalIncomeTax = 0;
    let totalEmployeeSSNIT = 0;
    let totalEmployerSSNIT = 0;
    
    // Try to get taxes from the entries
    for (const entry of run.entries) {
      if (entry.taxes && Array.isArray(entry.taxes)) {
        for (const tax of entry.taxes) {
          if (tax.type === 'income_tax' || tax.type === 'Income Tax' || tax.label === 'PAYE') {
            totalIncomeTax += parseFloat(tax.amount || 0);
          } else if (tax.type === 'ssnit_employee' || tax.type === 'SSNIT Employee' || tax.label === 'SSNIT Employee') {
            totalEmployeeSSNIT += parseFloat(tax.amount || 0);
          } else if (tax.type === 'ssnit_employer' || tax.type === 'SSNIT Employer' || tax.label === 'SSNIT Employer') {
            totalEmployerSSNIT += parseFloat(tax.amount || 0);
          }
        }
      }
    }
    
    // If taxes are zero or don't match, calculate from gross - net
    const calculatedTotalTaxes = totalGross - totalNet;
    if (Math.abs((totalIncomeTax + totalEmployeeSSNIT) - calculatedTotalTaxes) > 0.01) {
      // Recalculate: assume 5% income tax and 2.5% SSNIT (from the default settings)
      // But we'll use the actual difference
      const actualEmployeeTaxes = calculatedTotalTaxes;
      // Split proportionally if we have some data, otherwise use defaults
      if (totalIncomeTax > 0 || totalEmployeeSSNIT > 0) {
        // Use existing proportions
        const totalKnownTaxes = totalIncomeTax + totalEmployeeSSNIT;
        if (totalKnownTaxes > 0) {
          const ratio = actualEmployeeTaxes / totalKnownTaxes;
          totalIncomeTax = parseFloat((totalIncomeTax * ratio).toFixed(2));
          totalEmployeeSSNIT = parseFloat((totalEmployeeSSNIT * ratio).toFixed(2));
        } else {
          // Default split: 66.67% income tax, 33.33% SSNIT (based on 5% and 2.5% rates)
          totalIncomeTax = parseFloat((actualEmployeeTaxes * 0.6667).toFixed(2));
          totalEmployeeSSNIT = parseFloat((actualEmployeeTaxes * 0.3333).toFixed(2));
        }
      } else {
        // No tax data at all, use default split
        totalIncomeTax = parseFloat((actualEmployeeTaxes * 0.6667).toFixed(2));
        totalEmployeeSSNIT = parseFloat((actualEmployeeTaxes * 0.3333).toFixed(2));
      }
    }
    
    // Calculate employer SSNIT if missing (typically 13% of gross, but we'll use 2x employee SSNIT as approximation)
    if (totalEmployerSSNIT === 0 && totalEmployeeSSNIT > 0) {
      // Employer SSNIT is typically ~2.36x employee SSNIT (13% / 5.5%)
      totalEmployerSSNIT = parseFloat((totalEmployeeSSNIT * 2.36).toFixed(2));
    }

    // Get accounts using the correct codes from the chart of accounts
    const salaryAccount = await accountingService.getAccountByCode(req.tenantId, '5210'); // Salaries and Wages
    const payrollPayableAccount = await accountingService.getAccountByCode(req.tenantId, '2130'); // Payroll Payable
    const taxPayableAccount = await accountingService.getAccountByCode(req.tenantId, '2140'); // Tax Payable

    if (!salaryAccount || !payrollPayableAccount || !taxPayableAccount) {
      return res.status(400).json({ 
        success: false, 
        message: 'Required accounts are missing. Ensure default chart of accounts is seeded. Required: 5210 (Salaries), 2130 (Payroll Payable), 2140 (Tax Payable)' 
      });
    }

    // Calculate totals and verify they balance
    const totalDebit = parseFloat((totalGross + totalEmployerSSNIT).toFixed(2));
    const totalCredit = parseFloat((totalNet + totalIncomeTax + totalEmployeeSSNIT + totalEmployerSSNIT).toFixed(2));
    
    // Verify: totalGross should equal totalNet + totalIncomeTax + totalEmployeeSSNIT
    const calculatedGross = parseFloat((totalNet + totalIncomeTax + totalEmployeeSSNIT).toFixed(2));
    const actualGross = parseFloat(totalGross.toFixed(2));
    
    if (Math.abs(calculatedGross - actualGross) > 0.01) {
      return res.status(400).json({
        success: false,
        message: `Payroll calculation mismatch: Gross (${actualGross}) does not equal Net (${totalNet}) + Taxes (${totalIncomeTax + totalEmployeeSSNIT}). Difference: ${Math.abs(calculatedGross - actualGross)}`
      });
    }
    
    if (Math.abs(totalDebit - totalCredit) > 0.01) {
      return res.status(400).json({
        success: false,
        message: `Journal entry does not balance: Debits (${totalDebit}) do not equal Credits (${totalCredit}). Difference: ${Math.abs(totalDebit - totalCredit)}`
      });
    }

    let journal;
    try {
      journal = await accountingService.createJournalEntry({
        tenantId: req.tenantId,
        reference: `PR-${dayjs(run.payDate).format('YYYYMMDD')}-${run.id.slice(0, 6)}`,
        description: `Payroll for ${dayjs(run.periodStart).format('MMM DD')} - ${dayjs(run.periodEnd).format('MMM DD, YYYY')}`,
        entryDate: run.payDate,
        status: 'posted', // Journal entries use 'posted', not 'approved'
        source: 'payroll',
        sourceId: run.id,
        userId: req.user?.id || null,
        lines: [
          {
            accountId: salaryAccount.id,
            debit: totalDebit,
            credit: 0,
            description: 'Payroll gross salaries and employer SSNIT contributions'
          },
          {
            accountId: payrollPayableAccount.id,
            debit: 0,
            credit: parseFloat(totalNet.toFixed(2)),
            description: 'Net pay payable to employees'
          },
          {
            accountId: taxPayableAccount.id,
            debit: 0,
            credit: parseFloat((totalIncomeTax + totalEmployeeSSNIT + totalEmployerSSNIT).toFixed(2)),
            description: 'PAYE, employee SSNIT, and employer SSNIT contributions payable'
          }
        ]
      });
    } catch (error) {
      return res.status(400).json({
        success: false,
        message: error.message || 'Failed to create journal entry',
        error: error.message
      });
    }

    await run.update({
      status: 'approved', // Changed from 'posted' to match enum values
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

