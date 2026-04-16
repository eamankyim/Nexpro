/**
 * Audit DB schema against Sequelize models and report missing tables/columns.
 *
 * Usage:
 *   node scripts/check-missing-columns.js
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const { sequelize, testConnection } = require('../config/database');
const models = require('../models');
const { DataTypes } = require('sequelize');

const isVirtualAttribute = (attribute) => {
  if (!attribute || !attribute.type) return false;
  return attribute.type instanceof DataTypes.VIRTUAL;
};

const quoteIdentifier = (name) => `"${String(name).replace(/"/g, '""')}"`;

const detectSchemaAndTable = (model) => {
  const tableInfo = model.getTableName();
  if (typeof tableInfo === 'string') {
    return { schema: 'public', tableName: tableInfo };
  }
  return {
    schema: tableInfo.schema || 'public',
    tableName: tableInfo.tableName || tableInfo.table || String(tableInfo),
  };
};

const getModelColumnNames = (model) => {
  const attrs = model.rawAttributes || {};
  const columns = [];

  for (const [attributeName, attribute] of Object.entries(attrs)) {
    if (isVirtualAttribute(attribute)) continue;
    columns.push(attribute.field || attributeName);
  }

  return Array.from(new Set(columns));
};

const printSection = (title) => {
  console.log('\n' + '='.repeat(88));
  console.log(title);
  console.log('='.repeat(88));
};

const run = async () => {
  try {
    console.log('🔍 Checking database schema for missing columns...\n');
    await testConnection();

    const queryInterface = sequelize.getQueryInterface();
    const modelEntries = Object.entries(models).filter(([, value]) => {
      return value && typeof value.getTableName === 'function' && value.rawAttributes;
    });

    const missingTables = [];
    const missingColumns = [];

    for (const [modelName, model] of modelEntries) {
      const { schema, tableName } = detectSchemaAndTable(model);
      const tableRef = schema === 'public' ? tableName : `${schema}.${tableName}`;
      const quotedTableRef =
        schema === 'public'
          ? quoteIdentifier(tableName)
          : `${quoteIdentifier(schema)}.${quoteIdentifier(tableName)}`;

      let dbColumns = [];

      try {
        const [rows] = await sequelize.query(`
          SELECT column_name
          FROM information_schema.columns
          WHERE table_schema = :schema
            AND table_name = :tableName
        `, {
          replacements: { schema, tableName },
        });
        dbColumns = rows.map((row) => row.column_name);

        if (dbColumns.length === 0) {
          // As a second chance, verify table existence via direct select.
          try {
            await sequelize.query(`SELECT * FROM ${quotedTableRef} LIMIT 1;`);
          } catch (_err) {
            missingTables.push({ modelName, tableRef });
            continue;
          }
        }
      } catch (_err) {
        missingTables.push({ modelName, tableRef });
        continue;
      }

      const dbSet = new Set(dbColumns);
      const expectedColumns = getModelColumnNames(model);
      const modelMissingColumns = expectedColumns.filter((col) => !dbSet.has(col));

      if (modelMissingColumns.length > 0) {
        missingColumns.push({
          modelName,
          tableRef,
          columns: modelMissingColumns,
        });
      }
    }

    printSection('Schema Audit Result');
    console.log(`Models checked: ${modelEntries.length}`);
    console.log(`Missing tables: ${missingTables.length}`);
    console.log(`Models with missing columns: ${missingColumns.length}`);

    if (missingTables.length > 0) {
      printSection('Missing Tables');
      missingTables.forEach((entry, index) => {
        console.log(`${index + 1}. ${entry.modelName} -> ${entry.tableRef}`);
      });
    }

    if (missingColumns.length > 0) {
      printSection('Missing Columns');
      missingColumns.forEach((entry, index) => {
        console.log(`${index + 1}. ${entry.modelName} -> ${entry.tableRef}`);
        entry.columns.forEach((column) => console.log(`   - ${column}`));
      });
    }

    if (missingTables.length === 0 && missingColumns.length === 0) {
      console.log('\n✅ No missing tables/columns detected.');
    } else {
      console.log('\n⚠️  Missing schema items detected. Run the needed migrations.');
      process.exitCode = 2;
    }
  } catch (error) {
    console.error('\n❌ Schema audit failed:', error.message);
    process.exitCode = 1;
  } finally {
    await sequelize.close();
  }
};

run();

