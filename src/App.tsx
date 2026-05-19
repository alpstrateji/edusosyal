import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/ThemeProvider";
import { AppLayout } from "@/components/layout/AppLayout";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { RoleRoute } from "@/components/auth/RoleRoute";
import { RoleLanding } from "@/components/auth/RoleLanding";
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

const Protected = ({ children }: { children: React.ReactNode }) => (
  <ProtectedRoute>
    <AppLayout>{children}</AppLayout>
  </ProtectedRoute>
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
              <Route path="/" element={<Protected><RoleLanding /></Protected>} />
              <Route path="/dashboard" element={<Protected><RoleRoute allow={["agency_admin"]}><Index /></RoleRoute></Protected>} />
              <Route path="/leads" element={<Protected><Leads /></Protected>} />
              <Route path="/logs" element={<Protected><AgentLogs /></Protected>} />
              <Route path="/schools" element={<Protected><RoleRoute allow={["agency_admin"]}><SchoolsAdmin /></RoleRoute></Protected>} />
              <Route path="/campaigns" element={<Protected><RoleRoute allow={["agency_admin"]}><CampaignsAdmin /></RoleRoute></Protected>} />
              <Route path="/meta-mappings" element={<Protected><RoleRoute allow={["agency_admin"]}><MetaMappingsAdmin /></RoleRoute></Protected>} />
              <Route path="/settings" element={<Protected><SettingsPage /></Protected>} />
              <Route path="/school-setup" element={<Protected><SchoolSetup /></Protected>} />
              <Route path="/inbox" element={<Protected><ComingSoon title="WhatsApp Inbox" /></Protected>} />
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
