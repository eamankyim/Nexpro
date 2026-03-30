/**
 * Export Data
 *
 * Dedicated page with cards for exporting entities to CSV.
 */

import { useState, useCallback } from 'react';
import { Download, Loader2, Users, Package, ShoppingCart, Receipt, Banknote, FileText, UserPlus, Truck, Box, Cpu } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import api from '@/services/api';
import { showSuccess, showError } from '@/utils/toast';

const CARD_STYLE = { border: '1px solid #e5e7eb' };

const ENTITIES = [
  { entity: 'customers', label: 'Customers', icon: Users, description: 'Export customer list', path: 'customers' },
  { entity: 'products', label: 'Products', icon: Package, description: 'Export product catalog', path: 'products' },
  { entity: 'sales', label: 'Sales', icon: ShoppingCart, description: 'Export sales transactions', path: 'sales' },
  { entity: 'invoices', label: 'Invoices', icon: Receipt, description: 'Export invoices', path: 'invoices' },
  { entity: 'expenses', label: 'Expenses', icon: Banknote, description: 'Export expenses', path: 'expenses' },
  { entity: 'jobs', label: 'Jobs', icon: FileText, description: 'Export jobs list', path: 'jobs' },
  { entity: 'quotes', label: 'Quotes', icon: FileText, description: 'Export quotes', path: 'quotes' },
  { entity: 'leads', label: 'Leads', icon: UserPlus, description: 'Export leads', path: 'leads' },
  { entity: 'vendors', label: 'Vendors', icon: Truck, description: 'Export vendor list', path: 'vendors' },
  { entity: 'materials', label: 'Materials', icon: Box, description: 'Export materials inventory', path: 'materials/items' },
  { entity: 'equipment', label: 'Equipment', icon: Cpu, description: 'Export equipment inventory', path: 'equipment/items' },
];

export default function ExportData() {
  const [exportLoading, setExportLoading] = useState(null);

  const handleExport = useCallback(async (entity, path) => {
    setExportLoading(entity);
    try {
      const response = await api.get(`/${path}/export`, {
        params: { format: 'csv' },
        responseType: 'blob',
      });
      if (response.status < 200 || response.status >= 300) {
        const text = await (response.data instanceof Blob ? response.data.text() : Promise.resolve(String(response.data)));
        const json = (() => { try { return JSON.parse(text); } catch { return {}; } })();
        throw new Error(json.message || json.error || 'Export failed');
      }
      const blob = response.data instanceof Blob ? response.data : new Blob([response.data]);
      const cd = response.headers?.['content-disposition'] ?? response.headers?.get?.('content-disposition');
      const filename =
        (typeof cd === 'string' && cd.match(/filename[^;=]*=["']?([^"';\n]+)/i)?.[1]?.trim()) ||
        `${entity.replace('/', '-')}_${new Date().toISOString().split('T')[0]}.csv`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
      showSuccess(`${entity} exported as CSV`);
    } catch (err) {
      showError(err.message || 'Export failed', `Export ${entity}`);
    } finally {
      setExportLoading(null);
    }
  }, []);

  return (
    <div className="w-full p-4 md:p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Export data</h1>
        <p className="text-muted-foreground mt-1">
          Download your data as CSV for use in spreadsheets or other tools.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {ENTITIES.map(({ entity, label, icon: Icon, description, path }) => (
          <Card key={entity} style={CARD_STYLE}>
            <CardHeader className="pb-2">
              <Icon className="h-8 w-8 mb-2" style={{ color: 'var(--color-primary)' }} />
              <CardTitle className="text-base">{label}</CardTitle>
              <CardDescription>{description}</CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                variant="outline"
                size="sm"
                disabled={exportLoading !== null}
                onClick={() => handleExport(entity, path)}
                className="gap-1 w-full"
              >
                {exportLoading === entity ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Download className="h-4 w-4" />
                )}
                Export CSV
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
