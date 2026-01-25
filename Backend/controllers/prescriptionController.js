const { Prescription, PrescriptionItem, Drug, Customer, Pharmacy, Invoice, User, DrugInteraction } = require('../models');
const { Op } = require('sequelize');
const config = require('../config/config');
const { applyTenantFilter, sanitizePayload } = require('../utils/tenantUtils');
const { sequelize } = require('../config/database');
const crypto = require('crypto');

// Generate unique prescription number
const generatePrescriptionNumber = async (tenantId) => {
  const prefix = 'RX';
  const today = new Date();
  const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');
  
  const startOfDay = new Date(today.setHours(0, 0, 0, 0));
  const endOfDay = new Date(today.setHours(23, 59, 59, 999));
  
  const count = await Prescription.count({
    where: {
      tenantId,
      createdAt: {
        [Op.between]: [startOfDay, endOfDay]
      }
    }
  });
  
  const sequence = String(count + 1).padStart(4, '0');
  return `${prefix}-${dateStr}-${sequence}`;
};

// @desc    Get all prescriptions
// @route   GET /api/prescriptions
// @access  Private
exports.getPrescriptions = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || config.pagination.defaultPageSize;
    const offset = (page - 1) * limit;
    const pharmacyId = req.query.pharmacyId;
    const customerId = req.query.customerId;
    const status = req.query.status;

    const where = applyTenantFilter(req.tenantId, {});
    if (pharmacyId) {
      where.pharmacyId = pharmacyId;
    }
    if (customerId) {
      where.customerId = customerId;
    }
    if (status) {
      where.status = status;
    }

    const { count, rows } = await Prescription.findAndCountAll({
      where,
      limit,
      offset,
      include: [
        { model: Pharmacy, as: 'pharmacy', attributes: ['id', 'name'] },
        { model: Customer, as: 'customer', attributes: ['id', 'name', 'phone'] },
        { model: User, as: 'filler', attributes: ['id', 'name'] }
      ],
      order: [['createdAt', 'DESC']]
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

// @desc    Get single prescription
// @route   GET /api/prescriptions/:id
// @access  Private
exports.getPrescription = async (req, res, next) => {
  try {
    const prescription = await Prescription.findOne({
      where: applyTenantFilter(req.tenantId, { id: req.params.id }),
      include: [
        { model: Pharmacy, as: 'pharmacy' },
        { model: Customer, as: 'customer' },
        { model: User, as: 'filler' },
        { model: Invoice, as: 'invoice' },
        {
          model: PrescriptionItem,
          as: 'items',
          include: [
            { model: Drug, as: 'drug' }
          ]
        }
      ]
    });

    if (!prescription) {
      return res.status(404).json({
        success: false,
        message: 'Prescription not found'
      });
    }

    res.status(200).json({
      success: true,
      data: prescription
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Create new prescription
// @route   POST /api/prescriptions
// @access  Private
exports.createPrescription = async (req, res, next) => {
  try {
    const { items, ...prescriptionData } = sanitizePayload(req.body);
    
    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Prescription must have at least one item'
      });
    }

    // Generate prescription number
    const prescriptionNumber = await generatePrescriptionNumber(req.tenantId);

    // Calculate total
    let totalAmount = 0;
    items.forEach(item => {
      const itemTotal = (item.quantity || 0) * (item.unitPrice || 0);
      totalAmount += itemTotal;
    });

    // Create prescription
    const prescription = await Prescription.create({
      ...prescriptionData,
      tenantId: req.tenantId,
      prescriptionNumber,
      totalAmount,
      status: 'pending'
    });

    // Create prescription items
    for (const item of items) {
      await PrescriptionItem.create({
        prescriptionId: prescription.id,
        drugId: item.drugId,
        drugName: item.drugName,
        strength: item.strength,
        form: item.form,
        quantity: item.quantity,
        unit: item.unit || 'pcs',
        dosage: item.dosage,
        duration: item.duration,
        instructions: item.instructions,
        unitPrice: item.unitPrice,
        totalPrice: (item.quantity || 0) * (item.unitPrice || 0),
        status: 'pending'
      });
    }

    // Fetch prescription with relations
    const createdPrescription = await Prescription.findByPk(prescription.id, {
      include: [
        { model: Pharmacy, as: 'pharmacy' },
        { model: Customer, as: 'customer' },
        {
          model: PrescriptionItem,
          as: 'items',
          include: [
            { model: Drug, as: 'drug' }
          ]
        }
      ]
    });

    res.status(201).json({
      success: true,
      data: createdPrescription
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Fill prescription
// @route   POST /api/prescriptions/:id/fill
// @access  Private
exports.fillPrescription = async (req, res, next) => {
  const transaction = await sequelize.transaction();
  
  try {
    const prescription = await Prescription.findOne({
      where: applyTenantFilter(req.tenantId, { id: req.params.id }),
      include: [{ model: PrescriptionItem, as: 'items' }]
    }, { transaction });

    if (!prescription) {
      await transaction.rollback();
      return res.status(404).json({
        success: false,
        message: 'Prescription not found'
      });
    }

    if (prescription.status === 'filled' || prescription.status === 'cancelled') {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: 'Prescription is already filled or cancelled'
      });
    }

    // Check drug interactions
    const drugIds = prescription.items.map(item => item.drugId).filter(Boolean);
    if (drugIds.length > 1) {
      const interactions = await DrugInteraction.findAll({
        where: {
          tenantId: req.tenantId,
          [Op.or]: [
            { drug1Id: { [Op.in]: drugIds }, drug2Id: { [Op.in]: drugIds } }
          ]
        }
      });

      if (interactions.length > 0) {
        await transaction.rollback();
        return res.status(400).json({
          success: false,
          message: 'Drug interactions detected',
          interactions: interactions.map(i => ({
            type: i.interactionType,
            severity: i.severity,
            description: i.description
          }))
        });
      }
    }

    // Fill items and update drug stock
    let totalAmount = 0;
    let allFilled = true;
    let partiallyFilled = false;

    for (const item of prescription.items) {
      const drug = await Drug.findByPk(item.drugId, { transaction });
      
      if (!drug) {
        await item.update({ status: 'unavailable' }, { transaction });
        allFilled = false;
        continue;
      }

      const availableQuantity = parseFloat(drug.quantityOnHand);
      const requiredQuantity = parseFloat(item.quantity);

      if (availableQuantity >= requiredQuantity) {
        // Fully fill
        const newQuantity = availableQuantity - requiredQuantity;
        await drug.update({ quantityOnHand: newQuantity }, { transaction });
        await item.update({
          quantityFilled: requiredQuantity,
          status: 'filled',
          totalPrice: requiredQuantity * parseFloat(item.unitPrice)
        }, { transaction });
        totalAmount += requiredQuantity * parseFloat(item.unitPrice);
      } else if (availableQuantity > 0) {
        // Partially fill
        await drug.update({ quantityOnHand: 0 }, { transaction });
        await item.update({
          quantityFilled: availableQuantity,
          status: 'partially_filled',
          totalPrice: availableQuantity * parseFloat(item.unitPrice)
        }, { transaction });
        totalAmount += availableQuantity * parseFloat(item.unitPrice);
        allFilled = false;
        partiallyFilled = true;
      } else {
        // Unavailable
        await item.update({ status: 'unavailable' }, { transaction });
        allFilled = false;
      }
    }

    // Update prescription status
    let newStatus = 'filled';
    if (partiallyFilled) {
      newStatus = 'partially_filled';
    } else if (!allFilled) {
      newStatus = 'pending';
    }

    await prescription.update({
      status: newStatus,
      totalAmount,
      filledBy: req.user.id,
      filledAt: new Date()
    }, { transaction });

    await transaction.commit();

    // Fetch updated prescription
    const updatedPrescription = await Prescription.findByPk(prescription.id, {
      include: [
        { model: Pharmacy, as: 'pharmacy' },
        { model: Customer, as: 'customer' },
        { model: User, as: 'filler' },
        {
          model: PrescriptionItem,
          as: 'items',
          include: [
            { model: Drug, as: 'drug' }
          ]
        }
      ]
    });

    res.status(200).json({
      success: true,
      data: updatedPrescription,
      message: `Prescription ${newStatus === 'filled' ? 'filled' : 'partially filled'}`
    });
  } catch (error) {
    await transaction.rollback();
    next(error);
  }
};

// @desc    Update prescription
// @route   PUT /api/prescriptions/:id
// @access  Private
exports.updatePrescription = async (req, res, next) => {
  try {
    const prescription = await Prescription.findOne({
      where: applyTenantFilter(req.tenantId, { id: req.params.id })
    });

    if (!prescription) {
      return res.status(404).json({
        success: false,
        message: 'Prescription not found'
      });
    }

    // Only allow updating certain fields if not filled
    if (prescription.status === 'filled') {
      return res.status(400).json({
        success: false,
        message: 'Cannot update filled prescription'
      });
    }

    const allowedFields = ['prescriberName', 'prescriberLicense', 'prescriberPhone', 'prescriptionDate', 'expiryDate', 'notes', 'metadata'];
    const payload = sanitizePayload(req.body);
    const updateData = {};
    
    allowedFields.forEach(field => {
      if (payload[field] !== undefined) {
        updateData[field] = payload[field];
      }
    });

    await prescription.update(updateData);

    res.status(200).json({
      success: true,
      data: prescription
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Check drug interactions
// @route   POST /api/prescriptions/check-interactions
// @access  Private
exports.checkDrugInteractions = async (req, res, next) => {
  try {
    const { drugIds } = req.body;

    if (!drugIds || !Array.isArray(drugIds) || drugIds.length < 2) {
      return res.status(400).json({
        success: false,
        message: 'At least two drug IDs are required'
      });
    }

    const interactions = await DrugInteraction.findAll({
      where: {
        tenantId: req.tenantId,
        [Op.or]: [
          { drug1Id: { [Op.in]: drugIds }, drug2Id: { [Op.in]: drugIds } }
        ],
        isActive: true
      },
      include: [
        { model: Drug, as: 'drug1', attributes: ['id', 'name', 'genericName'] },
        { model: Drug, as: 'drug2', attributes: ['id', 'name', 'genericName'] }
      ]
    });

    res.status(200).json({
      success: true,
      count: interactions.length,
      data: interactions
    });
  } catch (error) {
    next(error);
  }
};

// Helper function to generate invoice number
const generateInvoiceNumber = async (tenantId) => {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  
  const lastInvoice = await Invoice.findOne({
    where: {
      tenantId,
      invoiceNumber: {
        [Op.like]: `INV-${year}${month}%`
      }
    },
    order: [['createdAt', 'DESC']]
  });

  let sequence = 1;
  if (lastInvoice) {
    const lastSequence = parseInt(lastInvoice.invoiceNumber.split('-').pop());
    sequence = lastSequence + 1;
  }

  return `INV-${year}${month}-${String(sequence).padStart(4, '0')}`;
};

// @desc    Generate invoice from prescription
// @route   POST /api/prescriptions/:id/generate-invoice
// @access  Private
exports.generateInvoice = async (req, res, next) => {
  try {
    const prescription = await Prescription.findOne({
      where: applyTenantFilter(req.tenantId, { id: req.params.id }),
      include: [
        { model: PrescriptionItem, as: 'items', include: [{ model: Drug, as: 'drug' }] },
        { model: Customer, as: 'customer' },
        { model: Pharmacy, as: 'pharmacy' }
      ]
    });

    if (!prescription) {
      return res.status(404).json({
        success: false,
        message: 'Prescription not found'
      });
    }

    if (prescription.status !== 'filled' && prescription.status !== 'partially_filled') {
      return res.status(400).json({
        success: false,
        message: 'Prescription must be filled or partially filled before generating invoice'
      });
    }

    // Check if invoice already exists for this prescription
    const existingInvoice = await Invoice.findOne({
      where: applyTenantFilter(req.tenantId, { prescriptionId: prescription.id })
    });

    if (existingInvoice) {
      return res.status(400).json({
        success: false,
        message: 'Invoice already exists for this prescription',
        data: existingInvoice
      });
    }

    // Generate invoice number
    const invoiceNumber = await generateInvoiceNumber(req.tenantId);

    // Calculate totals from prescription items
    let subtotal = 0;
    const items = prescription.items
      .filter(item => item.status === 'filled' || item.status === 'partially_filled')
      .map(item => {
        const quantity = parseFloat(item.quantityFilled || item.quantity);
        const unitPrice = parseFloat(item.unitPrice || 0);
        const total = quantity * unitPrice;
        subtotal += total;
        
        return {
          description: `${item.drugName} - ${item.dosageInstructions}`,
          quantity,
          unitPrice,
          total
        };
      });

    if (items.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No filled items found in prescription'
      });
    }

    // Create invoice
    const invoice = await Invoice.create({
      invoiceNumber,
      prescriptionId: prescription.id,
      customerId: prescription.customerId || null,
      tenantId: req.tenantId,
      sourceType: 'prescription',
      invoiceDate: prescription.filledAt || prescription.prescriptionDate || new Date(),
      dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // Default 30 days
      subtotal,
      taxRate: 0,
      discountType: 'fixed',
      discountValue: 0,
      discountAmount: 0,
      totalAmount: subtotal,
      paymentTerms: 'Due on Receipt',
      items,
      notes: `Invoice generated from prescription ${prescription.prescriptionNumber || prescription.id}`,
      termsAndConditions: 'Payment is due upon receipt. Thank you for your business.',
      paymentToken: crypto.randomBytes(32).toString('hex')
    });

    const createdInvoice = await Invoice.findByPk(invoice.id, {
      include: [
        { model: Customer, as: 'customer' },
        { model: Prescription, as: 'prescription' }
      ]
    });

    res.status(201).json({
      success: true,
      message: 'Invoice generated successfully',
      data: createdInvoice
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Print prescription label
// @route   GET /api/prescriptions/:id/label
// @access  Private
exports.printLabel = async (req, res, next) => {
  try {
    const prescription = await Prescription.findOne({
      where: applyTenantFilter(req.tenantId, { id: req.params.id }),
      include: [
        { model: PrescriptionItem, as: 'items', include: [{ model: Drug, as: 'drug' }] },
        { model: Customer, as: 'customer' },
        { model: Pharmacy, as: 'pharmacy' }
      ]
    });

    if (!prescription) {
      return res.status(404).json({
        success: false,
        message: 'Prescription not found'
      });
    }

    // Return label data (frontend will handle printing)
    res.status(200).json({
      success: true,
      data: {
        prescription,
        label: {
          prescriptionNumber: prescription.prescriptionNumber || prescription.id,
          date: prescription.prescriptionDate,
          filledAt: prescription.filledAt,
          pharmacy: prescription.pharmacy,
          patientName: prescription.customer?.name || 'N/A',
          doctorName: prescription.prescriberName,
          items: prescription.items.map(item => ({
            drugName: item.drugName,
            quantity: item.quantity,
            dosageInstructions: item.dosageInstructions,
            refills: item.refills
          })),
          notes: prescription.notes
        }
      }
    });
  } catch (error) {
    next(error);
  }
};
