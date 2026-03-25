import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/ThemeProvider";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import Login from "./pages/Login";
import Projects from "./pages/Projects";
import ProjectHub from "./pages/ProjectHub";
import Workbench from "./pages/Workbench";
import LogoOutlines from "./pages/LogoOutlines";
import PatternGenerator from "./pages/PatternGenerator";
import BrandGuidelines from "./pages/BrandGuidelines";
import SharedView from "./pages/SharedView";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AuthProvider>
            <Routes>
              <Route path="/" element={<Navigate to="/projects" replace />} />
              <Route path="/login" element={<Login />} />
              <Route path="/projects" element={<ProtectedRoute><Projects /></ProtectedRoute>} />
              <Route path="/projects/:id" element={<ProtectedRoute><ProjectHub /></ProtectedRoute>} />
              <Route path="/projects/:id/export" element={<ProtectedRoute><Workbench /></ProtectedRoute>} />
              <Route path="/projects/:id/outlines" element={<ProtectedRoute><LogoOutlines /></ProtectedRoute>} />
              <Route path="/projects/:id/patterns" element={<ProtectedRoute><PatternGenerator /></ProtectedRoute>} />
              <Route path="/shared/:shareToken" element={<SharedView />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
