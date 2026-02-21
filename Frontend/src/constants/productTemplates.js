/**
 * Product Templates by Shop Type
 * 
 * Pre-built product templates for quick-add functionality.
 * Templates include common products found in African markets
 * with suggested categories, units, and typical price ranges.
 */

import { SHOP_TYPES } from './index';

// Supermarket/Grocery Templates
const SUPERMARKET_TEMPLATES = [
  // Grains & Staples
  { name: 'Rice (50kg bag)', unit: 'bag', category: 'Grains & Staples', suggestedCost: 300, suggestedPrice: 350 },
  { name: 'Rice (25kg bag)', unit: 'bag', category: 'Grains & Staples', suggestedCost: 160, suggestedPrice: 190 },
  { name: 'Rice (5kg bag)', unit: 'bag', category: 'Grains & Staples', suggestedCost: 35, suggestedPrice: 45 },
  { name: 'Flour (50kg bag)', unit: 'bag', category: 'Grains & Staples', suggestedCost: 280, suggestedPrice: 320 },
  { name: 'Sugar (50kg bag)', unit: 'bag', category: 'Grains & Staples', suggestedCost: 350, suggestedPrice: 400 },
  { name: 'Sugar (1kg)', unit: 'pcs', category: 'Grains & Staples', suggestedCost: 8, suggestedPrice: 10 },
  { name: 'Maize/Corn (bag)', unit: 'bag', category: 'Grains & Staples', suggestedCost: 200, suggestedPrice: 250 },
  { name: 'Beans (bag)', unit: 'bag', category: 'Grains & Staples', suggestedCost: 400, suggestedPrice: 480 },
  
  // Cooking Essentials
  { name: 'Cooking Oil (5L)', unit: 'pcs', category: 'Cooking Essentials', suggestedCost: 70, suggestedPrice: 85 },
  { name: 'Cooking Oil (25L)', unit: 'pcs', category: 'Cooking Essentials', suggestedCost: 320, suggestedPrice: 380 },
  { name: 'Palm Oil (5L)', unit: 'pcs', category: 'Cooking Essentials', suggestedCost: 80, suggestedPrice: 95 },
  { name: 'Groundnut Oil (5L)', unit: 'pcs', category: 'Cooking Essentials', suggestedCost: 100, suggestedPrice: 120 },
  { name: 'Salt (1kg)', unit: 'pcs', category: 'Cooking Essentials', suggestedCost: 2, suggestedPrice: 3 },
  { name: 'Tomato Paste (Tin)', unit: 'pcs', category: 'Cooking Essentials', suggestedCost: 12, suggestedPrice: 15 },
  { name: 'Tomato Paste (Sachet)', unit: 'sachet', category: 'Cooking Essentials', suggestedCost: 1, suggestedPrice: 2 },
  
  // Beverages
  { name: 'Milo (400g)', unit: 'pcs', category: 'Beverages', suggestedCost: 35, suggestedPrice: 42 },
  { name: 'Milo (1kg)', unit: 'pcs', category: 'Beverages', suggestedCost: 75, suggestedPrice: 90 },
  { name: 'Nescafe (200g)', unit: 'pcs', category: 'Beverages', suggestedCost: 45, suggestedPrice: 55 },
  { name: 'Tea Bags (Box of 100)', unit: 'box', category: 'Beverages', suggestedCost: 20, suggestedPrice: 25 },
  { name: 'Evaporated Milk (Tin)', unit: 'pcs', category: 'Beverages', suggestedCost: 15, suggestedPrice: 18 },
  { name: 'Peak Milk (Sachet)', unit: 'sachet', category: 'Beverages', suggestedCost: 2, suggestedPrice: 3 },
  
  // Toiletries
  { name: 'Toilet Paper (Pack of 12)', unit: 'pack', category: 'Toiletries', suggestedCost: 35, suggestedPrice: 45 },
  { name: 'Detergent (1kg)', unit: 'pcs', category: 'Toiletries', suggestedCost: 12, suggestedPrice: 15 },
  { name: 'Bar Soap (Carton)', unit: 'carton', category: 'Toiletries', suggestedCost: 60, suggestedPrice: 75 },
  { name: 'Toothpaste', unit: 'pcs', category: 'Toiletries', suggestedCost: 8, suggestedPrice: 12 },
];

// Convenience Store Templates
const CONVENIENCE_TEMPLATES = [
  // Soft Drinks
  { name: 'Coca-Cola (500ml)', unit: 'pcs', category: 'Soft Drinks', suggestedCost: 4, suggestedPrice: 6 },
  { name: 'Coca-Cola (1.5L)', unit: 'pcs', category: 'Soft Drinks', suggestedCost: 8, suggestedPrice: 12 },
  { name: 'Fanta (500ml)', unit: 'pcs', category: 'Soft Drinks', suggestedCost: 4, suggestedPrice: 6 },
  { name: 'Sprite (500ml)', unit: 'pcs', category: 'Soft Drinks', suggestedCost: 4, suggestedPrice: 6 },
  { name: 'Malta Guinness', unit: 'pcs', category: 'Soft Drinks', suggestedCost: 5, suggestedPrice: 8 },
  { name: 'Energy Drink', unit: 'pcs', category: 'Soft Drinks', suggestedCost: 6, suggestedPrice: 10 },
  { name: 'Water (500ml)', unit: 'pcs', category: 'Soft Drinks', suggestedCost: 1, suggestedPrice: 2 },
  { name: 'Water (1.5L)', unit: 'pcs', category: 'Soft Drinks', suggestedCost: 2, suggestedPrice: 4 },
  
  // Snacks
  { name: 'Biscuits (Pack)', unit: 'pack', category: 'Snacks', suggestedCost: 3, suggestedPrice: 5 },
  { name: 'Chin Chin (Pack)', unit: 'pack', category: 'Snacks', suggestedCost: 5, suggestedPrice: 8 },
  { name: 'Plantain Chips', unit: 'pack', category: 'Snacks', suggestedCost: 4, suggestedPrice: 6 },
  { name: 'Gala Sausage Roll', unit: 'pcs', category: 'Snacks', suggestedCost: 3, suggestedPrice: 5 },
  { name: 'Peanuts (Pack)', unit: 'pack', category: 'Snacks', suggestedCost: 2, suggestedPrice: 4 },
  
  // Quick Items
  { name: 'Bread (Loaf)', unit: 'pcs', category: 'Bakery', suggestedCost: 8, suggestedPrice: 12 },
  { name: 'Eggs (Crate of 30)', unit: 'crate', category: 'Dairy & Eggs', suggestedCost: 35, suggestedPrice: 45 },
  { name: 'Sachet Water (Bag)', unit: 'bag', category: 'Beverages', suggestedCost: 8, suggestedPrice: 12 },
  { name: 'Airtime/Recharge Card', unit: 'pcs', category: 'Telecom', suggestedCost: 0, suggestedPrice: 0 },
];

// Electronics Store Templates
const ELECTRONICS_TEMPLATES = [
  // Phones & Accessories
  { name: 'Smartphone (Budget)', unit: 'pcs', category: 'Phones', suggestedCost: 500, suggestedPrice: 650, hasWarranty: true, warrantyPeriod: 12 },
  { name: 'Smartphone (Mid-range)', unit: 'pcs', category: 'Phones', suggestedCost: 1500, suggestedPrice: 1900, hasWarranty: true, warrantyPeriod: 12 },
  { name: 'Feature Phone', unit: 'pcs', category: 'Phones', suggestedCost: 80, suggestedPrice: 120, hasWarranty: true, warrantyPeriod: 6 },
  { name: 'Phone Charger', unit: 'pcs', category: 'Phone Accessories', suggestedCost: 15, suggestedPrice: 25 },
  { name: 'Phone Case', unit: 'pcs', category: 'Phone Accessories', suggestedCost: 10, suggestedPrice: 20 },
  { name: 'Screen Protector', unit: 'pcs', category: 'Phone Accessories', suggestedCost: 5, suggestedPrice: 15 },
  { name: 'Earphones/Headphones', unit: 'pcs', category: 'Phone Accessories', suggestedCost: 20, suggestedPrice: 35 },
  { name: 'Bluetooth Speaker', unit: 'pcs', category: 'Audio', suggestedCost: 100, suggestedPrice: 150, hasWarranty: true, warrantyPeriod: 6 },
  
  // Computing
  { name: 'Laptop (Budget)', unit: 'pcs', category: 'Computers', suggestedCost: 2500, suggestedPrice: 3200, hasWarranty: true, warrantyPeriod: 12 },
  { name: 'Desktop Computer', unit: 'pcs', category: 'Computers', suggestedCost: 2000, suggestedPrice: 2600, hasWarranty: true, warrantyPeriod: 12 },
  { name: 'Computer Mouse', unit: 'pcs', category: 'Computer Accessories', suggestedCost: 15, suggestedPrice: 30 },
  { name: 'Computer Keyboard', unit: 'pcs', category: 'Computer Accessories', suggestedCost: 30, suggestedPrice: 50 },
  { name: 'USB Flash Drive (32GB)', unit: 'pcs', category: 'Storage', suggestedCost: 20, suggestedPrice: 35 },
  { name: 'External Hard Drive', unit: 'pcs', category: 'Storage', suggestedCost: 250, suggestedPrice: 350, hasWarranty: true, warrantyPeriod: 12 },
  
  // Home Electronics
  { name: 'Television (32")', unit: 'pcs', category: 'TV & Video', suggestedCost: 800, suggestedPrice: 1100, hasWarranty: true, warrantyPeriod: 12 },
  { name: 'Television (43")', unit: 'pcs', category: 'TV & Video', suggestedCost: 1500, suggestedPrice: 2000, hasWarranty: true, warrantyPeriod: 12 },
  { name: 'DVD Player', unit: 'pcs', category: 'TV & Video', suggestedCost: 80, suggestedPrice: 120, hasWarranty: true, warrantyPeriod: 6 },
  { name: 'Standing Fan', unit: 'pcs', category: 'Home Appliances', suggestedCost: 150, suggestedPrice: 220, hasWarranty: true, warrantyPeriod: 12 },
  { name: 'Blender', unit: 'pcs', category: 'Home Appliances', suggestedCost: 100, suggestedPrice: 150, hasWarranty: true, warrantyPeriod: 12 },
  { name: 'Electric Kettle', unit: 'pcs', category: 'Home Appliances', suggestedCost: 50, suggestedPrice: 80, hasWarranty: true, warrantyPeriod: 6 },
  { name: 'Iron', unit: 'pcs', category: 'Home Appliances', suggestedCost: 60, suggestedPrice: 90, hasWarranty: true, warrantyPeriod: 12 },
];

// Hardware Store Templates
const HARDWARE_TEMPLATES = [
  // Building Materials
  { name: 'Cement (50kg bag)', unit: 'bag', category: 'Building Materials', suggestedCost: 65, suggestedPrice: 75 },
  { name: 'Sand (Tipper Load)', unit: 'pcs', category: 'Building Materials', suggestedCost: 800, suggestedPrice: 1000 },
  { name: 'Gravel (Tipper Load)', unit: 'pcs', category: 'Building Materials', suggestedCost: 1200, suggestedPrice: 1500 },
  { name: 'Iron Rod (12mm)', unit: 'pcs', category: 'Building Materials', suggestedCost: 35, suggestedPrice: 45 },
  { name: 'Iron Rod (16mm)', unit: 'pcs', category: 'Building Materials', suggestedCost: 60, suggestedPrice: 75 },
  { name: 'Roofing Sheet (Long Span)', unit: 'pcs', category: 'Roofing', suggestedCost: 45, suggestedPrice: 60 },
  { name: 'Roofing Nails (kg)', unit: 'kg', category: 'Roofing', suggestedCost: 15, suggestedPrice: 20 },
  
  // Plumbing
  { name: 'PVC Pipe (1 inch)', unit: 'pcs', category: 'Plumbing', suggestedCost: 20, suggestedPrice: 30 },
  { name: 'PVC Pipe (2 inch)', unit: 'pcs', category: 'Plumbing', suggestedCost: 35, suggestedPrice: 50 },
  { name: 'PVC Elbow', unit: 'pcs', category: 'Plumbing', suggestedCost: 3, suggestedPrice: 5 },
  { name: 'Water Tank (1000L)', unit: 'pcs', category: 'Plumbing', suggestedCost: 400, suggestedPrice: 550 },
  { name: 'Water Tap', unit: 'pcs', category: 'Plumbing', suggestedCost: 15, suggestedPrice: 25 },
  
  // Electrical
  { name: 'Electrical Wire (Roll)', unit: 'roll', category: 'Electrical', suggestedCost: 150, suggestedPrice: 200 },
  { name: 'Light Bulb (LED)', unit: 'pcs', category: 'Electrical', suggestedCost: 8, suggestedPrice: 15 },
  { name: 'Socket/Outlet', unit: 'pcs', category: 'Electrical', suggestedCost: 10, suggestedPrice: 18 },
  { name: 'Switch', unit: 'pcs', category: 'Electrical', suggestedCost: 8, suggestedPrice: 15 },
  { name: 'Circuit Breaker', unit: 'pcs', category: 'Electrical', suggestedCost: 25, suggestedPrice: 40 },
  
  // Paint & Finishing
  { name: 'Paint (4L)', unit: 'pcs', category: 'Paint & Finishing', suggestedCost: 60, suggestedPrice: 85 },
  { name: 'Paint (20L)', unit: 'pcs', category: 'Paint & Finishing', suggestedCost: 250, suggestedPrice: 320 },
  { name: 'Paint Brush', unit: 'pcs', category: 'Paint & Finishing', suggestedCost: 8, suggestedPrice: 15 },
  { name: 'Paint Roller', unit: 'pcs', category: 'Paint & Finishing', suggestedCost: 15, suggestedPrice: 25 },
  { name: 'Wall Filler/Putty', unit: 'pcs', category: 'Paint & Finishing', suggestedCost: 30, suggestedPrice: 45 },
  
  // Tools
  { name: 'Hammer', unit: 'pcs', category: 'Tools', suggestedCost: 25, suggestedPrice: 40 },
  { name: 'Screwdriver Set', unit: 'set', category: 'Tools', suggestedCost: 30, suggestedPrice: 50 },
  { name: 'Pliers', unit: 'pcs', category: 'Tools', suggestedCost: 15, suggestedPrice: 25 },
  { name: 'Measuring Tape', unit: 'pcs', category: 'Tools', suggestedCost: 10, suggestedPrice: 18 },
  { name: 'Nails (1kg)', unit: 'kg', category: 'Fasteners', suggestedCost: 8, suggestedPrice: 12 },
  { name: 'Screws (Pack)', unit: 'pack', category: 'Fasteners', suggestedCost: 5, suggestedPrice: 10 },
];

// Clothing Store Templates
const CLOTHING_TEMPLATES = [
  // Men's Wear
  { name: 'T-Shirt (Men)', unit: 'pcs', category: "Men's Wear", suggestedCost: 25, suggestedPrice: 45, hasVariants: true },
  { name: 'Polo Shirt (Men)', unit: 'pcs', category: "Men's Wear", suggestedCost: 40, suggestedPrice: 70, hasVariants: true },
  { name: 'Jeans (Men)', unit: 'pcs', category: "Men's Wear", suggestedCost: 60, suggestedPrice: 100, hasVariants: true },
  { name: 'Trousers (Men)', unit: 'pcs', category: "Men's Wear", suggestedCost: 50, suggestedPrice: 85, hasVariants: true },
  { name: 'Shirt (Men)', unit: 'pcs', category: "Men's Wear", suggestedCost: 45, suggestedPrice: 80, hasVariants: true },
  { name: 'African Print Shirt', unit: 'pcs', category: "Men's Wear", suggestedCost: 60, suggestedPrice: 120, hasVariants: true },
  
  // Women's Wear
  { name: 'Dress', unit: 'pcs', category: "Women's Wear", suggestedCost: 50, suggestedPrice: 95, hasVariants: true },
  { name: 'Blouse', unit: 'pcs', category: "Women's Wear", suggestedCost: 30, suggestedPrice: 55, hasVariants: true },
  { name: 'Skirt', unit: 'pcs', category: "Women's Wear", suggestedCost: 35, suggestedPrice: 60, hasVariants: true },
  { name: 'Jeans (Women)', unit: 'pcs', category: "Women's Wear", suggestedCost: 55, suggestedPrice: 95, hasVariants: true },
  { name: 'African Print Dress', unit: 'pcs', category: "Women's Wear", suggestedCost: 80, suggestedPrice: 150, hasVariants: true },
  { name: 'Ankara Fabric (6 yards)', unit: 'pcs', category: 'Fabrics', suggestedCost: 40, suggestedPrice: 70 },
  
  // Footwear
  { name: 'Sneakers', unit: 'pair', category: 'Footwear', suggestedCost: 80, suggestedPrice: 150, hasVariants: true },
  { name: 'Sandals', unit: 'pair', category: 'Footwear', suggestedCost: 30, suggestedPrice: 55, hasVariants: true },
  { name: 'Formal Shoes', unit: 'pair', category: 'Footwear', suggestedCost: 100, suggestedPrice: 180, hasVariants: true },
  { name: 'Slippers', unit: 'pair', category: 'Footwear', suggestedCost: 15, suggestedPrice: 30, hasVariants: true },
  
  // Accessories
  { name: 'Belt', unit: 'pcs', category: 'Accessories', suggestedCost: 15, suggestedPrice: 30 },
  { name: 'Cap/Hat', unit: 'pcs', category: 'Accessories', suggestedCost: 12, suggestedPrice: 25 },
  { name: 'Bag/Handbag', unit: 'pcs', category: 'Accessories', suggestedCost: 50, suggestedPrice: 95 },
  { name: 'Wristwatch', unit: 'pcs', category: 'Accessories', suggestedCost: 40, suggestedPrice: 80 },
];

// Beauty/Cosmetics Store Templates
const BEAUTY_TEMPLATES = [
  // Hair Care
  { name: 'Hair Relaxer', unit: 'pcs', category: 'Hair Care', suggestedCost: 15, suggestedPrice: 25 },
  { name: 'Shampoo', unit: 'pcs', category: 'Hair Care', suggestedCost: 12, suggestedPrice: 20 },
  { name: 'Hair Conditioner', unit: 'pcs', category: 'Hair Care', suggestedCost: 15, suggestedPrice: 25 },
  { name: 'Hair Oil', unit: 'pcs', category: 'Hair Care', suggestedCost: 10, suggestedPrice: 18 },
  { name: 'Hair Extension (Pack)', unit: 'pack', category: 'Hair Extensions', suggestedCost: 30, suggestedPrice: 55 },
  { name: 'Braiding Hair', unit: 'pack', category: 'Hair Extensions', suggestedCost: 8, suggestedPrice: 15 },
  { name: 'Wig (Synthetic)', unit: 'pcs', category: 'Hair Extensions', suggestedCost: 80, suggestedPrice: 150 },
  { name: 'Wig (Human Hair)', unit: 'pcs', category: 'Hair Extensions', suggestedCost: 300, suggestedPrice: 500 },
  
  // Skincare
  { name: 'Body Lotion', unit: 'pcs', category: 'Skincare', suggestedCost: 12, suggestedPrice: 22 },
  { name: 'Body Cream', unit: 'pcs', category: 'Skincare', suggestedCost: 15, suggestedPrice: 28 },
  { name: 'Face Cream', unit: 'pcs', category: 'Skincare', suggestedCost: 20, suggestedPrice: 35 },
  { name: 'Vaseline', unit: 'pcs', category: 'Skincare', suggestedCost: 8, suggestedPrice: 15 },
  { name: 'Sunscreen', unit: 'pcs', category: 'Skincare', suggestedCost: 25, suggestedPrice: 45 },
  
  // Makeup
  { name: 'Foundation', unit: 'pcs', category: 'Makeup', suggestedCost: 30, suggestedPrice: 55 },
  { name: 'Lipstick', unit: 'pcs', category: 'Makeup', suggestedCost: 12, suggestedPrice: 25 },
  { name: 'Lip Gloss', unit: 'pcs', category: 'Makeup', suggestedCost: 8, suggestedPrice: 18 },
  { name: 'Eye Shadow Palette', unit: 'pcs', category: 'Makeup', suggestedCost: 25, suggestedPrice: 50 },
  { name: 'Mascara', unit: 'pcs', category: 'Makeup', suggestedCost: 15, suggestedPrice: 30 },
  { name: 'Makeup Brush Set', unit: 'set', category: 'Makeup', suggestedCost: 35, suggestedPrice: 65 },
  
  // Fragrances
  { name: 'Perfume (Men)', unit: 'pcs', category: 'Fragrances', suggestedCost: 50, suggestedPrice: 95 },
  { name: 'Perfume (Women)', unit: 'pcs', category: 'Fragrances', suggestedCost: 55, suggestedPrice: 100 },
  { name: 'Body Spray', unit: 'pcs', category: 'Fragrances', suggestedCost: 15, suggestedPrice: 28 },
  { name: 'Roll-On Deodorant', unit: 'pcs', category: 'Fragrances', suggestedCost: 8, suggestedPrice: 15 },
];

// Auto Parts Store Templates
const AUTO_PARTS_TEMPLATES = [
  // Engine Parts
  { name: 'Engine Oil (4L)', unit: 'pcs', category: 'Engine Parts', suggestedCost: 80, suggestedPrice: 120 },
  { name: 'Oil Filter', unit: 'pcs', category: 'Engine Parts', suggestedCost: 15, suggestedPrice: 30 },
  { name: 'Air Filter', unit: 'pcs', category: 'Engine Parts', suggestedCost: 20, suggestedPrice: 40 },
  { name: 'Spark Plug', unit: 'pcs', category: 'Engine Parts', suggestedCost: 8, suggestedPrice: 18 },
  { name: 'Timing Belt', unit: 'pcs', category: 'Engine Parts', suggestedCost: 50, suggestedPrice: 90 },
  { name: 'Fan Belt', unit: 'pcs', category: 'Engine Parts', suggestedCost: 25, suggestedPrice: 45 },
  
  // Brakes
  { name: 'Brake Pads (Front)', unit: 'set', category: 'Brakes', suggestedCost: 60, suggestedPrice: 100 },
  { name: 'Brake Pads (Rear)', unit: 'set', category: 'Brakes', suggestedCost: 50, suggestedPrice: 85 },
  { name: 'Brake Disc', unit: 'pcs', category: 'Brakes', suggestedCost: 80, suggestedPrice: 140 },
  { name: 'Brake Fluid', unit: 'pcs', category: 'Brakes', suggestedCost: 15, suggestedPrice: 28 },
  
  // Electrical
  { name: 'Car Battery', unit: 'pcs', category: 'Electrical', suggestedCost: 250, suggestedPrice: 380 },
  { name: 'Headlight Bulb', unit: 'pcs', category: 'Electrical', suggestedCost: 15, suggestedPrice: 30 },
  { name: 'Alternator', unit: 'pcs', category: 'Electrical', suggestedCost: 200, suggestedPrice: 320 },
  { name: 'Starter Motor', unit: 'pcs', category: 'Electrical', suggestedCost: 180, suggestedPrice: 280 },
  
  // Tyres & Wheels
  { name: 'Tyre (Various Sizes)', unit: 'pcs', category: 'Tyres', suggestedCost: 200, suggestedPrice: 300 },
  { name: 'Tyre Tube', unit: 'pcs', category: 'Tyres', suggestedCost: 25, suggestedPrice: 45 },
  { name: 'Wheel Rim', unit: 'pcs', category: 'Tyres', suggestedCost: 150, suggestedPrice: 250 },
  
  // Accessories
  { name: 'Car Mat Set', unit: 'set', category: 'Accessories', suggestedCost: 40, suggestedPrice: 75 },
  { name: 'Seat Cover Set', unit: 'set', category: 'Accessories', suggestedCost: 80, suggestedPrice: 150 },
  { name: 'Windscreen Wiper', unit: 'pair', category: 'Accessories', suggestedCost: 20, suggestedPrice: 40 },
];

// Bookstore Templates
const BOOKSTORE_TEMPLATES = [
  // Educational
  { name: 'Exercise Book (Pack of 10)', unit: 'pack', category: 'Stationery', suggestedCost: 15, suggestedPrice: 25 },
  { name: 'Notebook (A4)', unit: 'pcs', category: 'Stationery', suggestedCost: 8, suggestedPrice: 15 },
  { name: 'Textbook (Primary)', unit: 'pcs', category: 'Educational Books', suggestedCost: 20, suggestedPrice: 35 },
  { name: 'Textbook (Secondary)', unit: 'pcs', category: 'Educational Books', suggestedCost: 30, suggestedPrice: 50 },
  { name: 'WAEC Past Questions', unit: 'pcs', category: 'Educational Books', suggestedCost: 15, suggestedPrice: 25 },
  { name: 'Dictionary', unit: 'pcs', category: 'Reference Books', suggestedCost: 25, suggestedPrice: 45 },
  
  // Stationery
  { name: 'Pen (Pack of 12)', unit: 'pack', category: 'Stationery', suggestedCost: 8, suggestedPrice: 15 },
  { name: 'Pencil (Pack of 12)', unit: 'pack', category: 'Stationery', suggestedCost: 5, suggestedPrice: 10 },
  { name: 'Ruler', unit: 'pcs', category: 'Stationery', suggestedCost: 2, suggestedPrice: 4 },
  { name: 'Eraser (Pack)', unit: 'pack', category: 'Stationery', suggestedCost: 3, suggestedPrice: 6 },
  { name: 'Sharpener (Pack)', unit: 'pack', category: 'Stationery', suggestedCost: 3, suggestedPrice: 6 },
  { name: 'Mathematical Set', unit: 'set', category: 'Stationery', suggestedCost: 12, suggestedPrice: 22 },
  { name: 'Calculator', unit: 'pcs', category: 'Stationery', suggestedCost: 15, suggestedPrice: 28 },
  
  // General Books
  { name: 'Novel', unit: 'pcs', category: 'Fiction', suggestedCost: 20, suggestedPrice: 35 },
  { name: 'Magazine', unit: 'pcs', category: 'Magazines', suggestedCost: 8, suggestedPrice: 15 },
  { name: 'Religious Book', unit: 'pcs', category: 'Religion', suggestedCost: 15, suggestedPrice: 28 },
];

// Furniture Store Templates
const FURNITURE_TEMPLATES = [
  // Living Room
  { name: 'Sofa Set (3-piece)', unit: 'set', category: 'Living Room', suggestedCost: 2500, suggestedPrice: 3800 },
  { name: 'Center Table', unit: 'pcs', category: 'Living Room', suggestedCost: 300, suggestedPrice: 480 },
  { name: 'TV Stand', unit: 'pcs', category: 'Living Room', suggestedCost: 400, suggestedPrice: 650 },
  { name: 'Bookshelf', unit: 'pcs', category: 'Living Room', suggestedCost: 350, suggestedPrice: 550 },
  
  // Bedroom
  { name: 'Bed Frame (Queen)', unit: 'pcs', category: 'Bedroom', suggestedCost: 800, suggestedPrice: 1300 },
  { name: 'Bed Frame (King)', unit: 'pcs', category: 'Bedroom', suggestedCost: 1000, suggestedPrice: 1600 },
  { name: 'Mattress (Queen)', unit: 'pcs', category: 'Bedroom', suggestedCost: 600, suggestedPrice: 950 },
  { name: 'Mattress (King)', unit: 'pcs', category: 'Bedroom', suggestedCost: 800, suggestedPrice: 1250 },
  { name: 'Wardrobe', unit: 'pcs', category: 'Bedroom', suggestedCost: 700, suggestedPrice: 1100 },
  { name: 'Dressing Table', unit: 'pcs', category: 'Bedroom', suggestedCost: 400, suggestedPrice: 650 },
  { name: 'Bedside Table', unit: 'pcs', category: 'Bedroom', suggestedCost: 150, suggestedPrice: 250 },
  
  // Dining
  { name: 'Dining Table Set (6 chairs)', unit: 'set', category: 'Dining', suggestedCost: 1500, suggestedPrice: 2400 },
  { name: 'Dining Table Set (4 chairs)', unit: 'set', category: 'Dining', suggestedCost: 1000, suggestedPrice: 1600 },
  
  // Office
  { name: 'Office Desk', unit: 'pcs', category: 'Office', suggestedCost: 500, suggestedPrice: 800 },
  { name: 'Office Chair', unit: 'pcs', category: 'Office', suggestedCost: 300, suggestedPrice: 500 },
  { name: 'Filing Cabinet', unit: 'pcs', category: 'Office', suggestedCost: 250, suggestedPrice: 400 },
];

// Restaurant Templates
const RESTAURANT_TEMPLATES = [
  // Appetizers
  { name: 'Soup of the Day', unit: 'bowl', category: 'Appetizers', suggestedCost: 8, suggestedPrice: 15 },
  { name: 'Salad', unit: 'portion', category: 'Appetizers', suggestedCost: 6, suggestedPrice: 12 },
  { name: 'Spring Rolls', unit: 'portion', category: 'Appetizers', suggestedCost: 10, suggestedPrice: 18 },
  { name: 'Chicken Wings', unit: 'portion', category: 'Appetizers', suggestedCost: 12, suggestedPrice: 22 },
  { name: 'Fried Plantain', unit: 'portion', category: 'Appetizers', suggestedCost: 5, suggestedPrice: 10 },
  // Main Courses
  { name: 'Jollof Rice', unit: 'portion', category: 'Main Courses', suggestedCost: 15, suggestedPrice: 35 },
  { name: 'Waakye', unit: 'portion', category: 'Main Courses', suggestedCost: 12, suggestedPrice: 28 },
  { name: 'Banku with Fish', unit: 'portion', category: 'Main Courses', suggestedCost: 18, suggestedPrice: 40 },
  { name: 'Fufu with Light Soup', unit: 'portion', category: 'Main Courses', suggestedCost: 15, suggestedPrice: 35 },
  { name: 'Fried Rice', unit: 'portion', category: 'Main Courses', suggestedCost: 14, suggestedPrice: 30 },
  { name: 'Grilled Chicken', unit: 'portion', category: 'Main Courses', suggestedCost: 20, suggestedPrice: 45 },
  { name: 'Fried Fish', unit: 'portion', category: 'Main Courses', suggestedCost: 18, suggestedPrice: 40 },
  // Sides
  { name: 'Plantain', unit: 'portion', category: 'Sides', suggestedCost: 5, suggestedPrice: 10 },
  { name: 'Coleslaw', unit: 'portion', category: 'Sides', suggestedCost: 4, suggestedPrice: 8 },
  { name: 'Fried Egg', unit: 'pcs', category: 'Sides', suggestedCost: 3, suggestedPrice: 6 },
  // Desserts
  { name: 'Fruit Salad', unit: 'portion', category: 'Desserts', suggestedCost: 6, suggestedPrice: 14 },
  { name: 'Ice Cream', unit: 'scoop', category: 'Desserts', suggestedCost: 4, suggestedPrice: 10 },
  { name: 'Cake Slice', unit: 'pcs', category: 'Desserts', suggestedCost: 8, suggestedPrice: 18 },
  // Beverages
  { name: 'Coca-Cola', unit: 'bottle', category: 'Beverages', suggestedCost: 2, suggestedPrice: 5 },
  { name: 'Fanta', unit: 'bottle', category: 'Beverages', suggestedCost: 2, suggestedPrice: 5 },
  { name: 'Sprite', unit: 'bottle', category: 'Beverages', suggestedCost: 2, suggestedPrice: 5 },
  { name: 'Water (Bottle)', unit: 'bottle', category: 'Beverages', suggestedCost: 1, suggestedPrice: 3 },
  { name: 'Fresh Juice', unit: 'glass', category: 'Beverages', suggestedCost: 5, suggestedPrice: 12 },
  // Hot Drinks
  { name: 'Tea', unit: 'cup', category: 'Hot Drinks', suggestedCost: 2, suggestedPrice: 6 },
  { name: 'Coffee', unit: 'cup', category: 'Hot Drinks', suggestedCost: 4, suggestedPrice: 10 },
  { name: 'Milo', unit: 'cup', category: 'Hot Drinks', suggestedCost: 3, suggestedPrice: 8 },
  // Alcoholic Drinks
  { name: 'Beer (Local)', unit: 'bottle', category: 'Alcoholic Drinks', suggestedCost: 5, suggestedPrice: 12 },
  { name: 'Beer (Imported)', unit: 'bottle', category: 'Alcoholic Drinks', suggestedCost: 8, suggestedPrice: 18 },
  { name: 'Wine (Glass)', unit: 'glass', category: 'Alcoholic Drinks', suggestedCost: 15, suggestedPrice: 35 },
];

// Other/General Templates
const OTHER_TEMPLATES = [
  { name: 'Product 1', unit: 'pcs', category: 'General', suggestedCost: 0, suggestedPrice: 0 },
  { name: 'Product 2', unit: 'pcs', category: 'General', suggestedCost: 0, suggestedPrice: 0 },
];

// Export all templates organized by shop type
export const PRODUCT_TEMPLATES = {
  [SHOP_TYPES.SUPERMARKET]: SUPERMARKET_TEMPLATES,
  [SHOP_TYPES.CONVENIENCE]: CONVENIENCE_TEMPLATES,
  [SHOP_TYPES.ELECTRONICS]: ELECTRONICS_TEMPLATES,
  [SHOP_TYPES.HARDWARE]: HARDWARE_TEMPLATES,
  [SHOP_TYPES.CLOTHING]: CLOTHING_TEMPLATES,
  [SHOP_TYPES.BEAUTY]: BEAUTY_TEMPLATES,
  [SHOP_TYPES.AUTO_PARTS]: AUTO_PARTS_TEMPLATES,
  [SHOP_TYPES.BOOKSTORE]: BOOKSTORE_TEMPLATES,
  [SHOP_TYPES.STATIONERY]: BOOKSTORE_TEMPLATES, // Same as bookstore
  [SHOP_TYPES.FURNITURE]: FURNITURE_TEMPLATES,
  [SHOP_TYPES.RESTAURANT]: RESTAURANT_TEMPLATES,
  [SHOP_TYPES.SPORTS]: OTHER_TEMPLATES,
  [SHOP_TYPES.TOYS]: OTHER_TEMPLATES,
  [SHOP_TYPES.PET]: OTHER_TEMPLATES,
  [SHOP_TYPES.OTHER]: OTHER_TEMPLATES,
};

/**
 * Get product templates for a specific shop type
 * @param {string} shopType - The shop type
 * @returns {Array} Array of product templates
 */
export const getTemplatesForShopType = (shopType) => {
  return PRODUCT_TEMPLATES[shopType] || PRODUCT_TEMPLATES[SHOP_TYPES.OTHER];
};

/**
 * Get unique categories from templates
 * @param {string} shopType - The shop type
 * @returns {Array} Array of unique category names
 */
export const getCategoriesFromTemplates = (shopType) => {
  const templates = getTemplatesForShopType(shopType);
  const categories = [...new Set(templates.map(t => t.category))];
  return categories.sort();
};

export default PRODUCT_TEMPLATES;
