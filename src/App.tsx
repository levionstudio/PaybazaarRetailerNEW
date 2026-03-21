import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "@/components/ui/theme-provider";
import { SidebarProvider } from "@/components/ui/sidebar";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Dashboard from "./pages/Dashboard";
import NotFound from "./pages/NotFound";
import Profile from "./pages/Profile";
import ProfileUpdate from "./pages/ProfileUpdate";
import Services from "./pages/Services";
import UtilityPayments from "./pages/UtilityServices";
import AePS from "./pages/Aeps";
import AepsKyc from "./pages/Aeps2";
import DigiKatha from "./pages/Digikhata";
import DmtPage from "./pages/Dmt";
import ChangePassword from "./pages/ChangePassword";
import ContactUs from "./pages/ContactUs";
import MyCommission from "./pages/Commission";
import RequestFunds from "./pages/FundRequestCreate";
import UserWalletTransactions from "./pages/WalletTransactions";
import Settlement from "./pages/settlement";
import ChangePasswordMpin from "./pages/settings";
import ServicesReport from "./pages/ServiceReport";
import ServiceReportSettlement from "./pages/ServiceReportSettlement";
import MyDocuments from "./pages/Documents";
import MyTickets from "./pages/Tickets";
import TDSCommissionPage from "./pages/Tds";
import MobileRecharge from "./pages/MobileRecharge";
import MobileRechargeReport from "./pages/ServiceReportRechargePrepaid";
import DTHRecharge from "./pages/DthRecharge";
import RechargeReports from "./pages/ReportsOfrecharge";
import DTHRechargeReport from "./pages/ServiceReportDth";
import UserLedger from "./pages/Ledger";
import BBPSPayments from "./pages/Bbps";
import MobileRechargePostpaid from "./pages/MobilePostpaid";
import PostpaidMobileRechargeReport from "./pages/ServiceReportMobilePostpaid";
import BBPSReports from "./pages/ReportsofBBPS";
import ElectricityBillPayment from "./pages/ElectricityBBPS";
import ElectricityBillReport from "./pages/ServiceReportBBPSElectricity";
import GetFundRequests from "./pages/FundRequestGETALL";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider defaultTheme="light" storageKey="paybazaar-ui-theme">
      <TooltipProvider>
        <SidebarProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<Login />} />
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/profile" element={<Profile />} />
              <Route path="/funds-request" element={<RequestFunds />} />
              <Route path="/profile/update" element={<ProfileUpdate />} />
              <Route path="/services" element={<Services />} />
              <Route path="/service/report" element={<ServicesReport />} />
              <Route path="/service/settlement/report" element={<ServiceReportSettlement />} />
              <Route path="/tickets" element={<MyTickets />} />
              <Route path="/documents" element={<MyDocuments />} />
              <Route path="/recharge" element={<UtilityPayments />} />
              <Route path="/bbps" element={<BBPSPayments />} />
              <Route path="/mobilerecharge" element={<MobileRecharge />} />
              <Route path="/electricity" element={<ElectricityBillPayment />} />
              <Route path="/service/electricity/recharge/report" element={<ElectricityBillReport />} />

              <Route path="/service/bbps/all" element={<BBPSReports />} />
              <Route path="/mobilerechargepostpaid" element={<MobileRechargePostpaid />} />
              <Route path="/service/postpaidrecharge/report" element={<PostpaidMobileRechargeReport />} />

              <Route path="/dthrecharge" element={<DTHRecharge />} />
              <Route path="/service/recharge/all" element={<RechargeReports />} />
              <Route path="/service/recharge/report" element={<MobileRechargeReport />} />
              <Route path="/service/dthrecharge/report" element={<DTHRechargeReport />} />
              <Route path="/aeps" element={<AePS />} />
              <Route path="/aeps2" element={<AepsKyc />} />
              <Route path="/digikatha" element={<DigiKatha />} />
              <Route path="/dmt" element={<DmtPage />} />
              <Route path="/change-password" element={<ChangePassword />} />
              <Route path="/contact-us" element={<ContactUs />} />
              <Route path="/commission" element={<MyCommission />} />
              <Route path="/funds" element={<GetFundRequests />} />
              <Route path="/transactions" element={<UserWalletTransactions />} />
              <Route path="/settlement" element={<Settlement />} />

              {/* User Ledger - Combined DTH, Mobile Recharge, and Settlement Tabs */}
              <Route path="/reports" element={<UserLedger />} />

              <Route path="/tds-commissions" element={<TDSCommissionPage />} />
              <Route path="/settings" element={<ChangePasswordMpin />} />

              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </SidebarProvider>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;