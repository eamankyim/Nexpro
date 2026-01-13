# Report Date Filter Test Script

## Overview

This autonomous test script verifies that date filtering works correctly across all report endpoints in the NEXPro system.

## Features

- Tests all 5 report types:
  - Revenue Report
  - Expense Report
  - Outstanding Payments Report
  - Sales Report
  - Service Analytics Report

- Tests 12 different date periods:
  - Today
  - Yesterday
  - This Week
  - Last Week
  - This Month
  - Last Month
  - This Quarter
  - Last Quarter
  - This Year
  - Last Year
  - Custom Range (Last 7 Days)
  - Custom Range (Last 30 Days)

- Validates:
  - Date filters are applied correctly
  - Responses are structured properly
  - Results differ between non-overlapping periods
  - All endpoints return valid data

## Usage

### Run the test script:

```bash
npm run test-reports
```

Or directly:

```bash
node scripts/test-report-date-filters.js
```

### Prerequisites

1. Database connection configured in `.env` file
2. At least one tenant with an admin user in the database
3. Node.js environment with all dependencies installed

## Output

The script provides:

- **Colored console output** for easy reading:
  - ✓ Green for passed tests
  - ✗ Red for failed tests
  - Blue for informational messages
  - Cyan for section headers

- **Detailed metrics** for each report and period:
  - Total revenue/expenses/sales
  - Counts of records by category/customer/date
  - Data structure validation

- **Test summary** at the end:
  - Total tests run
  - Passed/Failed counts
  - Error details if any failures occurred

## Example Output

```
================================================================================
Report Date Filter Test Suite
================================================================================
Starting tests at 2025-01-15T10:30:00.000Z

Connecting to database...
✓ Database connection established

Finding test tenant...
✓ Using tenant: Acme Printing (29d5489e-9494-4127-b46a-0b0265e5205b)

================================================================================
Testing Revenue Report Date Filtering
================================================================================

Testing period: Today (2025-01-15 to 2025-01-15)
  Metrics: {"totalRevenue":4874,"byPeriodCount":4,"byCustomerCount":20}
✓ Revenue Report - Today

...

================================================================================
Test Summary
================================================================================
Total Tests: 60
Passed: 60
Failed: 0
```

## Exit Codes

- `0` - All tests passed
- `1` - One or more tests failed

## Integration

This script can be integrated into:
- CI/CD pipelines
- Automated testing workflows
- Pre-deployment validation
- Scheduled health checks

## Notes

- The script uses the first available tenant with an admin user
- Tests are run sequentially to avoid database connection issues
- All date calculations use native JavaScript Date objects (no external dependencies)
- The script automatically closes database connections when finished


