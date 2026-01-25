const fs = require('fs');
const path = require('path');

/**
 * Audit script to check for potential tenant data leakage
 * Scans all controllers and routes for missing tenant filtering
 */

const controllersDir = path.join(__dirname, '../controllers');
const routesDir = path.join(__dirname, '../routes');

const issues = {
  missingTenantFilter: [],
  missingTenantContext: [],
  potentialLeaks: []
};

// Check if a query includes tenantId filtering
function hasTenantFiltering(code, lineNum) {
  const line = code.split('\n')[lineNum - 1];
  
  // Check for tenantId in where clause
  if (line.includes('tenantId') || 
      line.includes('req.tenantId') ||
      line.includes('applyTenantFilter')) {
    return true;
  }
  
  // Check surrounding lines
  const context = code.split('\n').slice(Math.max(0, lineNum - 5), lineNum + 5).join('\n');
  if (context.includes('tenantId') || context.includes('applyTenantFilter')) {
    return true;
  }
  
  return false;
}

// Check controllers for missing tenant filtering
function auditControllers() {
  const files = fs.readdirSync(controllersDir).filter(f => f.endsWith('.js'));
  
  files.forEach(file => {
    const filePath = path.join(controllersDir, file);
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n');
    
    // Skip platform admin and admin controllers (they're meant to see all tenants)
    if (file.includes('platform') || file.includes('admin') || file.includes('public')) {
      return;
    }
    
    lines.forEach((line, index) => {
      const lineNum = index + 1;
      
      // Check for database queries
      if (line.match(/\.(findAll|findOne|count|sum|findAndCountAll|findByPk)\(/)) {
        // Check if tenantId is in the where clause
        if (!hasTenantFiltering(content, lineNum)) {
          // Check if it's in an include (which is OK)
          if (!line.includes('include') && !line.includes('attributes')) {
            issues.missingTenantFilter.push({
              file,
              line: lineNum,
              code: line.trim()
            });
          }
        }
      }
    });
  });
}

// Check routes for missing tenantContext
function auditRoutes() {
  const files = fs.readdirSync(routesDir).filter(f => f.endsWith('.js'));
  
  files.forEach(file => {
    const filePath = path.join(routesDir, file);
    const content = fs.readFileSync(filePath, 'utf8');
    
    // Skip platform admin and admin routes (they don't need tenantContext)
    if (file.includes('platform') || file.includes('admin') || file.includes('public')) {
      return;
    }
    
    // Check if route uses protect but not tenantContext
    if (content.includes('router.use(protect)') && !content.includes('router.use(tenantContext)')) {
      issues.missingTenantContext.push({
        file,
        reason: 'Uses protect but missing tenantContext middleware'
      });
    }
  });
}

// Main audit function
function runAudit() {
  console.log('🔍 Auditing Tenant Data Isolation...\n');
  
  auditControllers();
  auditRoutes();
  
  console.log('='.repeat(80));
  console.log('AUDIT RESULTS');
  console.log('='.repeat(80));
  
  if (issues.missingTenantFilter.length > 0) {
    console.log('\n⚠️  POTENTIAL ISSUES: Missing Tenant Filtering in Controllers');
    console.log('-'.repeat(80));
    issues.missingTenantFilter.forEach(issue => {
      console.log(`\n📄 ${issue.file}:${issue.line}`);
      console.log(`   ${issue.code}`);
    });
  } else {
    console.log('\n✅ All controller queries appear to have tenant filtering');
  }
  
  if (issues.missingTenantContext.length > 0) {
    console.log('\n⚠️  POTENTIAL ISSUES: Missing tenantContext Middleware');
    console.log('-'.repeat(80));
    issues.missingTenantContext.forEach(issue => {
      console.log(`\n📄 ${issue.file}`);
      console.log(`   ${issue.reason}`);
    });
  } else {
    console.log('\n✅ All routes appear to have tenantContext middleware');
  }
  
  console.log('\n' + '='.repeat(80));
  console.log('RECOMMENDATIONS:');
  console.log('='.repeat(80));
  console.log('1. Ensure ALL database queries include tenantId in where clause');
  console.log('2. Use applyTenantFilter() utility function for consistency');
  console.log('3. Verify all routes use tenantContext middleware');
  console.log('4. Test with multiple tenants to ensure data isolation');
  console.log('5. Check includes/joins to ensure they also filter by tenantId');
  console.log('\n✅ Audit complete!\n');
}

runAudit();
