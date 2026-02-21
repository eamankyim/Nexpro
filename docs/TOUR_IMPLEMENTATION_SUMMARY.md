# App Tour Implementation Summary

## Overview

This document summarizes the app tour implementation plan with specific targets identified for each business type.

## Tour Library: NextStep

**Selected**: NextStep (https://nextstepjs.com/react)
- Lightweight, React-native
- Framer Motion animations
- Full customization with Tailwind CSS
- Cross-page routing support
- Mobile-friendly

## Tour Targets Summary

### Universal Elements (All Business Types)

1. **Dashboard**
   - Welcome section
   - Date filter buttons
   - Dashboard stats cards (Revenue/Sales, Expenses, Profit, New Customers)
   - Recent activity table
   - Notice board

2. **Navigation**
   - Sidebar menu
   - Quick actions section
   - Sidebar collapse button

3. **Header**
   - Search bar
   - Notification bell
   - User profile dropdown
   - Upgrade button (if applicable)

### Shop-Specific Targets

1. **Sales Page** (`/sales`)
   - Sales list/table
   - Add sale button
   - POS button
   - Sales filters

2. **Products Page** (`/products`)
   - Products grid/list
   - Add product button
   - Product categories
   - Quick sale section (staff view)

3. **Inventory Page** (`/inventory`)
   - Inventory items table
   - Restock button
   - Stock status indicators

### Studio-Specific Targets (Printing Press, Mechanic, Barber, Salon)

1. **Jobs Page** (`/jobs`)
   - Jobs table
   - Add job button
   - Job status filters
   - Job priority indicators
   - Job items section

2. **Quotes Page** (`/quotes`) - Printing Press only
   - Quotes list
   - Create quote button
   - Quote to job conversion

3. **Pricing Page** (`/pricing`) - Printing Press only
   - Pricing templates
   - Add template button

### Pharmacy-Specific Targets

1. **Prescriptions Page** (`/prescriptions`)
   - Prescriptions list
   - New prescription button

2. **Drugs Page** (`/drugs`)
   - Drugs catalog
   - Drug information

### Common Features (All Types)

1. **Customers** - Customer list, add button, details drawer
2. **Invoices** - Invoice list, create button, status tracking
3. **Expenses** - Expense list, add button, categories
4. **Reports** - Overview and Smart Report
5. **Settings** - Organization settings, user management

## Tour Flow Structure

### Main Tour (Post-Onboarding) - 9 Universal Steps

1. Welcome Section
2. Dashboard Stats Cards
3. Date Filters
4. Navigation Sidebar
5. Quick Actions (if applicable)
6. Header Search
7. Header Notifications
8. Recent Activity Table
9. Notice Board

### Business-Type Continuations

**Shop**: +3 steps (Sales, Products, Inventory)
**Studio**: +3 steps (Jobs, Quotes*, Pricing*)
**Pharmacy**: +3 steps (Prescriptions, Drugs, Sales/POS)

*Printing Press only

## Implementation Files

### Frontend Files to Create

1. `Frontend/src/components/tour/TourProvider.jsx` - Tour context provider
2. `Frontend/src/components/tour/TourButton.jsx` - Manual tour trigger button
3. `Frontend/src/hooks/useTour.js` - Tour management hook
4. `Frontend/src/config/tours.js` - Tour step definitions
5. `Frontend/src/services/tourService.js` - API service for tour state

### Backend Files to Create

1. `Backend/controllers/tourController.js` - Tour endpoints
2. `Backend/routes/tourRoutes.js` - Tour routes

### Files to Modify

1. `Frontend/src/pages/Onboarding.jsx` - Trigger tour after completion
2. `Frontend/src/pages/Dashboard.jsx` - Add tour welcome banner
3. `Frontend/src/components/layout/Header.jsx` - Add tour button to dropdown
4. `Frontend/src/pages/Settings.jsx` - Add tours section
5. All target components - Add `data-tour` attributes

## Data Storage

Tour completion state stored in `UserTenant.metadata`:
```json
{
  "tours": {
    "mainTour": {
      "completed": true,
      "completedAt": "2026-02-03T10:30:00Z",
      "version": "1.0.0"
    }
  }
}
```

## Selector Strategy

- Use `data-tour="[unique-id]"` attributes on target elements
- Avoid CSS classes or IDs for tour targeting
- Add `data-tour-step` for ordering (optional)
- Add `data-tour-group` for conditional display

## Mobile Considerations

- Adapt tour to mobile layout
- Handle sidebar → hamburger menu transition
- Ensure 44x44px touch targets
- Consider bottom sheets and modals

## Next Steps

1. Install NextStep library
2. Create tour service and backend endpoints
3. Create tour configuration with all step definitions
4. Add data-tour attributes to target elements
5. Integrate tour triggers (onboarding, dashboard, settings)
6. Test tours for each business type
7. Test mobile responsiveness

See `docs/TOUR_TARGETS.md` for detailed element mapping.
