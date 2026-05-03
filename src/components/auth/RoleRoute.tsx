import { Navigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { defaultRouteForRole, type Role } from "@/lib/roleRouting";

interface RoleRouteProps {
  allow: Role[];
  children: React.ReactNode;
}

/**
 * Restricts a route to specific roles. Unauthorized roles are redirected
 * to their default landing route (no flash of forbidden content).
 */
export function RoleRoute({ allow, children }: RoleRouteProps) {
  const { profile, loading } = useAuth();

  if (loading || !profile) {
    return (
      <div className="min-h-[40vh] flex items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!allow.includes(profile.role)) {
    return <Navigate to={defaultRouteForRole(profile.role)} replace />;
  }

  return <>{children}</>;
}
