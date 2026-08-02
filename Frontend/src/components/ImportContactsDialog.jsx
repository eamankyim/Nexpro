import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CheckCircle2, Download, FileSpreadsheet, Loader2, Smartphone, Upload, X } from 'lucide-react';

import contactImportService from '../services/contactImportService';
import { showError, showSuccess } from '../utils/toast';
import { cn } from '@/lib/utils';
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

const ACCEPT =
  '.csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

const contactsApiSupported = () => (
  typeof navigator !== 'undefined'
  && 'contacts' in navigator
  && 'ContactsManager' in window
  && typeof navigator.contacts?.select === 'function'
);

const formatFileSize = (bytes) => {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
};

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
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef(null);
  const phoneSupported = useMemo(() => contactsApiSupported(), []);

  useEffect(() => {
    if (open) {
      setDestination(defaultDestination);
      setSourceTab('file');
      setImportFile(null);
      setPhoneContacts([]);
      setResult(null);
      setLoading(false);
      setIsDragging(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
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

  const assignFile = useCallback((file) => {
    if (!file) return;
    setImportFile(file);
    setResult(null);
  }, []);

  const handleFileChange = useCallback((e) => {
    assignFile(e.target.files?.[0] ?? null);
  }, [assignFile]);

  const handleBrowseClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) assignFile(file);
  }, [assignFile]);

  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const clearFile = useCallback((e) => {
    e.stopPropagation();
    setImportFile(null);
    setResult(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, []);

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

  const canImportFile = Boolean(importFile) && !loading;
  const canImportPhone = phoneSupported && phoneContacts.length > 0 && !loading;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Import contacts</DialogTitle>
        </DialogHeader>

        <div className="space-y-5 py-1">
          <div className="space-y-2">
            <Label htmlFor="import-destination" className="text-sm font-medium text-gray-900">
              Import into
            </Label>
            <Select value={destination} onValueChange={setDestination}>
              <SelectTrigger
                id="import-destination"
                className="border-gray-200 focus:ring-[#166534]"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="customers">Customers</SelectItem>
                <SelectItem value="leads">Leads</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Tabs value={sourceTab} onValueChange={setSourceTab}>
            <TabsList className="grid h-11 w-full grid-cols-2 rounded-lg bg-gray-100 p-1">
              <TabsTrigger
                value="file"
                className="rounded-md data-[state=active]:bg-white data-[state=active]:text-gray-900 data-[state=active]:border data-[state=active]:border-gray-200"
              >
                File
              </TabsTrigger>
              <TabsTrigger
                value="phone"
                className="rounded-md data-[state=active]:bg-white data-[state=active]:text-gray-900 data-[state=active]:border data-[state=active]:border-gray-200"
              >
                Phone contacts
              </TabsTrigger>
            </TabsList>

            <TabsContent value="file" className="mt-5 space-y-4">
              <div className="flex items-start justify-between gap-3">
                <p className="text-sm leading-relaxed text-gray-600">
                  Upload a CSV or Excel file. Use the template for the correct column headers.
                </p>
                <button
                  type="button"
                  onClick={handleDownloadTemplate}
                  className="inline-flex shrink-0 items-center gap-1.5 text-sm font-medium text-[#166534] hover:text-[#14532d] hover:underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#166534] focus-visible:ring-offset-2 rounded-sm"
                >
                  <Download className="h-3.5 w-3.5" aria-hidden />
                  Download template
                </button>
              </div>

              <input
                ref={fileInputRef}
                id="contact-import-file"
                type="file"
                accept={ACCEPT}
                className="sr-only"
                tabIndex={-1}
                onChange={handleFileChange}
              />

              <div
                role="button"
                tabIndex={0}
                aria-label={importFile ? `Selected file ${importFile.name}. Click to replace.` : 'Drop CSV or Excel here, or browse'}
                onClick={handleBrowseClick}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handleBrowseClick();
                  }
                }}
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                className={cn(
                  'flex min-h-[148px] w-full cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-4 py-8 transition-colors',
                  isDragging
                    ? 'border-[#166534] bg-[#dcfce7]/60'
                    : importFile
                      ? 'border-[#166534]/40 bg-[#dcfce7]/30'
                      : 'border-gray-200 bg-gray-50 hover:border-[#166534]/50 hover:bg-[#dcfce7]/20',
                )}
              >
                {importFile ? (
                  <div className="flex w-full max-w-sm items-center gap-3 text-left">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-[#166534]/20 bg-white">
                      <FileSpreadsheet className="h-5 w-5 text-[#166534]" aria-hidden />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-gray-900">{importFile.name}</p>
                      <p className="mt-0.5 text-xs text-gray-500">{formatFileSize(importFile.size)}</p>
                    </div>
                    <button
                      type="button"
                      onClick={clearFile}
                      className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-gray-200 bg-white text-gray-500 hover:border-gray-300 hover:text-gray-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#166534]"
                      aria-label="Remove selected file"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-full border border-gray-200 bg-white">
                      <Upload className="h-5 w-5 text-[#166534]" aria-hidden />
                    </div>
                    <p className="text-sm font-medium text-gray-900">
                      Drop CSV or Excel here
                    </p>
                    <p className="mt-1 text-sm text-gray-500">
                      or{' '}
                      <span className="font-medium text-[#166534]">browse</span>
                    </p>
                    <p className="mt-2 text-xs text-gray-400">.csv, .xlsx</p>
                  </>
                )}
              </div>
            </TabsContent>

            <TabsContent value="phone" className="mt-5 space-y-4">
              {phoneSupported ? (
                <>
                  <p className="text-sm leading-relaxed text-gray-600">
                    Allow access to your phone contacts, pick who to import, then confirm.
                  </p>

                  <button
                    type="button"
                    onClick={handlePickPhoneContacts}
                    className={cn(
                      'flex w-full cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-4 py-8 transition-colors',
                      phoneContacts.length > 0
                        ? 'border-[#166534]/40 bg-[#dcfce7]/30'
                        : 'border-gray-200 bg-gray-50 hover:border-[#166534]/50 hover:bg-[#dcfce7]/20',
                    )}
                  >
                    <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-full border border-gray-200 bg-white">
                      {phoneContacts.length > 0 ? (
                        <CheckCircle2 className="h-5 w-5 text-[#166534]" aria-hidden />
                      ) : (
                        <Smartphone className="h-5 w-5 text-[#166534]" aria-hidden />
                      )}
                    </div>
                    <p className="text-sm font-medium text-gray-900">
                      {phoneContacts.length > 0
                        ? `${phoneContacts.length} contact${phoneContacts.length === 1 ? '' : 's'} selected`
                        : 'Choose from phone'}
                    </p>
                    <p className="mt-1 text-sm text-gray-500">
                      {phoneContacts.length > 0
                        ? 'Tap to pick a different set'
                        : 'Opens your device contact picker'}
                    </p>
                  </button>

                  {phoneContacts.length > 0 ? (
                    <div className="max-h-40 overflow-y-auto rounded-xl border border-gray-200 bg-white p-3 text-sm">
                      <ul className="space-y-2 text-gray-600">
                        {phoneContacts.slice(0, 20).map((c, i) => (
                          <li
                            key={`${c.phone || c.email || c.name}-${i}`}
                            className="flex items-baseline gap-2 border-b border-gray-100 pb-2 last:border-0 last:pb-0"
                          >
                            <span className="font-medium text-gray-900">
                              {c.name || 'Unnamed'}
                            </span>
                            {c.phone ? (
                              <span className="truncate text-xs text-gray-500">{c.phone}</span>
                            ) : null}
                          </li>
                        ))}
                        {phoneContacts.length > 20 ? (
                          <li className="pt-1 text-xs text-gray-500">
                            …and {phoneContacts.length - 20} more
                          </li>
                        ) : null}
                      </ul>
                    </div>
                  ) : null}
                </>
              ) : (
                <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                  Phone contact picking is not supported in this browser. Use the File tab
                  (export contacts from Google Contacts / Excel), or import from the ABS mobile app.
                </div>
              )}
            </TabsContent>
          </Tabs>

          {result ? (
            <div className="rounded-xl border border-gray-200 bg-gray-50 p-3 text-sm space-y-1.5">
              <p className="text-gray-800">
                Created: <strong className="text-gray-900">{result.successCount || 0}</strong>
                {' · '}
                Skipped: <strong className="text-gray-900">{result.skippedCount || 0}</strong>
                {' · '}
                Errors: <strong className="text-gray-900">{result.errorCount || 0}</strong>
              </p>
              {(result.skipped || []).slice(0, 5).map((item) => (
                <p key={`s-${item.row}`} className="text-gray-500">
                  Row {item.row}: {item.message}
                </p>
              ))}
              {(result.errors || []).slice(0, 5).map((item) => (
                <p key={`e-${item.row}`} className="text-red-600">
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
              disabled={!canImportFile}
              onClick={handleImportFile}
              className={cn(
                'text-white',
                canImportFile
                  ? 'bg-[#166534] hover:bg-[#14532d]'
                  : 'bg-[#166534]/35 text-white/90 disabled:opacity-100',
              )}
            >
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
              Import
            </Button>
          ) : (
            <Button
              type="button"
              disabled={!canImportPhone}
              onClick={handleImportPhoneContacts}
              className={cn(
                'text-white',
                canImportPhone
                  ? 'bg-[#166534] hover:bg-[#14532d]'
                  : 'bg-[#166534]/35 text-white/90 disabled:opacity-100',
              )}
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
