import { Crown, Settings, User, Truck } from 'lucide-react';
import { getWorkspaceRoleDefinition } from '../constants/workspaceRoles';

const ROLE_ICONS = {
  admin: Crown,
  manager: Settings,
  staff: User,
  driver: Truck,
  owner: Crown,
};

/**
 * Inline summary and permission bullets for a workspace role (invite / team flows).
 * @param {{ role: string }} props
 */
const WorkspaceRoleDescription = ({ role }) => {
  const definition = getWorkspaceRoleDefinition(role);
  if (!definition) return null;

  const Icon = ROLE_ICONS[role] || User;

  return (
    <div
      className="rounded-lg border border-primary/20 bg-primary/5 px-3 py-3"
      role="note"
      aria-label={`${definition.label} role permissions`}
    >
      <div className="flex items-start gap-2">
        <Icon className="h-4 w-4 text-primary shrink-0 mt-0.5" aria-hidden />
        <div className="space-y-2 min-w-0">
          <p className="text-sm font-medium text-foreground">{definition.label}</p>
          <p className="text-sm text-muted-foreground">{definition.summary}</p>
          <ul className="text-sm text-muted-foreground space-y-1 list-disc pl-4">
            {definition.permissions.map((permission) => (
              <li key={permission}>{permission}</li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
};

export default WorkspaceRoleDescription;
