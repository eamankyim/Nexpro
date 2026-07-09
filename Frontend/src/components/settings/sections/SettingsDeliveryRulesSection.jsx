import { Send } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import SettingsDeliveryRulesTable from '../SettingsDeliveryRulesTable';

/**
 * Multi-channel delivery rules section.
 */
const SettingsDeliveryRulesSection = () => (
  <Card className="border border-gray-200">
    <CardHeader>
      <CardTitle className="text-base md:text-2xl flex items-center gap-2">
        <Send className="h-5 w-5 text-muted-foreground shrink-0" />
        Delivery Rules
      </CardTitle>
      <CardDescription className="text-xs md:text-sm">
        Choose which channels may send each system message. Edit SMS wording under SMS settings.
      </CardDescription>
    </CardHeader>
    <CardContent>
      <SettingsDeliveryRulesTable />
    </CardContent>
  </Card>
);

export default SettingsDeliveryRulesSection;
