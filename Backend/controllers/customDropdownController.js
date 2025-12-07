const { CustomDropdownOption } = require('../models');
const { Op } = require('sequelize');

// Get all custom options for a specific dropdown type
exports.getCustomOptions = async (req, res) => {
  try {
    const { dropdownType } = req.params;
    
    const options = await CustomDropdownOption.findAll({
      where: {
        tenantId: req.tenantId,
        dropdownType,
        isActive: true
      },
      order: [['value', 'ASC']],
      attributes: ['id', 'value', 'label', 'createdAt']
    });

    res.json({
      success: true,
      data: options.map(opt => ({
        value: opt.value,
        label: opt.label || opt.value
      }))
    });
  } catch (error) {
    console.error('[CustomDropdown] Error fetching options:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch custom options' });
  }
};

// Save a new custom option
exports.saveCustomOption = async (req, res) => {
  try {
    const { dropdownType, value, label } = req.body;

    if (!dropdownType || !value || !value.trim()) {
      return res.status(400).json({ 
        success: false, 
        error: 'Dropdown type and value are required' 
      });
    }

    const trimmedValue = value.trim();

    // Check if option already exists (case-insensitive)
    const existing = await CustomDropdownOption.findOne({
      where: {
        tenantId: req.tenantId,
        dropdownType,
        value: {
          [Op.iLike]: trimmedValue // PostgreSQL case-insensitive match
        }
      }
    });

    if (existing) {
      // If exists but inactive, reactivate it and update case if different
      if (!existing.isActive) {
        await existing.update({ 
          isActive: true, 
          label: label || trimmedValue,
          value: trimmedValue // Update to preserve exact case entered
        });
        return res.json({
          success: true,
          data: {
            value: trimmedValue,
            label: label || trimmedValue
          },
          message: 'Option reactivated'
        });
      }
      // If already active, update case if different and return it
      if (existing.value !== trimmedValue) {
        await existing.update({ 
          value: trimmedValue,
          label: label || trimmedValue
        });
      }
      return res.json({
        success: true,
        data: {
          value: trimmedValue,
          label: label || trimmedValue
        },
        message: 'Option already exists'
      });
    }

    // Create new option
    const option = await CustomDropdownOption.create({
      tenantId: req.tenantId,
      dropdownType,
      value: trimmedValue,
      label: label || trimmedValue,
      isActive: true
    });

    res.json({
      success: true,
      data: {
        value: option.value,
        label: option.label || option.value
      },
      message: 'Custom option saved successfully'
    });
  } catch (error) {
    console.error('[CustomDropdown] Error saving option:', error);
    res.status(500).json({ success: false, error: 'Failed to save custom option' });
  }
};

// Get all custom options for multiple dropdown types (batch)
exports.getBatchCustomOptions = async (req, res) => {
  try {
    const { dropdownTypes } = req.body; // Array of dropdown types

    if (!Array.isArray(dropdownTypes) || dropdownTypes.length === 0) {
      return res.status(400).json({ 
        success: false, 
        error: 'dropdownTypes array is required' 
      });
    }

    const options = await CustomDropdownOption.findAll({
      where: {
        tenantId: req.tenantId,
        dropdownType: { [Op.in]: dropdownTypes },
        isActive: true
      },
      order: [['dropdownType', 'ASC'], ['value', 'ASC']],
      attributes: ['dropdownType', 'value', 'label']
    });

    // Group by dropdownType
    const grouped = {};
    options.forEach(opt => {
      if (!grouped[opt.dropdownType]) {
        grouped[opt.dropdownType] = [];
      }
      grouped[opt.dropdownType].push({
        value: opt.value,
        label: opt.label || opt.value
      });
    });

    res.json({
      success: true,
      data: grouped
    });
  } catch (error) {
    console.error('[CustomDropdown] Error fetching batch options:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch custom options' });
  }
};

