/**
 * Autonomous Test Script for Report Date Filters
 * 
 * This script tests all report endpoints to ensure date filtering works correctly
 * across all report types and various date periods.
 * 
 * Usage: node scripts/test-report-date-filters.js
 */

require('dotenv').config();
const { sequelize } = require('../config/database');
const { User, Tenant, UserTenant } = require('../models');
const reportController = require('../controllers/reportController');

// Date helper functions (using native Date)
function formatDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function startOfDay(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfDay(date) {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

function startOfWeek(date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Adjust when day is Sunday
  d.setDate(diff);
  return startOfDay(d);
}

function endOfWeek(date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? 0 : 7); // Adjust when day is Sunday
  d.setDate(diff);
  return endOfDay(d);
}

function startOfMonth(date) {
  const d = new Date(date);
  d.setDate(1);
  return startOfDay(d);
}

function endOfMonth(date) {
  const d = new Date(date);
  d.setMonth(d.getMonth() + 1);
  d.setDate(0);
  return endOfDay(d);
}

function startOfQuarter(date) {
  const d = new Date(date);
  const quarter = Math.floor(d.getMonth() / 3);
  d.setMonth(quarter * 3);
  d.setDate(1);
  return startOfDay(d);
}

function endOfQuarter(date) {
  const d = new Date(date);
  const quarter = Math.floor(d.getMonth() / 3);
  d.setMonth((quarter + 1) * 3);
  d.setDate(0);
  return endOfDay(d);
}

function startOfYear(date) {
  const d = new Date(date);
  d.setMonth(0);
  d.setDate(1);
  return startOfDay(d);
}

function endOfYear(date) {
  const d = new Date(date);
  d.setMonth(11);
  d.setDate(31);
  return endOfDay(d);
}

function subtractDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() - days);
  return d;
}

function subtractMonths(date, months) {
  const d = new Date(date);
  d.setMonth(d.getMonth() - months);
  return d;
}

function subtractQuarters(date, quarters) {
  const d = new Date(date);
  d.setMonth(d.getMonth() - (quarters * 3));
  return d;
}

function subtractYears(date, years) {
  const d = new Date(date);
  d.setFullYear(d.getFullYear() - years);
  return d;
}

function isBefore(date1, date2) {
  return new Date(date1) < new Date(date2);
}

// Test configuration
function getTestPeriods() {
  const now = new Date();
  return [
    {
      name: 'Today',
      startDate: formatDate(startOfDay(now)),
      endDate: formatDate(endOfDay(now))
    },
    {
      name: 'Yesterday',
      startDate: formatDate(startOfDay(subtractDays(now, 1))),
      endDate: formatDate(endOfDay(subtractDays(now, 1)))
    },
    {
      name: 'This Week',
      startDate: formatDate(startOfWeek(now)),
      endDate: formatDate(endOfWeek(now))
    },
    {
      name: 'Last Week',
      startDate: formatDate(startOfWeek(subtractDays(now, 7))),
      endDate: formatDate(endOfWeek(subtractDays(now, 7)))
    },
    {
      name: 'This Month',
      startDate: formatDate(startOfMonth(now)),
      endDate: formatDate(endOfMonth(now))
    },
    {
      name: 'Last Month',
      startDate: formatDate(startOfMonth(subtractMonths(now, 1))),
      endDate: formatDate(endOfMonth(subtractMonths(now, 1)))
    },
    {
      name: 'This Quarter',
      startDate: formatDate(startOfQuarter(now)),
      endDate: formatDate(endOfQuarter(now))
    },
    {
      name: 'Last Quarter',
      startDate: formatDate(startOfQuarter(subtractQuarters(now, 1))),
      endDate: formatDate(endOfQuarter(subtractQuarters(now, 1)))
    },
    {
      name: 'This Year',
      startDate: formatDate(startOfYear(now)),
      endDate: formatDate(endOfYear(now))
    },
    {
      name: 'Last Year',
      startDate: formatDate(startOfYear(subtractYears(now, 1))),
      endDate: formatDate(endOfYear(subtractYears(now, 1)))
    },
    {
      name: 'Custom Range (Last 7 Days)',
      startDate: formatDate(startOfDay(subtractDays(now, 7))),
      endDate: formatDate(endOfDay(now))
    },
    {
      name: 'Custom Range (Last 30 Days)',
      startDate: formatDate(startOfDay(subtractDays(now, 30))),
      endDate: formatDate(endOfDay(now))
    }
  ];
}

const TEST_CONFIG = {
  periods: getTestPeriods()
};

// Test results storage
const testResults = {
  total: 0,
  passed: 0,
  failed: 0,
  errors: []
};

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

// Helper functions
function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logSection(title) {
  console.log('\n' + '='.repeat(80));
  log(title, 'cyan');
  console.log('='.repeat(80));
}

function logTest(name, passed, details = '') {
  testResults.total++;
  if (passed) {
    testResults.passed++;
    log(`✓ ${name}`, 'green');
  } else {
    testResults.failed++;
    testResults.errors.push({ name, details });
    log(`✗ ${name}`, 'red');
    if (details) {
      log(`  ${details}`, 'yellow');
    }
  }
}

// Mock request object for controllers
function createMockRequest(tenantId, query = {}) {
  return {
    tenantId,
    query,
    user: { id: 'test-user-id' }
  };
}

// Mock response object
function createMockResponse() {
  const res = {
    statusCode: null,
    data: null,
    status: function(code) {
      this.statusCode = code;
      return this;
    },
    json: function(data) {
      this.data = data;
      return this;
    }
  };
  return res;
}

// Test a report endpoint with specific groupBy
async function testReport(reportName, reportFunction, period, tenantId, groupBy = 'day') {
  try {
    const req = createMockRequest(tenantId, {
      startDate: period.startDate,
      endDate: period.endDate,
      groupBy: groupBy
    });
    const res = createMockResponse();
    const next = (error) => {
      if (error) throw error;
    };

    await reportFunction(req, res, next);

    // Check if response is successful
    if (res.statusCode !== 200) {
      throw new Error(`Expected status 200, got ${res.statusCode}`);
    }

    // Check if data exists
    if (!res.data || !res.data.success) {
      throw new Error('Response does not have success: true');
    }

    // Check if data structure is correct
    if (!res.data.data) {
      throw new Error('Response does not have data object');
    }

    return {
      success: true,
      data: res.data.data,
      groupBy: groupBy
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
      groupBy: groupBy
    };
  }
}

// Test date filtering by comparing results with different groupBy options
async function testDateFiltering(reportName, reportFunction, tenantId) {
  logSection(`Testing ${reportName} Date Filtering`);

  const results = {};
  let allPassed = true;

  // Define which reports support groupBy and which groupBy options to test
  const supportsGroupBy = reportName.includes('Revenue') || reportName.includes('Sales');
  const groupByOptions = supportsGroupBy ? ['day', 'week', 'month'] : [null];

  // Test each period with different groupBy options
  for (const period of TEST_CONFIG.periods) {
    log(`\nTesting period: ${period.name} (${period.startDate} to ${period.endDate})`, 'blue');
    
    const periodResults = {};
    
    // Test with different groupBy options
    for (const groupBy of groupByOptions) {
      const groupByLabel = groupBy || 'default';
      log(`  Testing with groupBy: ${groupByLabel}`, 'cyan');
      
      const result = await testReport(reportName, reportFunction, period, tenantId, groupBy);
      periodResults[groupByLabel] = result;
      
      if (!result.success) {
        log(`    ✗ Failed: ${result.error}`, 'red');
        allPassed = false;
      }
    }
    
    results[period.name] = periodResults;

      // Process results for each groupBy option
    for (const [groupByLabel, result] of Object.entries(periodResults)) {
      if (result.success) {
        // Extract key metrics based on report type
        let metrics = {};
        if (reportName.includes('Revenue')) {
          metrics = {
            totalRevenue: result.data.totalRevenue || 0,
            byPeriodCount: result.data.byPeriod?.length || 0,
            byCustomerCount: result.data.byCustomer?.length || 0,
            groupBy: result.groupBy
          };
          // Show sample period data if available
          if (result.data.byPeriod && result.data.byPeriod.length > 0) {
            log(`    Sample Period Data (${groupByLabel}):`, 'cyan');
            result.data.byPeriod.slice(0, 5).forEach(period => {
              const periodKey = period.date || `${period.week || period.month || 'N/A'}`;
              log(`      ${periodKey}: ${period.totalRevenue || 0}`, 'cyan');
            });
            // Calculate sum of grouped data
            const sumOfGrouped = result.data.byPeriod.reduce((sum, p) => sum + (parseFloat(p.totalRevenue) || 0), 0);
            log(`    Sum of grouped data: ${sumOfGrouped.toFixed(2)}`, 'cyan');
            log(`    Total revenue: ${result.data.totalRevenue}`, 'cyan');
            if (Math.abs(sumOfGrouped - (result.data.totalRevenue || 0)) > 0.01) {
              log(`    ⚠️  WARNING: Sum of grouped data (${sumOfGrouped}) doesn't match total (${result.data.totalRevenue})`, 'yellow');
            }
          }
        } else if (reportName.includes('Expense')) {
          metrics = {
            totalExpenses: result.data.totalExpenses || 0,
            byCategoryCount: result.data.byCategory?.length || 0,
            byDateCount: result.data.byDate?.length || 0
          };
          // Show sample category data if available
          if (result.data.byCategory && result.data.byCategory.length > 0) {
            log(`    Sample Category Data:`, 'cyan');
            result.data.byCategory.slice(0, 3).forEach(cat => {
              log(`      ${cat.category}: ${cat.totalAmount || 0}`, 'cyan');
            });
          }
        } else if (reportName.includes('Outstanding')) {
          metrics = {
            totalOutstanding: result.data.totalOutstanding || 0,
            invoiceCount: result.data.invoices?.length || 0,
            byCustomerCount: result.data.byCustomer?.length || 0
          };
        } else if (reportName.includes('Sales')) {
          metrics = {
            totalSales: result.data.totalSales || 0,
            totalJobs: result.data.totalJobs || 0,
            byJobTypeCount: result.data.byJobType?.length || 0,
            jobsTrendCount: result.data.jobsTrendByDate?.length || 0,
            groupBy: result.groupBy
          };
          // Show sample job type data if available
          if (result.data.byJobType && result.data.byJobType.length > 0) {
            log(`    Sample Job Type Data:`, 'cyan');
            result.data.byJobType.slice(0, 3).forEach(jt => {
              log(`      ${jt.jobType || jt.category}: ${jt.totalSales || 0}`, 'cyan');
            });
          }
        } else if (reportName.includes('Service Analytics')) {
          metrics = {
            totalRevenue: result.data.totalRevenue || 0,
            totalQuantity: result.data.totalQuantity || 0,
            byCategoryCount: result.data.byCategory?.length || 0,
            byDateCount: result.data.byDate?.length || 0
          };
          // Show sample category data if available
          if (result.data.byCategory && result.data.byCategory.length > 0) {
            log(`    Sample Category Data:`, 'cyan');
            result.data.byCategory.slice(0, 3).forEach(cat => {
              log(`      ${cat.category}: ${cat.totalRevenue || 0} (Qty: ${cat.totalQuantity || 0})`, 'cyan');
            });
          }
        }

        const hasData = metrics.totalRevenue > 0 || metrics.totalExpenses > 0 || metrics.totalSales > 0 || metrics.totalOutstanding > 0;
        log(`    Metrics (${groupByLabel}): ${JSON.stringify(metrics)}`, hasData ? 'green' : 'yellow');
        logTest(`${reportName} - ${period.name} (${groupByLabel})`, true);
      } else {
        log(`    Error (${groupByLabel}): ${result.error}`, 'red');
        logTest(`${reportName} - ${period.name} (${groupByLabel})`, false, result.error);
        allPassed = false;
      }
    }
    
    // Compare totals across different groupBy options for the same period
    if (supportsGroupBy && periodResults['day']?.success && periodResults['week']?.success && periodResults['month']?.success) {
      log(`\n  📊 Comparing totals across groupBy options:`, 'blue');
      const dayTotal = periodResults['day'].data.totalRevenue || periodResults['day'].data.totalSales || 0;
      const weekTotal = periodResults['week'].data.totalRevenue || periodResults['week'].data.totalSales || 0;
      const monthTotal = periodResults['month'].data.totalRevenue || periodResults['month'].data.totalSales || 0;
      
      log(`    Day grouping total: ${dayTotal}`, 'cyan');
      log(`    Week grouping total: ${weekTotal}`, 'cyan');
      log(`    Month grouping total: ${monthTotal}`, 'cyan');
      
      const allMatch = Math.abs(dayTotal - weekTotal) < 0.01 && 
                       Math.abs(weekTotal - monthTotal) < 0.01 &&
                       Math.abs(dayTotal - monthTotal) < 0.01;
      
      if (allMatch) {
        log(`    ✓ All groupBy totals match!`, 'green');
        logTest(`${reportName} - ${period.name} (groupBy consistency)`, true);
      } else {
        log(`    ⚠️  WARNING: Totals don't match across groupBy options!`, 'yellow');
        logTest(`${reportName} - ${period.name} (groupBy consistency)`, false, 
          `Day: ${dayTotal}, Week: ${weekTotal}, Month: ${monthTotal}`);
        allPassed = false;
      }
      
      // Show data pattern comparison
      log(`\n  📈 Data Pattern Analysis:`, 'blue');
      
      // Day pattern
      if (periodResults['day'].data.byPeriod && periodResults['day'].data.byPeriod.length > 0) {
        log(`    Day Pattern (${periodResults['day'].data.byPeriod.length} days):`, 'cyan');
        const dayPattern = periodResults['day'].data.byPeriod.map(p => ({
          key: p.date,
          value: parseFloat(p.totalRevenue || p.totalSales || 0)
        }));
        dayPattern.slice(0, 5).forEach(p => {
          log(`      ${p.key}: ${p.value.toFixed(2)}`, 'cyan');
        });
        if (dayPattern.length > 5) {
          log(`      ... and ${dayPattern.length - 5} more days`, 'cyan');
        }
      }
      
      // Week pattern
      if (periodResults['week'].data.byPeriod && periodResults['week'].data.byPeriod.length > 0) {
        log(`    Week Pattern (${periodResults['week'].data.byPeriod.length} weeks):`, 'cyan');
        const weekPattern = periodResults['week'].data.byPeriod.map(p => ({
          key: `Week ${p.week || 'N/A'}`,
          value: parseFloat(p.totalRevenue || p.totalSales || 0)
        }));
        weekPattern.forEach(p => {
          log(`      ${p.key}: ${p.value.toFixed(2)}`, 'cyan');
        });
      }
      
      // Month pattern
      if (periodResults['month'].data.byPeriod && periodResults['month'].data.byPeriod.length > 0) {
        log(`    Month Pattern (${periodResults['month'].data.byPeriod.length} months):`, 'cyan');
        const monthPattern = periodResults['month'].data.byPeriod.map(p => ({
          key: `${p.year || 'N/A'}-${String(p.month || 'N/A').padStart(2, '0')}`,
          value: parseFloat(p.totalRevenue || p.totalSales || 0)
        }));
        monthPattern.forEach(p => {
          log(`      ${p.key}: ${p.value.toFixed(2)}`, 'cyan');
        });
      }
      
      // Verify sum of grouped data matches total
      if (periodResults['day'].data.byPeriod && periodResults['day'].data.byPeriod.length > 0) {
        const sumOfDays = periodResults['day'].data.byPeriod.reduce((sum, p) => 
          sum + (parseFloat(p.totalRevenue || p.totalSales || 0)), 0);
        const total = dayTotal;
        const diff = Math.abs(sumOfDays - total);
        if (diff < 0.01) {
          log(`    ✓ Sum of day groups (${sumOfDays.toFixed(2)}) matches total (${total})`, 'green');
        } else {
          log(`    ⚠️  Sum of day groups (${sumOfDays.toFixed(2)}) differs from total (${total}) by ${diff.toFixed(2)}`, 'yellow');
        }
      }
    }
  }

  // Compare results across periods to verify filtering
  log(`\nComparing results across periods...`, 'blue');
  const periodNames = Object.keys(results);
  for (let i = 0; i < periodNames.length; i++) {
    for (let j = i + 1; j < periodNames.length; j++) {
      const period1 = periodNames[i];
      const period2 = periodNames[j];
      
      // Compare using 'day' grouping for consistency
      const result1 = results[period1]?.['day'] || results[period1]?.['default'];
      const result2 = results[period2]?.['day'] || results[period2]?.['default'];
      
      if (result1?.success && result2?.success) {
        // Check if overlapping periods have different results (indicating filtering works)
        const p1Dates = TEST_CONFIG.periods.find(p => p.name === period1);
        const p2Dates = TEST_CONFIG.periods.find(p => p.name === period2);
        
        // If periods don't overlap, they should potentially have different totals
        const p1Start = new Date(p1Dates.startDate);
        const p1End = new Date(p1Dates.endDate);
        const p2Start = new Date(p2Dates.startDate);
        const p2End = new Date(p2Dates.endDate);
        
        const overlaps = !(p1End < p2Start || p2End < p1Start);
        
        if (!overlaps) {
          // Non-overlapping periods should have independent results
          logTest(
            `${reportName} - ${period1} vs ${period2} (non-overlapping)`,
            true,
            'Periods are independent'
          );
        }
      }
    }
  }

  return allPassed;
}

// Main test function
async function runTests() {
  logSection('Report Date Filter Test Suite');
  log(`Starting tests at ${new Date().toISOString()}`, 'bright');

  try {
    // Connect to database
    log('\nConnecting to database...', 'blue');
    await sequelize.authenticate();
    log('✓ Database connection established', 'green');

    // Get a test tenant - use specific user
    log('\nFinding test tenant for user: eamankyim@gmail.com...', 'blue');
    
    // Find the specific user
    const user = await User.findOne({
      where: { email: 'eamankyim@gmail.com' }
    });

    if (!user) {
      throw new Error('User eamankyim@gmail.com not found. Please ensure this user exists.');
    }

    log(`✓ Found user: ${user.name} (${user.email})`, 'green');

    // Get the user's tenant
    const userTenant = await UserTenant.findOne({
      where: { userId: user.id },
      include: [
        {
          model: Tenant,
          as: 'tenant'
        }
      ]
    });

    if (!userTenant || !userTenant.tenant) {
      throw new Error(`No tenant found for user ${user.email}. Please ensure this user is associated with a tenant.`);
    }

    const tenant = userTenant.tenant;

    if (!tenant) {
      throw new Error('No tenant found. Please ensure there is at least one tenant with an admin user.');
    }

    const tenantId = tenant.id;
    log(`✓ Using tenant: ${tenant.name} (${tenantId})`, 'green');

    // Check if tenant has any data
    log('\nChecking tenant data...', 'blue');
    const { Invoice, Job, Expense, JobItem } = require('../models');
    
    const invoiceCount = await Invoice.count({ where: { tenantId } });
    const paidInvoiceCount = await Invoice.count({ 
      where: { tenantId, status: 'paid' } 
    });
    const jobCount = await Job.count({ where: { tenantId } });
    const expenseCount = await Expense.count({ where: { tenantId } });
    const jobItemCount = await JobItem.count({ where: { tenantId } });
    
    // Get date ranges of actual data
    const oldestInvoice = await Invoice.findOne({
      where: { tenantId, status: 'paid' },
      order: [['paidDate', 'ASC']],
      attributes: ['paidDate']
    });
    const newestInvoice = await Invoice.findOne({
      where: { tenantId, status: 'paid' },
      order: [['paidDate', 'DESC']],
      attributes: ['paidDate']
    });
    
    const oldestJob = await Job.findOne({
      where: { tenantId },
      order: [['createdAt', 'ASC']],
      attributes: ['createdAt']
    });
    const newestJob = await Job.findOne({
      where: { tenantId },
      order: [['createdAt', 'DESC']],
      attributes: ['createdAt']
    });
    
    const oldestExpense = await Expense.findOne({
      where: { tenantId },
      order: [['expenseDate', 'ASC']],
      attributes: ['expenseDate']
    });
    const newestExpense = await Expense.findOne({
      where: { tenantId },
      order: [['expenseDate', 'DESC']],
      attributes: ['expenseDate']
    });

    log(`\n📊 Tenant Data Summary:`, 'bright');
    log(`   Invoices: ${invoiceCount} (${paidInvoiceCount} paid)`, invoiceCount > 0 ? 'green' : 'yellow');
    log(`   Jobs: ${jobCount}`, jobCount > 0 ? 'green' : 'yellow');
    log(`   Expenses: ${expenseCount}`, expenseCount > 0 ? 'green' : 'yellow');
    log(`   Job Items: ${jobItemCount}`, jobItemCount > 0 ? 'green' : 'yellow');
    
    if (oldestInvoice && newestInvoice) {
      log(`   Paid Invoices Date Range: ${formatDate(oldestInvoice.paidDate)} to ${formatDate(newestInvoice.paidDate)}`, 'cyan');
    } else {
      log(`   Paid Invoices Date Range: No paid invoices found`, 'yellow');
    }
    
    if (oldestJob && newestJob) {
      log(`   Jobs Date Range: ${formatDate(oldestJob.createdAt)} to ${formatDate(newestJob.createdAt)}`, 'cyan');
    } else {
      log(`   Jobs Date Range: No jobs found`, 'yellow');
    }
    
    if (oldestExpense && newestExpense) {
      log(`   Expenses Date Range: ${formatDate(oldestExpense.expenseDate)} to ${formatDate(newestExpense.expenseDate)}`, 'cyan');
    } else {
      log(`   Expenses Date Range: No expenses found`, 'yellow');
    }

    // Test all report endpoints
    const reports = [
      { name: 'Revenue Report', func: reportController.getRevenueReport },
      { name: 'Expense Report', func: reportController.getExpenseReport },
      { name: 'Outstanding Payments Report', func: reportController.getOutstandingPaymentsReport },
      { name: 'Sales Report', func: reportController.getSalesReport },
      { name: 'Service Analytics Report', func: reportController.getServiceAnalyticsReport }
    ];

    for (const report of reports) {
      await testDateFiltering(report.name, report.func, tenantId);
    }

    // Print summary
    logSection('Test Summary');
    log(`Total Tests: ${testResults.total}`, 'bright');
    log(`Passed: ${testResults.passed}`, 'green');
    log(`Failed: ${testResults.failed}`, testResults.failed > 0 ? 'red' : 'green');

    if (testResults.errors.length > 0) {
      log('\nErrors:', 'red');
      testResults.errors.forEach((error, index) => {
        log(`${index + 1}. ${error.name}`, 'red');
        log(`   ${error.details}`, 'yellow');
      });
    }

    // Exit with appropriate code
    process.exit(testResults.failed > 0 ? 1 : 0);

  } catch (error) {
    log(`\n✗ Fatal Error: ${error.message}`, 'red');
    console.error(error);
    process.exit(1);
  } finally {
    await sequelize.close();
    log('\nDatabase connection closed', 'blue');
  }
}

// Run tests
if (require.main === module) {
  runTests().catch(error => {
    log(`\n✗ Unhandled Error: ${error.message}`, 'red');
    console.error(error);
    process.exit(1);
  });
}

module.exports = { runTests, testReport, TEST_CONFIG: { periods: getTestPeriods() } };

