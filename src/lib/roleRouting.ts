import type { UserProfile } from "@/lib/supabaseClient";

export type Role = UserProfile["role"];

/** Landing route for a given role after sign-in. */
export function defaultRouteForRole(role: Role | null | undefined): string {
  switch (role) {
    case "agency_admin":
      return "/dashboard";
    case "school_admin":
      return "/leads";
    default:
      // Unknown / not yet provisioned → safe fallback.
      return "/leads";
  }
}

/** Routes only agency_admin can access. school_admin is blocked. */
export const AGENCY_ONLY_ROUTES = [
  "/dashboard",
  "/schools",
  "/campaigns",
  "/meta-mappings",
] as const;

export function canAccessRoute(role: Role | null | undefined, path: string): boolean {
  if (role === "agency_admin") return true;
  if (AGENCY_ONLY_ROUTES.some((r) => path === r || path.startsWith(`${r}/`))) {
    return false;
  }
  return true;
}
