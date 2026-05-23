import { Bell, Moon, Sun, Search, LogOut } from "lucide-react";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useTheme } from "@/components/ThemeProvider";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/contexts/AuthContext";
import { useDemoRole } from "@/contexts/DemoRoleContext";
import { useNavigate } from "react-router-dom";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { defaultRouteForRole, type Role } from "@/lib/roleRouting";

export function Topbar() {
  const { theme, toggleTheme } = useTheme();
  const { user, profile, signOut } = useAuth();
  const { role: demoRole, setRole: setDemoRole } = useDemoRole();
  const navigate = useNavigate();
  const initials = (user?.email ?? "DM").slice(0, 2).toUpperCase();
  const effectiveRole: Role = profile?.role ?? demoRole;
  const roleLabel = effectiveRole === "agency_admin" ? "Ajans Yöneticisi" : "Okul Yöneticisi";

  function handleRoleChange(next: string) {
    const r = next as Role;
    setDemoRole(r);
    navigate(defaultRouteForRole(r), { replace: true });
  }

  return (
    <header className="h-14 flex items-center gap-3 border-b border-border bg-background/80 backdrop-blur-md px-4 sticky top-0 z-30">
      <SidebarTrigger className="text-muted-foreground hover:text-foreground" />

      <div className="hidden md:flex items-center gap-2 max-w-md flex-1">
        <div className="relative w-full">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Okul, kampanya, lead ara…"
            className="pl-8 h-9 bg-muted/40 border-border focus-visible:ring-1 focus-visible:ring-ring"
          />
        </div>
      </div>

      <div className="flex-1 md:hidden" />

      <div className="flex items-center gap-1.5">
        <Select value={effectiveRole} onValueChange={handleRoleChange}>
          <SelectTrigger className="h-9 w-[170px] text-xs" aria-label="Demo rol seçici">
            <SelectValue placeholder="Rol seç" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="agency_admin">Ajans Yöneticisi</SelectItem>
            <SelectItem value="school_admin">Okul Yöneticisi</SelectItem>
          </SelectContent>
        </Select>
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleTheme}
          className="h-9 w-9 text-muted-foreground hover:text-foreground"
          aria-label="Tema değiştir"
        >
          {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9 text-muted-foreground hover:text-foreground relative"
          aria-label="Bildirimler"
        >
          <Bell className="h-4 w-4" />
          <span className="absolute top-2 right-2 h-1.5 w-1.5 rounded-full bg-primary animate-pulse-glow" />
        </Button>
        <div className="ml-2 flex items-center gap-2 pl-3 border-l border-border">
          <Avatar className="h-8 w-8">
            <AvatarFallback className="bg-gradient-primary text-primary-foreground text-xs font-semibold">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className="hidden sm:flex flex-col leading-tight">
            <span className="text-xs font-medium">{roleLabel}</span>
            <span className="text-[10px] text-muted-foreground">{user?.email ?? ""}</span>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={async () => { await signOut(); navigate("/login", { replace: true }); }}
            className="h-9 w-9 text-muted-foreground hover:text-foreground"
            aria-label="Çıkış yap"
          >
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </header>
  );
}
