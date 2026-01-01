import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import Students from "./pages/Students";
import UploadData from "./pages/UploadData";
import Verification from "./pages/Verification";
import DesignStudio from "./pages/DesignStudio";
import IDCards from "./pages/IDCards";
import PrintJobs from "./pages/PrintJobs";
import Settings from "./pages/Settings";
import AdminSchools from "./pages/AdminSchools";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/students" element={<Students />} />
            <Route path="/upload" element={<UploadData />} />
            <Route path="/verification" element={<Verification />} />
            <Route path="/design-studio" element={<DesignStudio />} />
            <Route path="/id-cards" element={<IDCards />} />
            <Route path="/print-jobs" element={<PrintJobs />} />
            <Route path="/admin/schools" element={<AdminSchools />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
