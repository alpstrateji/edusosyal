import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import type { Role } from "@/lib/roleRouting";

interface DemoRoleContextValue {
  role: Role;
  setRole: (role: Role) => void;
}

const STORAGE_KEY = "demo:role";
const DEFAULT_ROLE: Role = "agency_admin";

const DemoRoleContext = createContext<DemoRoleContextValue | undefined>(undefined);

export function DemoRoleProvider({ children }: { children: ReactNode }) {
  const [role, setRoleState] = useState<Role>(() => {
    if (typeof window === "undefined") return DEFAULT_ROLE;
    const stored = window.localStorage.getItem(STORAGE_KEY) as Role | null;
    return stored === "agency_admin" || stored === "school_admin" ? stored : DEFAULT_ROLE;
  });

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, role);
  }, [role]);

  return (
    <DemoRoleContext.Provider value={{ role, setRole: setRoleState }}>
      {children}
    </DemoRoleContext.Provider>
  );
}

export function useDemoRole() {
  const ctx = useContext(DemoRoleContext);
  if (!ctx) throw new Error("useDemoRole must be used within DemoRoleProvider");
  return ctx;
}
