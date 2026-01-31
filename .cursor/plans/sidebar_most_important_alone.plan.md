---
name: Sidebar most important alone
overview: Keep only the most important tabs standalone; put all others in one collapsible group (Advanced). Jobs is standalone for printing_press.
todos:
  - id: build-standalone
    content: Build baseItems with Dashboard, Sales (shop), Products (shop), Jobs (printing_press), Customers, Invoices, Expenses
  - id: build-advanced
    content: Build Advanced children (Leads, Vendors, Shops/Pharmacies, Payroll, Accounting, Inventory, Employees, etc.) by business type; omit Jobs for printing_press
  - id: push-group-and-rest
    content: Push Advanced collapsible then Reports, Users, Settings; remove Financial and Resources sections
  - id: default-open
    content: Add advanced to default openKeys
---

# Sidebar: Most important tabs alone, all others in one group

## Intent

- **Standalone (most important):** Dashboard, Sales, Products, Customers, Invoices, Expenses – and **Jobs** for printing_press – visible at the top without opening a section.
- **One group (everything else):** All remaining items go under a single collapsible section (e.g. **"Advanced"** or **"More"**).

## Standalone items (order)

1. Dashboard  
2. Sales (shop)  
3. Products (shop)  
4. **Jobs (printing_press)**  
5. Customers  
6. Invoices  
7. Expenses  

Then the **Advanced** group, then **Reports**, **Users**, **Settings**.

## What goes inside Advanced

All items that are not standalone and not Reports/Users/Settings:

- **Common:** Leads, Vendors, Payroll, Accounting, Inventory, Employees  
- **Shop:** Shops, Foot Traffic  
- **Pharmacy:** Pharmacies, Prescriptions, Drugs, Foot Traffic  
- **Printing press:** Vendors, Leads, Payroll, Accounting, Quotes, Pricing, Inventory, Employees (no Jobs – Jobs is standalone)

## File to change

- [Frontend/src/components/layout/Sidebar.jsx](Frontend/src/components/layout/Sidebar.jsx) – `getMenuItems(businessType, isAdmin)`.

## Implementation steps

1. **Build standalone items:** Dashboard; if shop: Sales, Products; if printing_press: Jobs; Customers, Invoices, Expenses.
2. **Build Advanced children** by business type (Leads, Vendors, Shops/Pharmacies, Payroll, Accounting, Inventory, Employees, Quotes/Pricing for printing_press, Prescriptions, Drugs, Foot Traffic) – **omit Jobs** for printing_press.
3. **Push Advanced collapsible** (e.g. icon LayoutList/Layers, label "Advanced"), then Reports (with children), Users, Settings.
4. **Remove** top-level Leads/Vendors/Shops/Pharmacies/Jobs (Jobs only as standalone for printing_press), Financial section, Resources section, standalone Prescriptions/Foot Traffic.
5. **Default openKeys:** include `'advanced'` (e.g. `['advanced', 'reports']`).

## Resulting structure (example)

**Shop:** Dashboard, Sales, Products, Customers, Invoices, Expenses, ▼ Advanced (Leads, Vendors, Shops, Payroll, Accounting, Inventory, Employees, Foot Traffic), ▼ Reports, Users, Settings.

**Printing press:** Dashboard, Jobs, Customers, Invoices, Expenses, ▼ Advanced (Vendors, Leads, Payroll, Accounting, Quotes, Pricing, Inventory, Employees), ▼ Reports, Users, Settings.

## Summary

| Item   | Standalone | In Advanced |
|--------|------------|-------------|
| Jobs (printing_press) | Yes | No |
| Sales, Products (shop) | Yes | No |
| Customers, Invoices, Expenses | Yes | No |
| Leads, Vendors, Shops, Payroll, Accounting, Inventory, Employees, etc. | No | Yes |
