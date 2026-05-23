import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/ThemeProvider";
import { AppLayout } from "@/components/layout/AppLayout";
import { AuthProvider } from "@/contexts/AuthContext";
import { DemoRoleProvider } from "@/contexts/DemoRoleContext";
import Index from "./pages/Index.tsx";
import AgentLogs from "./pages/AgentLogs.tsx";
import ComingSoon from "./pages/ComingSoon.tsx";
import Login from "./pages/Login.tsx";
import Signup from "./pages/Signup.tsx";
import NotFound from "./pages/NotFound.tsx";
import SchoolsAdmin from "./pages/SchoolsAdmin.tsx";
import MetaMappingsAdmin from "./pages/MetaMappingsAdmin.tsx";
import Leads from "./pages/Leads.tsx";
import CampaignsAdmin from "./pages/CampaignsAdmin.tsx";
import SettingsPage from "./pages/SettingsPage.tsx";
import SchoolSetup from "./pages/SchoolSetup.tsx";

const queryClient = new QueryClient();

// Kabuk UI modu: auth gate'leri (ProtectedRoute / RoleRoute) geçici olarak kaldırıldı.
// Kullanıcı login olmadan direkt sayfalara girebilir. Auth tekrar açılırken App.tsx
// git history'den eski haline döndürülebilir. Detay: E2E_LOCAL.md
const Shell = ({ children }: { children: React.ReactNode }) => (
  <AppLayout>{children}</AppLayout>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AuthProvider>
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route path="/signup" element={<Signup />} />
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              <Route path="/dashboard" element={<Shell><Index /></Shell>} />
              <Route path="/leads" element={<Shell><Leads /></Shell>} />
              <Route path="/logs" element={<Shell><AgentLogs /></Shell>} />
              <Route path="/schools" element={<Shell><SchoolsAdmin /></Shell>} />
              <Route path="/campaigns" element={<Shell><CampaignsAdmin /></Shell>} />
              <Route path="/meta-mappings" element={<Shell><MetaMappingsAdmin /></Shell>} />
              <Route path="/settings" element={<Shell><SettingsPage /></Shell>} />
              <Route path="/school-setup" element={<Shell><SchoolSetup /></Shell>} />
              <Route path="/inbox" element={<Shell><ComingSoon title="WhatsApp Inbox" /></Shell>} />
              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
