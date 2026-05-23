import { LayoutDashboard, Terminal, School, MessageSquare, Sparkles, Tag, Users, Megaphone, Settings } from "lucide-react";
import { NavLink, useLocation } from "react-router-dom";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";

import { useAuth } from "@/contexts/AuthContext";
import { useDemoRole } from "@/contexts/DemoRoleContext";
import { canAccessRoute } from "@/lib/roleRouting";

const mainItems = [
  { title: "Ajans Paneli", url: "/dashboard", icon: LayoutDashboard },
  { title: "Lead'ler", url: "/leads", icon: Users },
  { title: "Kampanyalar", url: "/campaigns", icon: Megaphone },
  { title: "Okullar", url: "/schools", icon: School },
  { title: "Okul Kurulumu", url: "/school-setup", icon: School },
  { title: "Ajan Logları", url: "/logs", icon: Terminal },
  { title: "Meta Eşlemeleri", url: "/meta-mappings", icon: Tag },
  { title: "Ayarlar", url: "/settings", icon: Settings },
];

const stubItems = [
  { title: "WhatsApp Kutusu", url: "/inbox", icon: MessageSquare },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();
  const { profile } = useAuth();
  // Kabuk UI modu: profile yoksa tüm menüyü göster (auth bypass).
  const visibleMain = profile
    ? mainItems.filter((i) => canAccessRoute(profile.role, i.url))
    : mainItems;

  const isActive = (path: string) =>
    path === "/dashboard" ? location.pathname === "/dashboard" : location.pathname.startsWith(path);

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border">
      <SidebarHeader className="border-b border-sidebar-border h-14 flex items-center justify-center px-3">
        <div className="flex items-center gap-2 w-full">
          <div className="h-8 w-8 rounded-md bg-gradient-primary flex items-center justify-center shrink-0 shadow-glow">
            <Sparkles className="h-4 w-4 text-primary-foreground" />
          </div>
          {!collapsed && (
            <div className="flex flex-col leading-tight">
              <span className="text-sm font-semibold text-sidebar-foreground">Edusonex</span>
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                AaaS Platformu
              </span>
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent className="py-2">
        <SidebarGroup>
          <SidebarGroupLabel className="text-[10px] uppercase tracking-wider text-muted-foreground/70">
            Çalışma Alanı
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {visibleMain.map((item) => {
                const active = isActive(item.url);
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild isActive={active}>
                      <NavLink
                        to={item.url}
                        end={item.url === "/dashboard"}
                        className={cn(
                          "transition-colors",
                          active &&
                            "bg-sidebar-accent text-sidebar-accent-foreground font-medium",
                        )}
                      >
                        <item.icon className="h-4 w-4" />
                        <span>{item.title}</span>
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel className="text-[10px] uppercase tracking-wider text-muted-foreground/70">
            Yakında
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {stubItems.map((item) => {
                const active = isActive(item.url);
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild isActive={active}>
                      <NavLink
                        to={item.url}
                        className={cn(
                          "transition-colors opacity-70",
                          active &&
                            "bg-sidebar-accent text-sidebar-accent-foreground font-medium opacity-100",
                        )}
                      >
                        <item.icon className="h-4 w-4" />
                        <span>{item.title}</span>
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
