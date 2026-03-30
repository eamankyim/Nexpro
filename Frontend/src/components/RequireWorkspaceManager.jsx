import { Link } from 'react-router-dom';
import { ShieldAlert } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

/**
 * Restricts children to workspace manager, admin, or owner (see AuthContext.isManager).
 * Staff cannot access settings, reports, export, or team directory via direct URL.
 *
 * @param {Object} props
 * @param {React.ReactNode} props.children
 */
export default function RequireWorkspaceManager({ children }) {
  const { isManager, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center p-6">
        <p className="text-sm text-muted-foreground">Loading…</p>
      </div>
    );
  }

  if (!isManager) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center p-4 md:p-8">
        <Card className="w-full max-w-md border-border">
          <CardHeader>
            <div className="flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-amber-600" aria-hidden />
              <CardTitle>Access restricted</CardTitle>
            </div>
            <CardDescription>
              This area is only available to workspace managers and administrators. Use{' '}
              <strong>Profile</strong> for your personal account settings.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            <Button variant="outline" asChild>
              <Link to="/dashboard">Back to dashboard</Link>
            </Button>
            <Button asChild>
              <Link to="/profile">Go to profile</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return children;
}
