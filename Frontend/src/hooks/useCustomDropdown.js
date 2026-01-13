import { useState, useEffect, useCallback } from 'react';
import { message } from 'antd';
import customDropdownService from '../services/customDropdownService';

/**
 * Custom hook for managing dropdowns with "Other" option
 * 
 * @param {string} dropdownType - Type of dropdown (e.g., 'job_category', 'customer_source')
 * @param {Array} defaultOptions - Default options array (can be flat or grouped)
 * @param {boolean} isGrouped - Whether defaultOptions is grouped (OptGroup structure)
 * @returns {Object} - { options, loading, handleOtherSelect, handleCustomValueSave }
 */
export const useCustomDropdown = (dropdownType, defaultOptions = [], isGrouped = false) => {
  const [customOptions, setCustomOptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [customValue, setCustomValue] = useState('');

  // Load custom options on mount
  useEffect(() => {
    const loadCustomOptions = async () => {
      try {
        setLoading(true);
        const options = await customDropdownService.getCustomOptions(dropdownType);
        setCustomOptions(options);
      } catch (error) {
        console.error(`[useCustomDropdown] Error loading ${dropdownType}:`, error);
      } finally {
        setLoading(false);
      }
    };

    if (dropdownType) {
      loadCustomOptions();
    }
  }, [dropdownType]);

  // Merge default and custom options
  const getMergedOptions = useCallback(() => {
    if (isGrouped) {
      // For grouped options, add custom options to an "Other" group or create one
      const merged = [...defaultOptions];
      
      // Find or create "Other" OptGroup
      let otherGroup = merged.find(group => group.label === 'Other' || group.label === 'Custom');
      
      if (!otherGroup && customOptions.length > 0) {
        // Create "Other" group
        otherGroup = {
          label: 'Custom',
          options: []
        };
        merged.push(otherGroup);
      }
      
      // Add custom options to the group
      if (otherGroup && customOptions.length > 0) {
        customOptions.forEach(opt => {
          if (!otherGroup.options.find(o => o.value === opt.value)) {
            otherGroup.options.push({
              value: opt.value,
              label: opt.label
            });
          }
        });
      }
      
      // Add "Other" option to the last group
      if (otherGroup) {
        if (!otherGroup.options.find(o => o.value === '__OTHER__')) {
          otherGroup.options.push({
            value: '__OTHER__',
            label: 'Other (specify)'
          });
        }
      } else {
        // No custom options yet, add "Other" to a new group
        merged.push({
          label: 'Other',
          options: [{
            value: '__OTHER__',
            label: 'Other (specify)'
          }]
        });
      }
      
      return merged;
    } else {
      // Flat options structure
      const merged = [...defaultOptions];
      
      // Add custom options
      customOptions.forEach(opt => {
        if (!merged.find(o => o.value === opt.value)) {
          merged.push({
            value: opt.value,
            label: opt.label
          });
        }
      });
      
      // Add "Other" option
      if (!merged.find(o => o.value === '__OTHER__')) {
        merged.push({
          value: '__OTHER__',
          label: 'Other (specify)'
        });
      }
      
      return merged;
    }
  }, [defaultOptions, customOptions, isGrouped]);

  // Handle when "Other" is selected
  const handleOtherSelect = useCallback((value) => {
    if (value === '__OTHER__') {
      setShowCustomInput(true);
    } else {
      setShowCustomInput(false);
      setCustomValue('');
    }
  }, []);

  // Save custom value
  const handleCustomValueSave = useCallback(async (value) => {
    if (!value || !value.trim()) {
      message.warning('Please enter a value');
      return null;
    }

    try {
      const saved = await customDropdownService.saveCustomOption(dropdownType, value.trim(), value.trim());
      
      if (saved) {
        // Add to custom options
        setCustomOptions(prev => {
          if (prev.find(o => o.value === saved.value)) {
            return prev;
          }
          return [...prev, saved];
        });
        
        message.success(`"${saved.label}" added to options`);
        setShowCustomInput(false);
        setCustomValue('');
        return saved.value; // Return the value to set in the form
      }
      
      return null;
    } catch (error) {
      message.error(error.response?.data?.error || 'Failed to save custom option');
      return null;
    }
  }, [dropdownType]);

  return {
    options: getMergedOptions(),
    customOptions,
    loading,
    showCustomInput,
    customValue,
    setCustomValue,
    handleOtherSelect,
    handleCustomValueSave,
    refreshOptions: async () => {
      try {
        const options = await customDropdownService.getCustomOptions(dropdownType);
        setCustomOptions(options);
      } catch (error) {
        console.error(`[useCustomDropdown] Error refreshing ${dropdownType}:`, error);
      }
    }
  };
};

export default useCustomDropdown;



