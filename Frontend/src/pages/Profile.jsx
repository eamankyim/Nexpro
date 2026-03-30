import { Link, Navigate } from 'react-router-dom';
import { User } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

/**
 * Personal account for staff; managers/admins use full Settings (profile tab).
 */
const Profile = () => {
  const { user, isManager } = useAuth();

  if (isManager) {
    return <Navigate to="/settings?tab=profile" replace />;
  }

  return (
    <div className="mx-auto max-w-lg space-y-6 p-4 md:p-8">
      <Card className="border-border">
        <CardHeader>
          <div className="flex items-center gap-2">
            <User className="h-5 w-5 text-muted-foreground" aria-hidden />
            <CardTitle>Your account</CardTitle>
          </div>
          <CardDescription>
            Organization, billing, and workspace settings are only available to managers and administrators.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1 text-sm">
            <p>
              <span className="font-medium text-foreground">Name</span>
              <br />
              <span className="text-muted-foreground">{user?.name || '—'}</span>
            </p>
            <p>
              <span className="font-medium text-foreground">Email</span>
              <br />
              <span className="text-muted-foreground">{user?.email || '—'}</span>
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:justify-end">
            <Button variant="outline" asChild>
              <Link to="/forgot-password">Reset password</Link>
            </Button>
            <Button className="bg-brand hover:bg-brand-dark" asChild>
              <Link to="/dashboard">Back to dashboard</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Profile;
