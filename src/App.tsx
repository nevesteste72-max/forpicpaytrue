import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import Checkout from "./pages/Checkout";
import UpsellPage from "./pages/UpsellPage";
import ThankYouPage from "./pages/ThankYouPage";
import OrderTrackingPage from "./pages/OrderTrackingPage";
import NotFound from "./pages/NotFound";
import RefundRequest from "./pages/RefundRequest";
import Membros from "./pages/Membros";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/auth" element={<Auth />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/pay/:linkId" element={<Checkout />} />
          <Route path="/upsell/:stepId" element={<UpsellPage />} />
          <Route path="/thank-you/:linkId?" element={<ThankYouPage />} />
          <Route path="/rastreio/:transactionId" element={<OrderTrackingPage />} />
          <Route path="/refund" element={<RefundRequest />} />
          <Route path="/membros" element={<Membros />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
