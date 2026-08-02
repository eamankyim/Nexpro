const { getTemplateCSV, parseImportFile } = require('../utils/importParse');
const { importContacts, DESTINATIONS } = require('../utils/contactImport');

/**
 * GET /api/customers/import/template
 */
exports.getCustomerImportTemplate = (req, res) => {
  const csv = getTemplateCSV('customers');
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="customers_import_template.csv"');
  res.send(csv);
};

/**
 * GET /api/leads/import/template
 */
exports.getLeadImportTemplate = (req, res) => {
  const csv = getTemplateCSV('leads');
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="leads_import_template.csv"');
  res.send(csv);
};

/**
 * POST /api/customers/import — multipart file
 */
exports.importCustomersFromFile = async (req, res, next) => {
  try {
    if (!req.file || !req.file.buffer) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }
    const mime = req.file.mimetype || '';
    const ext = (req.file.originalname || '').toLowerCase().slice(-5);
    const { mapped, errors: parseErrors } = await parseImportFile(
      req.file.buffer,
      mime || ext,
      'customers'
    );

    if (parseErrors.length > 0 && mapped.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid file or rows',
        errors: parseErrors,
        skipped: [],
        successCount: 0,
        skippedCount: 0,
        errorCount: parseErrors.length,
      });
    }

    const result = await importContacts(req, {
      destination: 'customers',
      contacts: mapped,
      sourceHint: 'import_csv',
      rowOffset: 2,
    });

    const allErrors = [
      ...parseErrors,
      ...result.errors,
    ];

    res.status(result.success && parseErrors.length === 0 ? 201 : 207).json({
      success: result.success && parseErrors.length === 0,
      successCount: result.successCount,
      skippedCount: result.skippedCount,
      errorCount: allErrors.length,
      errors: allErrors,
      skipped: result.skipped,
    });
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ success: false, message: error.message });
    }
    next(error);
  }
};

/**
 * POST /api/leads/import — multipart file
 */
exports.importLeadsFromFile = async (req, res, next) => {
  try {
    if (!req.file || !req.file.buffer) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }
    const mime = req.file.mimetype || '';
    const ext = (req.file.originalname || '').toLowerCase().slice(-5);
    const { mapped, errors: parseErrors } = await parseImportFile(
      req.file.buffer,
      mime || ext,
      'leads'
    );

    if (parseErrors.length > 0 && mapped.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid file or rows',
        errors: parseErrors,
        skipped: [],
        successCount: 0,
        skippedCount: 0,
        errorCount: parseErrors.length,
      });
    }

    const result = await importContacts(req, {
      destination: 'leads',
      contacts: mapped,
      sourceHint: 'import_csv',
      rowOffset: 2,
    });

    const allErrors = [
      ...parseErrors,
      ...result.errors,
    ];

    res.status(result.success && parseErrors.length === 0 ? 201 : 207).json({
      success: result.success && parseErrors.length === 0,
      successCount: result.successCount,
      skippedCount: result.skippedCount,
      errorCount: allErrors.length,
      errors: allErrors,
      skipped: result.skipped,
    });
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ success: false, message: error.message });
    }
    next(error);
  }
};

/**
 * POST /api/contacts/import — JSON body from phone contacts picker
 * Body: { destination: 'customers'|'leads', contacts: [...] }
 */
exports.importContactsFromJson = async (req, res, next) => {
  try {
    const destination = String(req.body?.destination || '').trim().toLowerCase();
    if (!DESTINATIONS.has(destination)) {
      return res.status(400).json({
        success: false,
        message: "destination must be 'customers' or 'leads'",
      });
    }

    const contacts = Array.isArray(req.body?.contacts) ? req.body.contacts : [];
    const result = await importContacts(req, {
      destination,
      contacts,
      sourceHint: 'import_contacts',
      rowOffset: 1,
    });

    res.status(result.success ? 201 : 207).json({
      success: result.success,
      successCount: result.successCount,
      skippedCount: result.skippedCount,
      errorCount: result.errorCount,
      errors: result.errors,
      skipped: result.skipped,
    });
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ success: false, message: error.message });
    }
    next(error);
  }
};
