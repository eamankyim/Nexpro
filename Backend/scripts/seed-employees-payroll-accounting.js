require('dotenv').config();
const { sequelize } = require('../config/database');
const { Op } = require('sequelize');
const {
  Employee,
  PayrollRun,
  PayrollEntry,
  Account,
  JournalEntry,
  JournalEntryLine,
  AccountBalance,
  UserTenant,
  User,
  Job,
  Invoice,
  Expense
} = require('../models');

// Ghanaian first names
const firstNames = [
  'Kwame', 'Ama', 'Kofi', 'Akosua', 'Yaw', 'Efua', 'Kojo', 'Abena',
  'Kwaku', 'Adwoa', 'Kwabena', 'Ama', 'Yaa', 'Fiifi', 'Akua', 'Kweku',
  'Ama', 'Yaw', 'Esi', 'Kwame', 'Akosua', 'Kofi', 'Adwoa', 'Kojo',
  'Abena', 'Kwaku', 'Efua', 'Yaa', 'Fiifi', 'Akua', 'Kweku', 'Esi'
];

// Ghanaian last names
const lastNames = [
  'Mensah', 'Osei', 'Asante', 'Boateng', 'Owusu', 'Appiah', 'Darko', 'Agyeman',
  'Amoah', 'Bonsu', 'Danso', 'Frimpong', 'Gyasi', 'Kwarteng', 'Manu', 'Nkrumah',
  'Ofori', 'Opoku', 'Sarpong', 'Tetteh', 'Yeboah', 'Adjei', 'Amoako', 'Asiedu'
];

// Job titles
const jobTitles = [
  'Printing Operator', 'Graphic Designer', 'Customer Service Representative',
  'Sales Manager', 'Production Supervisor', 'Quality Control Specialist',
  'Accountant', 'Administrative Assistant', 'Delivery Driver', 'Maintenance Technician',
  'Marketing Coordinator', 'Operations Manager', 'IT Support', 'HR Manager'
];

// Departments
const departments = [
  'Production', 'Sales', 'Administration', 'Finance', 'Operations', 'Marketing', 'IT', 'HR'
];

// Ghana banks
const ghanaBanks = [
  'GCB Bank', 'Ecobank Ghana', 'Standard Chartered Bank', 'Absa Bank Ghana',
  'Fidelity Bank Ghana', 'Cal Bank', 'Zenith Bank Ghana', 'Access Bank Ghana',
  'United Bank for Africa', 'First National Bank', 'Guaranty Trust Bank',
  'Bank of Africa', 'Stanbic Bank', 'Republic Bank', 'Prudential Bank'
];

// Relationship options
const relationships = [
  'Spouse', 'Parent', 'Sibling', 'Child', 'Friend', 'Other'
];

// Chart of Accounts structure
const chartOfAccounts = [
  // Assets
  { code: '1000', name: 'Assets', type: 'Asset', category: 'Current Assets', parentId: null },
  { code: '1100', name: 'Current Assets', type: 'Asset', category: 'Current Assets', parentCode: '1000' },
  { code: '1110', name: 'Cash and Cash Equivalents', type: 'Asset', category: 'Current Assets', parentCode: '1100' },
  { code: '1111', name: 'Petty Cash', type: 'Asset', category: 'Current Assets', parentCode: '1110' },
  { code: '1112', name: 'Bank Account - GCB', type: 'Asset', category: 'Current Assets', parentCode: '1110' },
  { code: '1113', name: 'Bank Account - Ecobank', type: 'Asset', category: 'Current Assets', parentCode: '1110' },
  { code: '1200', name: 'Accounts Receivable', type: 'Asset', category: 'Current Assets', parentCode: '1100' },
  { code: '1300', name: 'Inventory', type: 'Asset', category: 'Current Assets', parentCode: '1100' },
  { code: '1400', name: 'Prepaid Expenses', type: 'Asset', category: 'Current Assets', parentCode: '1100' },
  { code: '1500', name: 'Fixed Assets', type: 'Asset', category: 'Fixed Assets', parentCode: '1000' },
  { code: '1510', name: 'Equipment', type: 'Asset', category: 'Fixed Assets', parentCode: '1500' },
  { code: '1520', name: 'Accumulated Depreciation - Equipment', type: 'Asset', category: 'Fixed Assets', parentCode: '1500' },
  { code: '1530', name: 'Vehicles', type: 'Asset', category: 'Fixed Assets', parentCode: '1500' },
  { code: '1540', name: 'Accumulated Depreciation - Vehicles', type: 'Asset', category: 'Fixed Assets', parentCode: '1500' },
  
  // Liabilities
  { code: '2000', name: 'Liabilities', type: 'Liability', category: 'Current Liabilities', parentId: null },
  { code: '2100', name: 'Current Liabilities', type: 'Liability', category: 'Current Liabilities', parentCode: '2000' },
  { code: '2110', name: 'Accounts Payable', type: 'Liability', category: 'Current Liabilities', parentCode: '2100' },
  { code: '2120', name: 'Accrued Expenses', type: 'Liability', category: 'Current Liabilities', parentCode: '2100' },
  { code: '2130', name: 'Payroll Payable', type: 'Liability', category: 'Current Liabilities', parentCode: '2100' },
  { code: '2140', name: 'Tax Payable', type: 'Liability', category: 'Current Liabilities', parentCode: '2100' },
  { code: '2200', name: 'Long-term Liabilities', type: 'Liability', category: 'Long-term Liabilities', parentCode: '2000' },
  { code: '2210', name: 'Long-term Loans', type: 'Liability', category: 'Long-term Liabilities', parentCode: '2200' },
  
  // Equity
  { code: '3000', name: 'Equity', type: 'Equity', category: 'Equity', parentId: null },
  { code: '3100', name: 'Owner\'s Equity', type: 'Equity', category: 'Equity', parentCode: '3000' },
  { code: '3110', name: 'Capital', type: 'Equity', category: 'Equity', parentCode: '3100' },
  { code: '3120', name: 'Retained Earnings', type: 'Equity', category: 'Equity', parentCode: '3100' },
  { code: '3130', name: 'Current Year Earnings', type: 'Equity', category: 'Equity', parentCode: '3100' },
  
  // Revenue
  { code: '4000', name: 'Revenue', type: 'Revenue', category: 'Operating Revenue', parentId: null },
  { code: '4100', name: 'Operating Revenue', type: 'Revenue', category: 'Operating Revenue', parentCode: '4000' },
  { code: '4110', name: 'Sales Revenue', type: 'Revenue', category: 'Operating Revenue', parentCode: '4100' },
  { code: '4120', name: 'Service Revenue', type: 'Revenue', category: 'Operating Revenue', parentCode: '4100' },
  { code: '4130', name: 'Printing Revenue', type: 'Revenue', category: 'Operating Revenue', parentCode: '4100' },
  { code: '4140', name: 'Design Revenue', type: 'Revenue', category: 'Operating Revenue', parentCode: '4100' },
  { code: '4200', name: 'Other Income', type: 'Revenue', category: 'Other Income', parentCode: '4000' },
  
  // Expenses
  { code: '5000', name: 'Expenses', type: 'Expense', category: 'Operating Expenses', parentId: null },
  { code: '5100', name: 'Cost of Goods Sold', type: 'Expense', category: 'Operating Expenses', parentCode: '5000' },
  { code: '5110', name: 'Materials Cost', type: 'Expense', category: 'Operating Expenses', parentCode: '5100' },
  { code: '5120', name: 'Labor Cost', type: 'Expense', category: 'Operating Expenses', parentCode: '5100' },
  { code: '5200', name: 'Operating Expenses', type: 'Expense', category: 'Operating Expenses', parentCode: '5000' },
  { code: '5210', name: 'Salaries and Wages', type: 'Expense', category: 'Operating Expenses', parentCode: '5200' },
  { code: '5220', name: 'Rent Expense', type: 'Expense', category: 'Operating Expenses', parentCode: '5200' },
  { code: '5230', name: 'Utilities', type: 'Expense', category: 'Operating Expenses', parentCode: '5200' },
  { code: '5240', name: 'Office Supplies', type: 'Expense', category: 'Operating Expenses', parentCode: '5200' },
  { code: '5250', name: 'Marketing and Advertising', type: 'Expense', category: 'Operating Expenses', parentCode: '5200' },
  { code: '5260', name: 'Depreciation Expense', type: 'Expense', category: 'Operating Expenses', parentCode: '5200' },
  { code: '5270', name: 'Insurance Expense', type: 'Expense', category: 'Operating Expenses', parentCode: '5200' },
  { code: '5280', name: 'Professional Fees', type: 'Expense', category: 'Operating Expenses', parentCode: '5200' },
  { code: '5300', name: 'Other Expenses', type: 'Expense', category: 'Operating Expenses', parentCode: '5000' }
];

function randomPick(array) {
  return array[Math.floor(Math.random() * array.length)];
}

function randomInRange(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomDecimal(min, max) {
  return parseFloat((Math.random() * (max - min) + min).toFixed(2));
}

function generatePhoneNumber() {
  const prefixes = ['020', '024', '026', '027', '050', '054', '055', '056', '057', '059'];
  return `${randomPick(prefixes)}${randomInRange(1000000, 9999999)}`;
}

function generateAccountNumber() {
  return randomInRange(1000000000, 9999999999).toString();
}

function getDateMonthsAgo(months) {
  const date = new Date();
  date.setMonth(date.getMonth() - months);
  return date;
}

function formatDate(date) {
  return date.toISOString().split('T')[0];
}

async function seedEmployeesPayrollAccounting() {
  try {
    console.log('[Seed] Starting employees, payroll, and accounting seeding...');

    // Get tenant ID
    const firstJob = await Job.findOne({ limit: 1 });
    if (!firstJob) {
      console.log('[Seed] No jobs found. Please create jobs first.');
      return;
    }

    const tenantId = firstJob.tenantId;
    console.log(`[Seed] Using tenant ID: ${tenantId}`);

    // Get users for employee linking
    const userTenants = await UserTenant.findAll({
      where: { tenantId, status: 'active' },
      include: [{ model: User, as: 'user' }],
      limit: 15
    });
    const users = userTenants.map(ut => ut.user).filter(Boolean);

    // Step 1: Create Chart of Accounts
    console.log('[Seed] Creating chart of accounts...');
    const accountMap = {};
    const parentAccountMap = {};

    // First pass: Create parent accounts
    for (const accountData of chartOfAccounts) {
      if (!accountData.parentCode) {
        try {
          const account = await Account.create({
            tenantId,
            code: accountData.code,
            name: accountData.name,
            type: accountData.type,
            category: accountData.category,
            parentId: null,
            description: `${accountData.name} account`,
            isActive: true
          });
          accountMap[accountData.code] = account;
          parentAccountMap[accountData.code] = account.id;
          console.log(`[Seed] Created account: ${accountData.code} - ${accountData.name}`);
        } catch (error) {
          if (error.name !== 'SequelizeUniqueConstraintError') {
            console.error(`[Seed] Error creating account ${accountData.code}:`, error.message);
          }
        }
      }
    }

    // Second pass: Create child accounts
    for (const accountData of chartOfAccounts) {
      if (accountData.parentCode) {
        try {
          const parentId = parentAccountMap[accountData.parentCode];
          if (!parentId) continue;

          const [account, created] = await Account.findOrCreate({
            where: { tenantId, code: accountData.code },
            defaults: {
              tenantId,
              code: accountData.code,
              name: accountData.name,
              type: accountData.type,
              category: accountData.category,
              parentId: parentId,
              description: `${accountData.name} account`,
              isActive: true
            }
          });

          if (created) {
            accountMap[accountData.code] = account;
            console.log(`[Seed] Created account: ${accountData.code} - ${accountData.name}`);
          } else {
            accountMap[accountData.code] = account;
          }
        } catch (error) {
          if (error.name !== 'SequelizeUniqueConstraintError') {
            console.error(`[Seed] Error creating account ${accountData.code}:`, error.message);
          }
        }
      }
    }

    console.log(`[Seed] Created ${Object.keys(accountMap).length} accounts`);

    // Step 2: Create Employees
    console.log('[Seed] Creating employees...');
    const employees = [];
    const employeeCount = randomInRange(8, 12);

    for (let i = 0; i < employeeCount; i++) {
      const firstName = randomPick(firstNames);
      const lastName = randomPick(lastNames);
      const middleName = Math.random() < 0.3 ? randomPick(firstNames) : null;
      const email = `${firstName.toLowerCase()}.${lastName.toLowerCase()}@nexusprint.gh`;
      const hireDate = getDateMonthsAgo(randomInRange(1, 24));
      
      const employmentType = randomPick(['full_time', 'full_time', 'full_time', 'part_time', 'contract']);
      const status = randomPick(['active', 'active', 'active', 'active', 'probation']);
      const salaryType = randomPick(['salary', 'salary', 'hourly']);
      
      let salaryAmount = 0;
      if (salaryType === 'salary') {
        salaryAmount = randomInRange(1500, 5000); // GHS per month
      } else {
        salaryAmount = randomDecimal(15, 50); // GHS per hour
      }

      const payFrequency = randomPick(['monthly', 'monthly', 'biweekly', 'weekly']);

      try {
        const employee = await Employee.create({
          tenantId,
          userId: users[i] ? users[i].id : null,
          firstName,
          lastName,
          middleName,
          preferredName: Math.random() < 0.2 ? firstName : null,
          email,
          phone: generatePhoneNumber(),
          jobTitle: randomPick(jobTitles),
          department: randomPick(departments),
          employmentType,
          status,
          hireDate: formatDate(hireDate),
          salaryType,
          salaryAmount,
          payFrequency,
          bankName: randomPick(ghanaBanks),
          bankAccountName: `${firstName} ${lastName}`,
          bankAccountNumber: generateAccountNumber(),
          emergencyContact: {
            name: `${randomPick(firstNames)} ${randomPick(lastNames)}`,
            relationship: randomPick(relationships),
            phone: generatePhoneNumber(),
            email: `emergency${i}@example.com`
          },
          nextOfKin: {
            name: `${randomPick(firstNames)} ${randomPick(lastNames)}`,
            relationship: randomPick(relationships),
            phone: generatePhoneNumber()
          },
          address: {
            street: `${randomInRange(1, 999)} ${randomPick(['Ring Road', 'Oxford Street', 'Independence Avenue', 'Airport Road'])}`,
            city: randomPick(['Accra', 'Kumasi', 'Tamale', 'Takoradi', 'Cape Coast']),
            region: randomPick(['Greater Accra', 'Ashanti', 'Northern', 'Western', 'Central']),
            country: 'Ghana'
          },
          isActive: status === 'active'
        });

        employees.push(employee);
        console.log(`[Seed] Created employee: ${firstName} ${lastName} - ${employee.jobTitle}`);
      } catch (error) {
        console.error(`[Seed] Error creating employee ${firstName} ${lastName}:`, error.message);
      }
    }

    console.log(`[Seed] Created ${employees.length} employees`);

    // Step 3: Create Payroll Runs and Entries
    console.log('[Seed] Creating payroll runs and entries...');
    const payrollRuns = [];
    const currentDate = new Date();
    const currentYear = currentDate.getFullYear();
    const currentMonth = currentDate.getMonth();

    // Create payroll runs for the last 6 months
    for (let monthOffset = 5; monthOffset >= 0; monthOffset--) {
      const payrollDate = new Date(currentYear, currentMonth - monthOffset, 1);
      const periodStart = new Date(payrollDate.getFullYear(), payrollDate.getMonth(), 1);
      const periodEnd = new Date(payrollDate.getFullYear(), payrollDate.getMonth() + 1, 0);
      const payDate = new Date(payrollDate.getFullYear(), payrollDate.getMonth(), 15);

      let totalGross = 0;
      let totalNet = 0;
      let totalTax = 0;
      const payrollEntries = [];

      // Create payroll entry for each active employee
      for (const employee of employees.filter(e => e.status === 'active')) {
        let grossPay = 0;
        
        if (employee.salaryType === 'salary') {
          if (employee.payFrequency === 'monthly') {
            grossPay = parseFloat(employee.salaryAmount);
          } else if (employee.payFrequency === 'biweekly') {
            grossPay = parseFloat(employee.salaryAmount) / 2;
          } else if (employee.payFrequency === 'weekly') {
            grossPay = parseFloat(employee.salaryAmount) / 4;
          }
        } else {
          // Hourly: assume 160 hours per month
          grossPay = parseFloat(employee.salaryAmount) * 160;
        }

        // Calculate taxes (simplified: 5% income tax, 2.5% SSNIT)
        const incomeTax = grossPay * 0.05;
        const ssnit = grossPay * 0.025;
        const totalDeductions = incomeTax + ssnit;
        const netPay = grossPay - totalDeductions;

        totalGross += grossPay;
        totalNet += netPay;
        totalTax += incomeTax + ssnit;

        payrollEntries.push({
          employeeId: employee.id,
          grossPay,
          netPay,
          allowances: [
            { type: 'Transport', amount: randomDecimal(50, 200) },
            { type: 'Meal', amount: randomDecimal(30, 150) }
          ],
          deductions: [
            { type: 'Income Tax', amount: incomeTax },
            { type: 'SSNIT', amount: ssnit }
          ],
          taxes: [
            { type: 'Income Tax', amount: incomeTax },
            { type: 'SSNIT', amount: ssnit }
          ]
        });
      }

      try {
        const payrollRun = await PayrollRun.create({
          tenantId,
          periodStart: formatDate(periodStart),
          periodEnd: formatDate(periodEnd),
          payDate: formatDate(payDate),
          status: monthOffset === 0 ? 'draft' : 'paid',
          totalGross,
          totalNet,
          totalTax,
          totalEmployees: payrollEntries.length,
          notes: `Payroll for ${periodStart.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}`
        });

        // Create payroll entries
        for (const entryData of payrollEntries) {
          await PayrollEntry.create({
            tenantId,
            payrollRunId: payrollRun.id,
            employeeId: entryData.employeeId,
            grossPay: entryData.grossPay,
            netPay: entryData.netPay,
            allowances: entryData.allowances,
            deductions: entryData.deductions,
            taxes: entryData.taxes
          });
        }

        payrollRuns.push(payrollRun);
        console.log(`[Seed] Created payroll run for ${periodStart.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })} with ${payrollEntries.length} entries`);
      } catch (error) {
        console.error(`[Seed] Error creating payroll run:`, error.message);
      }
    }

    // Step 4: Create Journal Entries
    console.log('[Seed] Creating journal entries...');
    const journalEntries = [];

    // Get some invoices and expenses for journal entries
    const invoices = await Invoice.findAll({
      where: { tenantId },
      limit: 20,
      order: [['createdAt', 'DESC']]
    });

    const expenses = await Expense.findAll({
      where: { tenantId, approvalStatus: 'approved' },
      limit: 15,
      order: [['createdAt', 'DESC']]
    });

    // Journal entries for invoice revenue
    for (const invoice of invoices.slice(0, 10)) {
      if (invoice.status === 'paid' && invoice.amountPaid > 0) {
        try {
          const entryDate = invoice.paidDate || invoice.createdAt;
          const journalEntry = await JournalEntry.create({
            tenantId,
            reference: `INV-${invoice.invoiceNumber}`,
            description: `Revenue from invoice ${invoice.invoiceNumber}`,
            entryDate: entryDate instanceof Date ? formatDate(entryDate) : entryDate,
            status: 'posted',
            source: 'invoice',
            sourceId: invoice.id,
            createdBy: users[0] ? users[0].id : null
          });

          // Debit: Accounts Receivable or Cash
          await JournalEntryLine.create({
            tenantId,
            journalEntryId: journalEntry.id,
            accountId: accountMap['1112']?.id || accountMap['1200']?.id,
            description: `Payment received for invoice ${invoice.invoiceNumber}`,
            debit: parseFloat(invoice.amountPaid),
            credit: 0
          });

          // Credit: Revenue
          await JournalEntryLine.create({
            tenantId,
            journalEntryId: journalEntry.id,
            accountId: accountMap['4110']?.id || accountMap['4130']?.id,
            description: `Revenue from invoice ${invoice.invoiceNumber}`,
            debit: 0,
            credit: parseFloat(invoice.amountPaid)
          });

          journalEntries.push(journalEntry);
        } catch (error) {
          console.error(`[Seed] Error creating journal entry for invoice:`, error.message);
        }
      }
    }

    // Journal entries for expenses
    for (const expense of expenses.slice(0, 10)) {
      if (expense.status === 'paid' && expense.amount > 0) {
        try {
          const entryDate = expense.expenseDate || expense.createdAt;
          const journalEntry = await JournalEntry.create({
            tenantId,
            reference: `EXP-${expense.expenseNumber || expense.id.slice(0, 8)}`,
            description: `Expense: ${expense.description}`,
            entryDate: entryDate instanceof Date ? formatDate(entryDate) : entryDate,
            status: 'posted',
            source: 'expense',
            sourceId: expense.id,
            createdBy: users[0] ? users[0].id : null
          });

          // Debit: Expense account
          const expenseAccount = accountMap['5200']?.id || accountMap['5240']?.id;
          await JournalEntryLine.create({
            tenantId,
            journalEntryId: journalEntry.id,
            accountId: expenseAccount,
            description: expense.description,
            debit: parseFloat(expense.amount),
            credit: 0
          });

          // Credit: Cash or Accounts Payable
          await JournalEntryLine.create({
            tenantId,
            journalEntryId: journalEntry.id,
            accountId: accountMap['1112']?.id || accountMap['2110']?.id,
            description: `Payment for expense: ${expense.description}`,
            debit: 0,
            credit: parseFloat(expense.amount)
          });

          journalEntries.push(journalEntry);
        } catch (error) {
          console.error(`[Seed] Error creating journal entry for expense:`, error.message);
        }
      }
    }

    // Journal entries for payroll
    for (const payrollRun of payrollRuns.filter(pr => pr.status === 'paid')) {
      try {
        const journalEntry = await JournalEntry.create({
          tenantId,
          reference: `PAY-${payrollRun.id.slice(0, 8)}`,
          description: `Payroll for ${new Date(payrollRun.periodStart).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}`,
          entryDate: formatDate(new Date(payrollRun.payDate)),
          status: 'posted',
          source: 'payroll',
          sourceId: payrollRun.id,
          createdBy: users[0] ? users[0].id : null
        });

        // Debit: Salaries and Wages Expense
        await JournalEntryLine.create({
          tenantId,
          journalEntryId: journalEntry.id,
          accountId: accountMap['5210']?.id,
          description: `Payroll expense for ${new Date(payrollRun.periodStart).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}`,
          debit: parseFloat(payrollRun.totalGross),
          credit: 0
        });

        // Credit: Payroll Payable
        await JournalEntryLine.create({
          tenantId,
          journalEntryId: journalEntry.id,
          accountId: accountMap['2130']?.id,
          description: `Payroll payable for ${new Date(payrollRun.periodStart).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}`,
          debit: 0,
          credit: parseFloat(payrollRun.totalNet)
        });

        // Credit: Tax Payable
        await JournalEntryLine.create({
          tenantId,
          journalEntryId: journalEntry.id,
          accountId: accountMap['2140']?.id,
          description: `Tax payable for ${new Date(payrollRun.periodStart).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}`,
          debit: 0,
          credit: parseFloat(payrollRun.totalTax)
        });

        // Update payroll run with journal entry ID
        await payrollRun.update({ journalEntryId: journalEntry.id });
        journalEntries.push(journalEntry);
      } catch (error) {
        console.error(`[Seed] Error creating journal entry for payroll:`, error.message);
      }
    }

    console.log(`[Seed] Created ${journalEntries.length} journal entries`);

    // Step 5: Create Account Balances (for current year)
    console.log('[Seed] Creating account balances...');
    const fiscalYear = currentYear;
    const currentPeriod = currentMonth + 1;

    for (const accountCode in accountMap) {
      const account = accountMap[accountCode];
      if (!account) continue;

      // Create balances for each month up to current month
      for (let period = 1; period <= currentPeriod; period++) {
        try {
          // Calculate running balance based on account type
          let debit = 0;
          let credit = 0;
          let balance = 0;

          // Get all journal entry lines for this account up to this period
          const periodEndDate = new Date(fiscalYear, period, 0);
          const lines = await JournalEntryLine.findAll({
            where: { tenantId, accountId: account.id },
            include: [{
              model: JournalEntry,
              as: 'journalEntry',
              where: {
                tenantId,
                status: 'posted',
                entryDate: {
                  [Op.lte]: formatDate(periodEndDate)
                }
              },
              required: true
            }]
          });

          for (const line of lines) {
            debit += parseFloat(line.debit || 0);
            credit += parseFloat(line.credit || 0);
          }

          // Calculate balance based on account type
          if (['Asset', 'Expense'].includes(account.type)) {
            balance = debit - credit;
          } else {
            balance = credit - debit;
          }

          await AccountBalance.findOrCreate({
            where: {
              tenantId,
              accountId: account.id,
              fiscalYear,
              period
            },
            defaults: {
              tenantId,
              accountId: account.id,
              fiscalYear,
              period,
              debit,
              credit,
              balance
            }
          });
        } catch (error) {
          if (error.name !== 'SequelizeUniqueConstraintError') {
            console.error(`[Seed] Error creating account balance:`, error.message);
          }
        }
      }
    }

    console.log('[Seed] ✅ Employees, payroll, and accounting seeding completed successfully!');
    console.log(`[Seed] Summary:`);
    console.log(`  - Accounts: ${Object.keys(accountMap).length}`);
    console.log(`  - Employees: ${employees.length}`);
    console.log(`  - Payroll Runs: ${payrollRuns.length}`);
    console.log(`  - Journal Entries: ${journalEntries.length}`);

  } catch (error) {
    console.error('[Seed] ❌ Error seeding employees, payroll, and accounting:', error);
    throw error;
  } finally {
    await sequelize.close();
  }
}

// Run the seeder
if (require.main === module) {
  seedEmployeesPayrollAccounting()
    .then(() => {
      console.log('[Seed] Script completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('[Seed] Script failed:', error);
      process.exit(1);
    });
}

module.exports = seedEmployeesPayrollAccounting;

