import { LayoutDashboard, Terminal, School, MessageSquare, Sparkles, Tag, Users, Megaphone } from "lucide-react";
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

const mainItems = [
  { title: "Agency Dashboard", url: "/dashboard", icon: LayoutDashboard },
  { title: "Leads", url: "/leads", icon: Users },
  { title: "Campaigns", url: "/campaigns", icon: Megaphone },
  { title: "Schools", url: "/schools", icon: School },
  { title: "Agent Logs", url: "/logs", icon: Terminal },
  { title: "Meta Mappings", url: "/meta-mappings", icon: Tag },
];

const stubItems = [
  { title: "WhatsApp Inbox", url: "/inbox", icon: MessageSquare },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();

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
                AaaS Platform
              </span>
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent className="py-2">
        <SidebarGroup>
          <SidebarGroupLabel className="text-[10px] uppercase tracking-wider text-muted-foreground/70">
            Workspace
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {mainItems.map((item) => {
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
            Coming soon
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
