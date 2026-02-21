import { Download, Share, PlusSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { usePWAInstall } from '../context/PWAInstallContext';

/**
 * PWA Install Banner Component
 * Shows install prompt for Android/Chrome or iOS instructions modal
 */
export const PWAInstallBanner = () => {
  const { 
    canInstall, 
    isIOSDevice, 
    showIOSInstructions, 
    promptInstall, 
    closeIOSInstructions 
  } = usePWAInstall();

  if (!canInstall) return null;

  return (
    <>
      {/* iOS Instructions Modal */}
      <Dialog open={showIOSInstructions} onOpenChange={closeIOSInstructions}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Download className="h-5 w-5 text-green-700" />
              Install ShopWISE
            </DialogTitle>
            <DialogDescription>
              Add ShopWISE to your home screen for quick access
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="flex items-start gap-4 p-3 bg-gray-50 rounded-lg">
              <div className="flex-shrink-0 w-8 h-8 bg-green-100 rounded-full flex items-center justify-center text-green-700 font-semibold">
                1
              </div>
              <div className="flex-1">
                <p className="font-medium text-gray-900">Tap the Share button</p>
                <p className="text-sm text-gray-500 mt-1">
                  Look for the <Share className="inline h-4 w-4" /> icon at the bottom of Safari
                </p>
              </div>
            </div>

            <div className="flex items-start gap-4 p-3 bg-gray-50 rounded-lg">
              <div className="flex-shrink-0 w-8 h-8 bg-green-100 rounded-full flex items-center justify-center text-green-700 font-semibold">
                2
              </div>
              <div className="flex-1">
                <p className="font-medium text-gray-900">Scroll and tap "Add to Home Screen"</p>
                <p className="text-sm text-gray-500 mt-1">
                  Look for <PlusSquare className="inline h-4 w-4" /> Add to Home Screen in the menu
                </p>
              </div>
            </div>

            <div className="flex items-start gap-4 p-3 bg-gray-50 rounded-lg">
              <div className="flex-shrink-0 w-8 h-8 bg-green-100 rounded-full flex items-center justify-center text-green-700 font-semibold">
                3
              </div>
              <div className="flex-1">
                <p className="font-medium text-gray-900">Tap "Add" to confirm</p>
                <p className="text-sm text-gray-500 mt-1">
                  ShopWISE will appear on your home screen
                </p>
              </div>
            </div>
          </div>

          <div className="flex justify-end">
            <Button onClick={closeIOSInstructions} variant="outline">
              Got it
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

/**
 * Install App Button Component
 * Can be used in sidebar or other locations
 */
export const InstallAppButton = ({ className = '', variant = 'ghost', showLabel = true }) => {
  const { canInstall, promptInstall, isIOSDevice } = usePWAInstall();

  if (!canInstall) return null;

  return (
    <Button
      variant={variant}
      className={className}
      onClick={promptInstall}
      title={isIOSDevice ? 'Add to Home Screen' : 'Install App'}
    >
      <Download className="h-4 w-4" />
      {showLabel && <span className="ml-2">Install App</span>}
    </Button>
  );
};

export default PWAInstallBanner;
