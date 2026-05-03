import { Navigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { defaultRouteForRole } from "@/lib/roleRouting";

/** Redirects "/" to the right landing page based on the user's role. */
export function RoleLanding() {
  const { profile, loading } = useAuth();

  if (loading || !profile) {
    return (
      <div className="min-h-[40vh] flex items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return <Navigate to={defaultRouteForRole(profile.role)} replace />;
}
