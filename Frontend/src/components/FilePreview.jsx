import { useState, useEffect } from 'react';
import { Loader2, Download } from 'lucide-react';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { SecondaryButton } from '@/components/ui/secondary-button';
import { resolveImageUrl } from '../utils/fileUtils';

/**
 * Reusable File Preview Component
 * @param {boolean} open - Whether the dialog is open
 * @param {Function} onClose - Callback when dialog is closed
 * @param {Object} file - File object with fileUrl, title, type, metadata
 * @param {boolean} loading - Optional loading state
 */
const FilePreview = ({
  open,
  onClose,
  file = null,
  loading: externalLoading = false
}) => {
  const [previewUrl, setPreviewUrl] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!open || !file) {
      // Cleanup when closing
      if (previewUrl && previewUrl.startsWith('blob:')) {
        URL.revokeObjectURL(previewUrl);
      }
      setPreviewUrl(null);
      setError(null);
      return;
    }

    const loadPreview = async () => {
      setLoading(true);
      setError(null);
      
      try {
        // Validate fileUrl exists
        if (!file?.fileUrl) {
          throw new Error('File URL is missing');
        }
        
        // Resolve relative paths (e.g. /uploads/...) so images load correctly
        const url = resolveImageUrl(file.fileUrl);
        setPreviewUrl(url);
      } catch (err) {
        console.error('Failed to load file preview:', err);
        setError('Unable to load file preview. File URL is missing.');
      } finally {
        setLoading(false);
      }
    };

    loadPreview();

    // Cleanup function
    return () => {
      if (previewUrl && previewUrl.startsWith('blob:')) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [open, file?.fileUrl]);

  const handleClose = () => {
    if (previewUrl && previewUrl.startsWith('blob:')) {
      URL.revokeObjectURL(previewUrl);
    }
    setPreviewUrl(null);
    setError(null);
    onClose();
  };

  const renderPreviewContent = () => {
    if (loading || externalLoading) {
      return (
        <div className="text-center py-12">
          <Loader2 className="h-8 w-8 animate-spin mx-auto" />
          <p className="text-sm text-muted-foreground mt-4">Loading preview...</p>
        </div>
      );
    }

    if (error) {
      return (
        <div className="text-center py-12">
          <p className="text-muted-foreground mb-4">{error}</p>
          {file?.fileUrl && (
            <Button
              variant="outline"
              onClick={() => {
                window.open(resolveImageUrl(file.fileUrl), '_blank', 'noopener');
              }}
            >
              <Download className="h-4 w-4 mr-2" />
              Open File
            </Button>
          )}
        </div>
      );
    }

    if (!previewUrl) {
      return (
        <div className="text-center py-12">
          <p className="text-muted-foreground">No preview available.</p>
        </div>
      );
    }

    const fileName = file?.title || file?.metadata?.originalName || 'File';
    const fileUrl = previewUrl || resolveImageUrl(file?.fileUrl || '') || '';
    const mimeType = file?.metadata?.mimeType || file?.type || '';
    
    // Check if it's an image by:
    // 1. Data URL (data:image/...)
    // 2. MIME type
    // 3. File extension
    const isImage = 
      fileUrl.startsWith('data:image/') ||
      mimeType.startsWith('image/') ||
      /\.(png|jpe?g|gif|bmp|webp|svg)$/i.test(fileName) ||
      /\.(png|jpe?g|gif|bmp|webp|svg)$/i.test(fileUrl);
    
    const isPdf = 
      fileUrl.startsWith('data:application/pdf') ||
      mimeType === 'application/pdf' ||
      /\.pdf$/i.test(fileName) ||
      /\.pdf$/i.test(fileUrl);

    if (isImage) {
      return (
        <div className="text-center">
          <img
            src={fileUrl}
            alt={fileName}
            loading="lazy"
            className="max-h-[60vh] object-contain mx-auto"
            onError={() => setError('Failed to load image')}
          />
        </div>
      );
    }

    if (isPdf) {
      return (
        <iframe
          title={fileName}
          src={`${fileUrl}#toolbar=1`}
          className="w-full h-[70vh] border-0"
        />
      );
    }

    return (
      <div className="flex flex-col items-center justify-center py-12">
        <p className="text-muted-foreground mb-4">Preview not available for this file type.</p>
        {file?.fileUrl && (
          <Button
            variant="outline"
            onClick={() => {
              window.open(resolveImageUrl(file.fileUrl), '_blank', 'noopener');
            }}
          >
            <Download className="h-4 w-4 mr-2" />
            Open File
          </Button>
        )}
      </div>
    );
  };

  if (!file) return null;

  const fileName = file.title || file.metadata?.originalName || 'File Preview';

  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
      if (!isOpen) handleClose();
    }}>
      <DialogContent className="sm:w-[min(92vw,1040px)] sm:min-h-[var(--modal-min-h)] sm:max-h-[var(--modal-max-h)]">
        <DialogHeader>
          <DialogTitle>{fileName}</DialogTitle>
          <DialogDescription>
            Preview and download the file
          </DialogDescription>
        </DialogHeader>
        <DialogBody className="min-h-[400px]">
          {renderPreviewContent()}
        </DialogBody>
        <DialogFooter>
          {file?.fileUrl && (
            <Button
              asChild
              variant="outline"
            >
              <a href={resolveImageUrl(file.fileUrl)} download target="_blank" rel="noopener noreferrer">
                <Download className="h-4 w-4 mr-2" />
                Download
              </a>
            </Button>
          )}
          <SecondaryButton onClick={handleClose}>
            Close
          </SecondaryButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default FilePreview;
