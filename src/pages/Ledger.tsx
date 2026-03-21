import { useState, useEffect } from "react";
import { jwtDecode } from "jwt-decode";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { AppSidebar } from "@/components/layout/AppSidebar";
import { Header } from "@/components/layout/Header";
import { ArrowLeft, Tv, Smartphone, DollarSign, Phone, Zap, IndianRupee } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import DTHLedger from "./DTHLedger";
import MobileRechargeLedger from "./MobileRechargeLedger";
import SettlementLedger from "./SettlementLedger";
import PostpaidMobileRechargeLedger from "./PostPaidMobileRechargeLedger";
import ElectricityBillLedger from "./ElectricityLegder";

interface TokenData {
  user_id: string;
  user_name: string;
  exp: number;
}

export default function UserLedger() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [tokenData, setTokenData] = useState<TokenData | null>(null);
  const [activeTab, setActiveTab] = useState("settlement");

  // Decode token
  useEffect(() => {
    const token = localStorage.getItem("authToken");
    if (!token) {
      toast({
        title: "Authentication required",
        description: "Please login to continue.",
        variant: "destructive",
      });
      navigate("/login");
      return;
    }

    try {
      const decoded: TokenData = jwtDecode(token);
      if (!decoded?.exp || decoded.exp * 1000 < Date.now()) {
        toast({
          title: "Session expired",
          description: "Login again.",
          variant: "destructive",
        });
        localStorage.removeItem("authToken");
        navigate("/login");
        return;
      }
      setTokenData(decoded);
    } catch (error) {
      toast({
        title: "Invalid token",
        description: "Please login.",
        variant: "destructive",
      });
      navigate("/login");
    }
  }, [navigate, toast]);

  if (!tokenData) {
    return (
      <div className="flex min-h-screen w-full bg-gray-50">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <Header />
          <motion.main 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex-1 flex items-center justify-center"
          >
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
              <p className="text-gray-600">Loading...</p>
            </div>
          </motion.main>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen w-full bg-gray-50">
      <AppSidebar />

      <div className="flex-1 flex flex-col min-w-0">
        <Header />

        <motion.main 
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="flex-1 p-6 space-y-6 overflow-auto"
        >
          {/* Header Section */}
          <div className="paybazaar-gradient rounded-lg p-6 text-white shadow-lg">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigate(-1)}
                className="text-white hover:bg-white/20"
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div>
                <h1 className="text-2xl font-bold">User Ledger</h1>
                <p className="text-white/90 text-sm mt-1">
                  View and manage your transaction history across all services
                </p>
              </div>
            </div>
          </div>

          {/* Tabs with Icons and Animations */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
            <div className="bg-white rounded-lg shadow-sm p-2">
              <TabsList className="grid w-full grid-cols-5 h-auto bg-gray-100 rounded-lg p-1 gap-1">
                   <TabsTrigger 
                  value="settlement" 
                  className="data-[state=active]:bg-white data-[state=active]:shadow-sm transition-all duration-200 ease-in-out hover:bg-white/50 rounded-md py-3 px-4"
                >
                  <div className="flex items-center gap-2">
                    <IndianRupee className="h-4 w-4" />
                    <span className="hidden sm:inline">Settlement</span>
                    <span className="sm:hidden">Settlement</span>
                  </div>
                </TabsTrigger>
                <TabsTrigger 
                  value="dth" 
                  className="data-[state=active]:bg-white data-[state=active]:shadow-sm transition-all duration-200 ease-in-out hover:bg-white/50 rounded-md py-3 px-4"
                >
                  <div className="flex items-center gap-2">
                    <Tv className="h-4 w-4" />
                    <span className="hidden sm:inline">DTH Recharge</span>
                    <span className="sm:hidden">DTH</span>
                  </div>
                </TabsTrigger>

                <TabsTrigger 
                  value="mobile" 
                  className="data-[state=active]:bg-white data-[state=active]:shadow-sm transition-all duration-200 ease-in-out hover:bg-white/50 rounded-md py-3 px-4"
                >
                  <div className="flex items-center gap-2">
                    <Smartphone className="h-4 w-4" />
                    <span className="hidden sm:inline">Mobile Recharge</span>
                    <span className="sm:hidden">Mobile</span>
                  </div>
                </TabsTrigger>

                <TabsTrigger 
                  value="postpaid" 
                  className="data-[state=active]:bg-white data-[state=active]:shadow-sm transition-all duration-200 ease-in-out hover:bg-white/50 rounded-md py-3 px-4"
                >
                  <div className="flex items-center gap-2">
                    <Phone className="h-4 w-4" />
                    <span className="hidden sm:inline">Postpaid</span>
                    <span className="sm:hidden">Postpaid</span>
                  </div>
                </TabsTrigger>

                <TabsTrigger 
                  value="electricity" 
                  className="data-[state=active]:bg-white data-[state=active]:shadow-sm transition-all duration-200 ease-in-out hover:bg-white/50 rounded-md py-3 px-4"
                >
                  <div className="flex items-center gap-2">
                    <Zap className="h-4 w-4" />
                    <span className="hidden sm:inline">Electricity</span>
                    <span className="sm:hidden">Electric</span>
                  </div>
                </TabsTrigger>

             
              </TabsList>
            </div>

            <TabsContent 
              value="settlement" 
              className="animate-in fade-in-50 duration-300"
            >
              <SettlementLedger userId={tokenData.user_id} />
            </TabsContent>

            <TabsContent 
              value="dth" 
              className="animate-in fade-in-50 duration-300"
            >
              <DTHLedger userId={tokenData.user_id} />
            </TabsContent>

            <TabsContent 
              value="mobile" 
              className="animate-in fade-in-50 duration-300"
            >
              <MobileRechargeLedger userId={tokenData.user_id} />
            </TabsContent>

            <TabsContent 
              value="postpaid" 
              className="animate-in fade-in-50 duration-300"
            >
              <PostpaidMobileRechargeLedger userId={tokenData.user_id} />
            </TabsContent>

            <TabsContent 
              value="electricity" 
              className="animate-in fade-in-50 duration-300"
            >
              <ElectricityBillLedger userId={tokenData.user_id} />
            </TabsContent>
          </Tabs>
        </motion.main>
      </div>
    </div>
  );
}