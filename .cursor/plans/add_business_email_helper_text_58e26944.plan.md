---
name: Add Business Email Helper Text
overview: "Add helper text below the Business Email field in the onboarding form that explains: \"If you leave this blank, we will use your account email on invoices.\""
todos:
  - id: "1"
    content: Add FormDescription to imports in Onboarding.jsx
    status: completed
  - id: "2"
    content: Add FormDescription component with helper text below Business Email label
    status: completed
isProject: false
---

## Plan: Add Helper Text to Business Email Field

### Changes Required

1. **Update imports in `Frontend/src/pages/Onboarding.jsx`**

   - Add `FormDescription` to the existing form component imports on line 11
   - Current: `import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';`
   - Updated: `import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form';`

2. **Add FormDescription component to Business Email field**

   - Location: `Frontend/src/pages/Onboarding.jsx` around line 714-731
   - Insert `FormDescription` component between `FormLabel` and `FormControl` (or after `FormLabel` but before `FormControl`)
   - Text content: "If you leave this blank, we will use your account email on invoices."
   - The component will automatically use the appropriate styling (`text-sm text-muted-foreground`)

### Implementation Details

The `FormDescription` component from shadcn/ui is already available and properly configured. It will:

- Display below the label
- Use muted text styling for helper text
- Be properly associated with the form field for accessibility

### Code Structure

```jsx
<FormField
  control={form.control}
  name="companyEmail"
  render={({ field }) => (
    <FormItem>
      <FormLabel className="text-gray-700">Business Email (Optional)</FormLabel>
      <FormDescription className="text-gray-600">
        If you leave this blank, we will use your account email on invoices.
      </FormDescription>
      <FormControl>
        <Input {...field} ... />
      </FormControl>
      <FormMessage />
    </FormItem>
  )}
/>
```

This is a simple, straightforward change that adds helpful context to the optional email field.