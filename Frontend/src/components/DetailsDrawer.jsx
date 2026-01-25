import { useState } from 'react';
import { Pencil, Trash2, Printer, CheckCircle, Download, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { 
  Sheet, 
  SheetContent, 
  SheetHeader, 
  SheetTitle, 
  SheetDescription,
  SheetFooter
} from '@/components/ui/sheet';
import { 
  Tabs, 
  TabsList, 
  TabsTrigger, 
  TabsContent 
} from '@/components/ui/tabs';
import { Descriptions, DescriptionItem } from '@/components/ui/descriptions';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

/**
 * Reusable Details Drawer Component using shadcn/ui
 * @param {Boolean} open - Whether the drawer is visible
 * @param {Function} onClose - Callback function when drawer is closed
 * @param {String} title - Drawer title
 * @param {Array} fields - Array of field objects with { label, value, span, render }
 * @param {Array} tabs - Array of tab objects with { key, label, content } (optional)
 * @param {Number} width - Drawer width (default: 600)
 * @param {Function} onEdit - Callback function when edit button is clicked
 * @param {Function} onDelete - Callback function when delete is confirmed
 * @param {Function} onPrint - Callback function when print button is clicked
 * @param {Boolean} showActions - Whether to show edit/delete actions (default: true)
 * @param {String} deleteConfirmText - Custom delete confirmation text
 */
const DetailsDrawer = ({ 
  open, 
  onClose, 
  title, 
  fields = [], 
  tabs = null,
  width = 600,
  onEdit,
  onDelete,
  onPrint,
  onDownload,
  onMarkPaid,
  extraActions = [],
  extra = null,
  showActions = true,
  deleteConfirmText = 'Are you sure you want to delete this item?'
}) => {
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const renderFields = (fieldsToRender) => (
    <Descriptions column={1} className="space-y-4">
      {fieldsToRender.map((field, index) => (
        <DescriptionItem 
          key={index} 
          label={field.label}
        >
          {field.render ? field.render(field.value) : field.value || '-'}
        </DescriptionItem>
      ))}
    </Descriptions>
  );

  return (
    <>
      <Sheet open={open} onOpenChange={(isOpen) => {
        if (!isOpen) {
          onClose();
        }
      }}>
        <SheetContent 
          side="right" 
          className="shadow-none p-0 rounded-lg flex flex-col"
          style={{ 
            width: typeof width === 'string' ? width : `${width}px`, 
            maxWidth: 'calc(90vw - 16px)',
            marginLeft: '8px',
            marginRight: '8px',
            marginTop: '8px',
            marginBottom: '8px',
            borderRadius: '8px',
            height: 'calc(100vh - 16px)',
            maxHeight: 'calc(100vh - 16px)'
          }}
        >
          <div className="p-6 border-b flex-shrink-0">
            <SheetHeader>
              <div className="flex items-center justify-between">
                <div>
                  <SheetTitle>{title}</SheetTitle>
                  <SheetDescription className="mt-1">
                    View and manage details
                  </SheetDescription>
                </div>
                {extra && <div className="flex flex-wrap gap-2">{extra}</div>}
              </div>
            </SheetHeader>
          </div>

          <div className="overflow-y-auto flex-1" style={{ minHeight: 0 }}>
            {tabs ? (
              <Tabs defaultValue={tabs[0]?.key} className="w-full">
                <div className="px-6 pt-6">
                  <TabsList className="mb-4 w-full">
                    {tabs.map(tab => (
                      <TabsTrigger key={tab.key} value={tab.key} className="flex-1">
                        {tab.label}
                      </TabsTrigger>
                    ))}
                  </TabsList>
                </div>
                {tabs.map(tab => (
                  <TabsContent key={tab.key} value={tab.key} className="px-6 pb-6 w-full">
                    {tab.content}
                  </TabsContent>
                ))}
              </Tabs>
            ) : (
              <div className="px-6 py-6">
                {renderFields(fields)}
              </div>
            )}
          </div>

          {showActions && (onEdit || onDelete || onDownload || onPrint || onMarkPaid || extraActions.length > 0) && (
            <div className="p-6 border-t mt-auto">
              <div className="flex flex-wrap gap-2">
                {onDownload && (
                  <Button
                    variant="outline"
                    onClick={onDownload}
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Download
                  </Button>
                )}
                {onPrint && (
                  <Button
                    variant="outline"
                    onClick={onPrint}
                  >
                    <Printer className="h-4 w-4 mr-2" />
                    Print
                  </Button>
                )}
                {onMarkPaid && (
                  <Button
                    onClick={onMarkPaid}
                  >
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Mark as Paid
                  </Button>
                )}
                {extraActions
                  ?.filter(Boolean)
                  .map((action, index) => (
                    <Button
                      key={action.key || index}
                      variant={action.variant || 'default'}
                      onClick={action.onClick}
                    >
                      {action.icon && <span className="mr-2">{action.icon}</span>}
                      {action.label}
                    </Button>
                  ))}
                {onEdit && (
                  <Button
                    onClick={onEdit}
                  >
                    <Pencil className="h-4 w-4 mr-2" />
                    Edit
                  </Button>
                )}
                {onDelete && (
                  <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
                    <AlertDialogTrigger asChild>
                      <Button variant="destructive">
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                        <AlertDialogDescription>
                          {deleteConfirmText}
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => {
                            onDelete();
                            setDeleteDialogOpen(false);
                          }}
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                          Delete
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                )}
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
};

export default DetailsDrawer;
