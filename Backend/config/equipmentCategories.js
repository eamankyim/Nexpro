/**
 * Default equipment categories used when seeding a new tenant.
 * Same list for all business types (shop, studio, pharmacy).
 */

const DEFAULT_EQUIPMENT_CATEGORIES = [
  { name: 'Furniture', description: 'Desks, chairs, shelves, cabinets' },
  { name: 'IT & Electronics', description: 'Computers, monitors, printers, phones' },
  { name: 'Vehicles', description: 'Cars, vans, bikes' },
  { name: 'Machinery', description: 'Production or workshop machinery' },
  { name: 'Office Equipment', description: 'Printers, copiers, projectors' },
  { name: 'Tools & Equipment', description: 'Hand tools, power tools' },
  { name: 'Other', description: 'Miscellaneous equipment' }
];

module.exports = {
  DEFAULT_EQUIPMENT_CATEGORIES
};
