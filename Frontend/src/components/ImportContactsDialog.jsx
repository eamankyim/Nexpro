import { useCallback, useEffect, useMemo, useState } from 'react';
import { Download, Loader2, Smartphone, Upload } from 'lucide-react';

import contactImportService from '../services/contactImportService';
import { showError, showSuccess } from '../utils/toast';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
const contactsApiSupported = () => (
  typeof navigator !== 'undefined'
  && 'contacts' in navigator
  && 'ContactsManager' in window
  && typeof navigator.contacts?.select === 'function'
);

/**
 * Shared Import Contacts dialog — Customers or Leads, File or Phone contacts.
 * @param {{
 *   open: boolean,
 *   onOpenChange: (open: boolean) => void,
 *   defaultDestination?: 'customers'|'leads',
 *   onImported?: () => void,
 * }} props
 */
export default function ImportContactsDialog({
  open,
  onOpenChange,
  defaultDestination = 'customers',
  onImported,
}) {
  const [destination, setDestination] = useState(defaultDestination);
  const [sourceTab, setSourceTab] = useState('file');
  const [importFile, setImportFile] = useState(null);
  const [phoneContacts, setPhoneContacts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const phoneSupported = useMemo(() => contactsApiSupported(), []);

  useEffect(() => {
    if (open) {
      setDestination(defaultDestination);
      setSourceTab('file');
      setImportFile(null);
      setPhoneContacts([]);
      setResult(null);
      setLoading(false);
    }
  }, [defaultDestination, open]);

  const handleDownloadTemplate = useCallback(async () => {
    try {
      const blob = await contactImportService.getImportTemplate(destination);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${destination}_import_template.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      showError(error?.response?.data?.message || 'Failed to download template');
    }
  }, [destination]);

  const handlePickPhoneContacts = useCallback(async () => {
    if (!phoneSupported) return;
    try {
      const props = ['name', 'tel', 'email'];
      const opts = { multiple: true };
      const selected = await navigator.contacts.select(props, opts);
      const mapped = (Array.isArray(selected) ? selected : []).map((contact) => ({
        name: Array.isArray(contact.name) ? contact.name.join(' ') : (contact.name || ''),
        phone: Array.isArray(contact.tel) ? (contact.tel[0] || '') : (contact.tel || ''),
        email: Array.isArray(contact.email) ? (contact.email[0] || '') : (contact.email || ''),
      })).filter((c) => c.name || c.phone || c.email);
      setPhoneContacts(mapped.slice(0, 500));
      setResult(null);
    } catch (error) {
      if (error?.name === 'AbortError') return;
      showError(error?.message || 'Could not read phone contacts');
    }
  }, [phoneSupported]);

  const handleImportFile = useCallback(async () => {
    if (!importFile) {
      showError('Choose a CSV or Excel file');
      return;
    }
    setLoading(true);
    setResult(null);
    try {
      const res = await contactImportService.importFromFile(destination, importFile);
      setResult(res);
      if (res?.successCount > 0) {
        showSuccess(`Imported ${res.successCount} contact(s)`);
        onImported?.();
      } else if (!(res?.skippedCount > 0)) {
        showError(res?.message || 'No contacts were imported');
      }
    } catch (error) {
      const data = error?.response?.data;
      if (data?.errors) {
        setResult(data);
      } else {
        showError(data?.message || error?.message || 'Import failed');
      }
    } finally {
      setLoading(false);
    }
  }, [destination, importFile, onImported]);

  const handleImportPhoneContacts = useCallback(async () => {
    if (!phoneContacts.length) {
      showError('Select contacts from your phone first');
      return;
    }
    setLoading(true);
    setResult(null);
    try {
      const res = await contactImportService.importFromContacts({
        destination,
        contacts: phoneContacts,
      });
      setResult(res);
      if (res?.successCount > 0) {
        showSuccess(`Imported ${res.successCount} contact(s)`);
        onImported?.();
      } else if (!(res?.skippedCount > 0)) {
        showError(res?.message || 'No contacts were imported');
      }
    } catch (error) {
      const data = error?.response?.data;
      if (data?.errors) {
        setResult(data);
      } else {
        showError(data?.message || error?.message || 'Import failed');
      }
    } finally {
      setLoading(false);
    }
  }, [destination, onImported, phoneContacts]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Import contacts</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>Import into</Label>
            <Select value={destination} onValueChange={setDestination}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="customers">Customers</SelectItem>
                <SelectItem value="leads">Leads</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Tabs value={sourceTab} onValueChange={setSourceTab}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="file">File</TabsTrigger>
              <TabsTrigger value="phone">Phone contacts</TabsTrigger>
            </TabsList>

            <TabsContent value="file" className="mt-4 space-y-3">
              <p className="text-sm text-muted-foreground">
                Upload a CSV or Excel file. Download the template for the correct column headers.
              </p>
              <Button type="button" variant="outline" size="sm" onClick={handleDownloadTemplate}>
                <Download className="mr-2 h-4 w-4" />
                Download template
              </Button>
              <div className="space-y-2">
                <Label htmlFor="contact-import-file">File</Label>
                <input
                  id="contact-import-file"
                  type="file"
                  accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                  className="block w-full text-sm"
                  onChange={(e) => {
                    setImportFile(e.target.files?.[0] ?? null);
                    setResult(null);
                  }}
                />
              </div>
            </TabsContent>

            <TabsContent value="phone" className="mt-4 space-y-3">
              {phoneSupported ? (
                <>
                  <p className="text-sm text-muted-foreground">
                    Allow access to your phone contacts, pick who to import, then confirm.
                  </p>
                  <Button type="button" variant="outline" onClick={handlePickPhoneContacts}>
                    <Smartphone className="mr-2 h-4 w-4" />
                    Choose from phone
                  </Button>
                  {phoneContacts.length > 0 ? (
                    <div className="max-h-40 overflow-y-auto rounded-md border border-border p-2 text-sm">
                      <p className="mb-2 font-medium">{phoneContacts.length} selected</p>
                      <ul className="space-y-1 text-muted-foreground">
                        {phoneContacts.slice(0, 20).map((c, i) => (
                          <li key={`${c.phone || c.email || c.name}-${i}`}>
                            {c.name || 'Unnamed'}
                            {c.phone ? ` · ${c.phone}` : ''}
                          </li>
                        ))}
                        {phoneContacts.length > 20 ? (
                          <li>…and {phoneContacts.length - 20} more</li>
                        ) : null}
                      </ul>
                    </div>
                  ) : null}
                </>
              ) : (
                <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                  Phone contact picking is not supported in this browser. Use the File tab
                  (export contacts from Google Contacts / Excel), or import from the ABS mobile app.
                </p>
              )}
            </TabsContent>
          </Tabs>

          {result ? (
            <div className="rounded-md border border-border bg-muted/30 p-3 text-sm space-y-1">
              <p>
                Created: <strong>{result.successCount || 0}</strong>
                {' · '}
                Skipped: <strong>{result.skippedCount || 0}</strong>
                {' · '}
                Errors: <strong>{result.errorCount || 0}</strong>
              </p>
              {(result.skipped || []).slice(0, 5).map((item) => (
                <p key={`s-${item.row}`} className="text-muted-foreground">
                  Row {item.row}: {item.message}
                </p>
              ))}
              {(result.errors || []).slice(0, 5).map((item) => (
                <p key={`e-${item.row}`} className="text-destructive">
                  Row {item.row}: {item.message}
                </p>
              ))}
            </div>
          ) : null}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          {sourceTab === 'file' ? (
            <Button
              type="button"
              disabled={!importFile || loading}
              onClick={handleImportFile}
              className="bg-[#166534] text-white hover:bg-[#14532d]"
            >
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
              Import
            </Button>
          ) : (
            <Button
              type="button"
              disabled={!phoneSupported || !phoneContacts.length || loading}
              onClick={handleImportPhoneContacts}
              className="bg-[#166534] text-white hover:bg-[#14532d]"
            >
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
              Import selected
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
