import { Shield, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '../context/AuthContext';

const SupportAccessBanner = () => {
  const { supportSession, endSupportAccess, endingSupportAccess } = useAuth();

  if (!supportSession?.sessionId) return null;

  const tenantName = supportSession.tenantName || 'Tenant workspace';
  const isConfigurationMode = supportSession.mode === 'configuration';

  return (
    <div className="border-b border-amber-200 bg-amber-50 px-4 py-2 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
      <div className="flex items-start gap-2 text-amber-950">
        <Shield className="h-5 w-5 shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-semibold">
            Support access ({isConfigurationMode ? 'configuration' : 'read-only'})
          </p>
          <p className="text-xs text-amber-900/80">
            {isConfigurationMode
              ? `Configuring ${tenantName}. Only workspace settings can be changed until you exit support mode.`
              : `Viewing ${tenantName}. Changes are disabled until you exit support mode.`}
          </p>
        </div>
      </div>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="border-amber-300 bg-white shrink-0"
        disabled={endingSupportAccess}
        onClick={() => endSupportAccess()}
      >
        <LogOut className="h-4 w-4 mr-2" />
        Exit support mode
      </Button>
    </div>
  );
};

export default SupportAccessBanner;
