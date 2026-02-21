import { useRef, useState, useCallback } from 'react';
import { Upload, Loader2, Download, Trash2, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import dayjs from 'dayjs';
import { resolveImageUrl } from '../utils/fileUtils';

// Utility functions for file handling
const formatFileSize = (bytes) => {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
};

const getFileTypeLabel = (fileName) => {
  if (!fileName) return 'FILE';
  const ext = fileName.split('.').pop()?.toUpperCase() || 'FILE';
  const typeMap = {
    'PDF': 'PDF',
    'DOC': 'DOC',
    'DOCX': 'DOC',
    'XLS': 'XLS',
    'XLSX': 'XLS',
    'ZIP': 'ZIP',
    'PNG': 'IMG',
    'JPG': 'IMG',
    'JPEG': 'IMG',
    'GIF': 'IMG',
    'WEBP': 'IMG',
    'SVG': 'IMG'
  };
  return typeMap[ext] || ext.substring(0, 3);
};

/**
 * Reusable File Upload Component
 * @param {Function} onFileSelect - Callback when file is selected (receives { file })
 * @param {Boolean} disabled - Whether upload is disabled
 * @param {Boolean} uploading - Whether file is currently uploading
 * @param {String} accept - Accepted file types (default: image and document types)
 * @param {Number} maxSizeMB - Maximum file size in MB (default: 20)
 * @param {String} emptyMessage - Message to show when no files uploaded (default: "No attachments uploaded yet.")
 * @param {Array} uploadedFiles - Array of uploaded files to display
 * @param {Function} onFileRemove - Callback when file is removed (receives file object)
 * @param {Function} onFileView - Callback when file is viewed in new tab (receives file object)
 * @param {Function} onFilePreview - Callback when file preview is requested (receives file object)
 * @param {Boolean} showFileList - Whether to show list of uploaded files (default: true)
 */
const FileUpload = ({
  onFileSelect,
  disabled = false,
  uploading = false,
  accept = 'image/*,.pdf,.doc,.docx,.xls,.xlsx,.zip',
  maxSizeMB = 20,
  emptyMessage = 'No attachments uploaded yet.',
  uploadedFiles = [],
  onFileRemove,
  onFileView,
  onFilePreview,
  showFileList = true
}) => {
  const fileInputRef = useRef(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleFileSelect = useCallback((file) => {
    if (!file) return;

    // Validate file size
    const fileSizeMB = file.size / (1024 * 1024);
    if (fileSizeMB > maxSizeMB) {
      alert(`File size exceeds maximum allowed size of ${maxSizeMB}MB`);
      return;
    }

    if (onFileSelect) {
      onFileSelect({ file });
    }
  }, [onFileSelect, maxSizeMB]);

  const handleClick = useCallback(() => {
    if (!disabled && !uploading && fileInputRef.current) {
      fileInputRef.current.click();
    }
  }, [disabled, uploading]);

  const handleFileChange = useCallback((e) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
    // Reset input so same file can be selected again
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, [handleFileSelect]);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setIsDragging(false);

    if (disabled || uploading) return;

    const file = e.dataTransfer.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
  }, [disabled, uploading, handleFileSelect]);

  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    if (!disabled && !uploading) {
      setIsDragging(true);
    }
  }, [disabled, uploading]);

  const handleDragLeave = useCallback((e) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  return (
    <div className="space-y-4">
      <input
        ref={fileInputRef}
        type="file"
        accept={accept}
        onChange={handleFileChange}
        disabled={disabled || uploading}
        className="hidden"
      />
      
      <div
        onClick={handleClick}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        className={cn(
          'flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-lg cursor-pointer transition-colors',
          isDragging ? 'border-[#166534] bg-[#166534]/5' : 'border-border bg-card',
          (disabled || uploading) ? 'opacity-50 cursor-not-allowed' : 'hover:bg-muted'
        )}
      >
        {uploading ? (
          <div className="flex flex-col items-center gap-2">
            <Loader2 className="h-8 w-8 animate-spin" style={{ color: '#166534' }} />
            <span className="text-sm text-muted-foreground">Uploading...</span>
          </div>
        ) : (
          <>
            <Upload className="h-8 w-8 mb-2" style={{ color: '#166534' }} />
            <div className="text-center">
              <span className="font-semibold" style={{ color: '#166534' }}>
                Click to upload or drag and drop
              </span>
              <p className="text-xs text-muted-foreground mt-1">
                PNG, JPG, WEBP, JPEG, PDF, DOC, DOCX, XLS, XLSX, ZIP (Max. {maxSizeMB}MB)
              </p>
            </div>
          </>
        )}
      </div>

      {showFileList && (
        <TooltipProvider>
          <div className="space-y-2">
            {uploadedFiles.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                {emptyMessage}
              </p>
            ) : (
              uploadedFiles.map((file, index) => {
                const fileId = file.id || file.name || index;
                const fileName = file.originalName || file.filename || file.name || 'Unknown file';
                const rawUrl = file.url || file.fileUrl;
                const fileUrl = rawUrl ? resolveImageUrl(rawUrl) : '';
                
                return (
                  <div
                    key={fileId}
                    className="flex items-center justify-between p-3 border rounded-md bg-card"
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className="flex-shrink-0">
                        <div className="w-10 h-10 rounded bg-muted flex items-center justify-center">
                          <span className="text-xs font-medium text-gray-600">
                            {getFileTypeLabel(fileName).charAt(0)}
                          </span>
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        {fileUrl ? (
                          <a
                            href={fileUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm font-medium text-foreground hover:underline block truncate"
                            onClick={(e) => {
                              if (onFileView) {
                                e.preventDefault();
                                onFileView(file);
                              }
                            }}
                          >
                            {fileName}
                          </a>
                        ) : (
                          <span className="text-sm font-medium text-foreground block truncate">
                            {fileName}
                          </span>
                        )}
                        <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                          {file.uploadedAt && (
                            <span>
                              {dayjs(file.uploadedAt).format('MMM DD, YYYY HH:mm')}
                            </span>
                          )}
                          {file.size && (
                            <span>{formatFileSize(file.size)}</span>
                          )}
                          {file.uploadedBy?.name && (
                            <span>by {file.uploadedBy.name}</span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {onFilePreview && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => onFilePreview(file)}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Preview file</TooltipContent>
                        </Tooltip>
                      )}
                      {fileUrl && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                              if (onFileView) {
                                onFileView(file);
                              } else if (fileUrl) {
                                window.open(fileUrl, '_blank', 'noopener');
                              }
                              }}
                            >
                              <Download className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Download file</TooltipContent>
                        </Tooltip>
                      )}
                      {onFileRemove && (
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button size="sm" variant="ghost">
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Remove attachment?</AlertDialogTitle>
                              <AlertDialogDescription>
                                Are you sure you want to remove this attachment? This action cannot be undone.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => onFileRemove(file)}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              >
                                Remove
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </TooltipProvider>
      )}
    </div>
  );
};

export default FileUpload;
