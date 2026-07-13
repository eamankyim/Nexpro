import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useAuth } from '../../../context/AuthContext';

/**
 * Inventory cost guidance — product cost is COGS, not an Expense.
 */
const SettingsInventorySection = () => {
  const { isManager } = useAuth();
  const canManageOrganization = Boolean(isManager);

  if (!canManageOrganization) {
    return (
      <Card className="border border-gray-200">
        <CardContent className="pt-6">
          <Alert variant="destructive">
            <AlertTitle>Access Restricted</AlertTitle>
            <AlertDescription>
              You need admin or manager permissions to view inventory settings.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border border-gray-200">
      <CardHeader>
        <CardTitle className="text-base md:text-lg">Inventory &amp; cost</CardTitle>
        <CardDescription className="text-xs md:text-sm">
          Product cost is counted as COGS when items sell — not as an operating expense.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 text-sm text-muted-foreground">
        <p>
          When you set a cost price on a product, ABS uses it for inventory value and cost of goods
          sold (COGS). Profit is calculated as sales − operating expenses − COGS.
        </p>
        <p>
          Use Expenses only for true operating costs (rent, salaries, utilities, marketing, and
          similar). Do not record inventory purchases as expenses — that would double-count cost
          against profit.
        </p>
        <p>
          If you previously had auto-created inventory expenses from product cost, those historical
          entries are left unchanged. You can archive or adjust them in Expenses if needed.
        </p>
      </CardContent>
    </Card>
  );
};

export default SettingsInventorySection;
