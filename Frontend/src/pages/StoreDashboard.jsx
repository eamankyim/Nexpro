import { useMemo } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ExternalLink, Package, Settings, ShoppingBag, Store } from 'lucide-react';
import storeService from '../services/storeService';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

const StoreDashboard = () => {
  const { data: statusResponse, isLoading } = useQuery({
    queryKey: ['store', 'setup-status'],
    queryFn: () => storeService.getSetupStatus(),
  });

  const data = statusResponse?.data ?? statusResponse ?? {};
  const settings = data.settings;
  const checklist = data.checklist || {};
  const stats = useMemo(() => ([
    { label: 'Published listings', value: checklist.listingsCount || 0, icon: Package },
    { label: 'Store status', value: checklist.launched ? 'Live' : 'Draft', icon: Store },
    { label: 'Orders', value: 'Coming soon', icon: ShoppingBag },
  ]), [checklist.launched, checklist.listingsCount]);

  if (!isLoading && !checklist.hasSettings) {
    return <Navigate to="/store/setup" replace />;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Store dashboard</h1>
          <p className="text-muted-foreground">
            {settings?.displayName || 'Online store'} {checklist.launched ? 'is live' : 'is not launched yet'}.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" asChild>
            <Link to="/store/settings">
              <Settings className="mr-2 h-4 w-4" />
              Settings
            </Link>
          </Button>
          <Button asChild>
            <Link to="/store/listings">
              Manage listings
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card key={stat.label} className="border border-border">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">{stat.label}</CardTitle>
                <Icon className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-semibold">{stat.value}</div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card className="border border-border">
        <CardHeader>
          <CardTitle>Launch checklist</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2">
          {[
            ['Store information', checklist.hasBasics],
            ['Branding', checklist.brandingReady],
            ['Contact details', checklist.hasContact],
            ['Fulfillment', checklist.hasFulfillment],
            ['Published listing', checklist.hasPublishedListing],
          ].map(([label, done]) => (
            <div key={label} className="flex items-center justify-between rounded-lg border border-border p-3">
              <span className="text-sm font-medium">{label}</span>
              <Badge variant={done ? 'default' : 'outline'}>{done ? 'Done' : 'Needed'}</Badge>
            </div>
          ))}
        </CardContent>
      </Card>

      {settings?.slug && (
        <div className="rounded-xl border border-border bg-muted/30 p-4 text-sm text-muted-foreground">
          Public API preview: <code>/api/public/store/{settings.slug}</code>
          <ExternalLink className="ml-2 inline h-3.5 w-3.5" />
        </div>
      )}
    </div>
  );
};

export default StoreDashboard;
