import { useEffect, useState } from "react";
import { AppSidebar } from "@/components/layout/AppSidebar";
import { Header } from "@/components/layout/Header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  Smartphone,
  Zap,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  ArrowLeft,
  Search,
  X,
  Loader2,
  WifiOff,
  AlertTriangle,
  Receipt,
} from "lucide-react";
import axios from "axios";
import { jwtDecode, JwtPayload } from "jwt-decode";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useNavigate } from "react-router-dom";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

const getAuthHeaders = () => {
  const token = localStorage.getItem("authToken");
  return {
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  };
};

interface Operator {
  operator_code: number;
  operator_name: string;
}

interface Circle {
  circle_code: number;
  circle_name: string;
}

interface Plan {
  rs: number;
  desc: string;
  validity?: string;
  category?: string;
  planName?: string;
  amount?: number;
  planDescription?: string;
  planBenefitItemList?: any[];
  [key: string]: any;
}

interface RechargeHistory {
  retailer_id: string;
  mobile_recharge_transaction_id: number;
  mobile_number: string;
  operator_code: number;
  operator_name: string;
  amount: number;
  circle_code: number;
  circle_name: string;
  recharge_type: string;
  partner_request_id: string;
  created_at: string;
  commision: number;
  status: string;
}

interface ReceiptData {
  mobileNumber: string;
  operatorName: string;
  circleName: string;
  amount: number;
  transactionId?: string | number;
  partnerRequestId: string;
  status: string;
  createdAt: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Receipt: clean white, half-A4 (148mm), matches the PDF design exactly
// Layout: RECEIPT title → company → UTR/TxnID → STATUS box → details grid →
//         amount row → footer
// ─────────────────────────────────────────────────────────────────────────────
const openReceiptInNewTab = (data: ReceiptData, retailerProfile: any) => {
  const formatDate = (d: string) => {
    try {
      return new Date(d).toLocaleString("en-IN", {
        year: "numeric", month: "2-digit", day: "2-digit",
        hour: "2-digit", minute: "2-digit", second: "2-digit",
      });
    } catch { return d; }
  };

  const fmtAmount = (v: number) =>
    v.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const statusUp = data.status.toUpperCase();

  const tab = window.open("", "_blank");
  if (!tab) return;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1.0"/>
  <title>Recharge Receipt - ${data.mobileNumber}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
    
    * { margin:0; padding:0; box-sizing:border-box; font-family: 'Inter', sans-serif; }
    body { background: #f0f2f5; padding: 40px 20px; color: #1a1a1a; }
    
    .receipt-container {
      max-width: 600px;
      margin: 0 auto;
      background: #fff;
      border: 2px solid #000;
      position: relative;
    }
    
    .header {
      display: flex;
      border-bottom: 2px solid #000;
      align-items: center;
    }
    
    .logo-section {
      padding: 20px;
      border-right: 2px solid #000;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      background: #fff;
    }
    
    .logo-placeholder {
      font-weight: 800;
      font-size: 24px;
      color: #000;
      letter-spacing: -1px;
    }
    
    .logo-sub {
      font-size: 9px;
      font-weight: 700;
      letter-spacing: 2px;
      color: #666;
      margin-top: -4px;
    }
    
    .header-info {
      padding: 20px;
      flex: 1;
    }
    
    .shop-name { font-weight: 800; font-size: 18px; text-transform: uppercase; margin-bottom: 4px; }
    .shop-detail { font-size: 12px; color: #444; margin-bottom: 2px; font-weight: 500; }
    
    .receipt-title-bar {
      background: #000;
      color: #fff;
      padding: 8px 20px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-weight: 700;
      font-size: 14px;
      text-transform: uppercase;
      letter-spacing: 1px;
    }
    
    .status-badge {
      padding: 4px 12px;
      border-radius: 4px;
      font-size: 12px;
      background: ${statusUp === 'SUCCESS' ? '#00c853' : statusUp === 'FAILED' ? '#ff1744' : '#ffab00'};
      color: #fff;
    }
    
    .details-grid {
      display: grid;
      grid-template-cols: 1fr 1fr;
      border-bottom: 2px solid #000;
    }
    
    .detail-item {
      padding: 15px 20px;
      border-right: 1px solid #eee;
      border-bottom: 1px solid #eee;
    }
    .detail-item:nth-child(2n) { border-right: none; }
    
    .label { font-size: 11px; font-weight: 600; color: #666; text-transform: uppercase; margin-bottom: 4px; }
    .value { font-size: 14px; font-weight: 700; color: #000; }
    
    .amount-section {
      padding: 30px 20px;
      background: #f9f9f9;
      text-align: center;
      border-bottom: 2px solid #000;
    }
    
    .amount-label { font-size: 14px; font-weight: 600; color: #444; margin-bottom: 10px; }
    .amount-value { font-size: 48px; font-weight: 800; color: #000; }
    
    .footer {
      padding: 20px;
      text-align: center;
      font-size: 11px;
      color: #888;
      line-height: 1.6;
    }
    
    .actions {
      max-width: 600px;
      margin: 20px auto 0;
      display: flex;
      gap: 15px;
      justify-content: center;
    }
    
    .btn {
      padding: 12px 24px;
      border-radius: 8px;
      font-weight: 700;
      cursor: pointer;
      border: none;
      transition: all 0.2s;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    
    .btn-print { background: #000; color: #fff; }
    .btn-print:hover { transform: translateY(-2px); box-shadow: 0 4px 12px rgba(0,0,0,0.2); }
    
    @media print {
      body { background: #fff; padding: 0; }
      .actions { display: none; }
      .receipt-container { border: 2px solid #000; margin: 0; max-width: 100%; }
    }
  </style>
</head>
<body>
  <div class="receipt-container">
    <div class="header">
      <div class="logo-section">
        <div class="logo-placeholder">PAYBAZAR</div>
        <div class="logo-sub">TECHNOLOGIES</div>
      </div>
      <div class="header-info">
        <div class="shop-name">${retailerProfile?.business_name || "Paybazaar Retailer"}</div>
        <div class="shop-detail">Prop: ${retailerProfile?.retailer_name || "Merchant"}</div>
        <div class="shop-detail">Mob: ${retailerProfile?.retailer_phone || "N/A"}</div>
        <div class="shop-detail">ID: ${retailerProfile?.retailer_id || "N/A"}</div>
      </div>
    </div>
    
    <div class="receipt-title-bar">
      <span>Transaction Receipt</span>
      <span class="status-badge">${statusUp}</span>
    </div>
    
    <div class="details-grid">
      <div class="detail-item">
        <div class="label">Transaction Date</div>
        <div class="value">${formatDate(data.createdAt)}</div>
      </div>
      <div class="detail-item">
        <div class="label">Service Type</div>
        <div class="value">Mobile Recharge (Prepaid)</div>
      </div>
      <div class="detail-item">
        <div class="label">Mobile Number</div>
        <div class="value">${data.mobileNumber}</div>
      </div>
      <div class="detail-item">
        <div class="label">Operator</div>
        <div class="value">${data.operatorName}</div>
      </div>
      <div class="detail-item">
        <div class="label">Circle</div>
        <div class="value">${data.circleName}</div>
      </div>
      <div class="detail-item">
        <div class="label">Txn ID / UTR</div>
        <div class="value">${data.transactionId || data.partnerRequestId}</div>
      </div>
    </div>
    
    <div class="amount-section">
      <div class="amount-label">TOTAL AMOUNT PAID</div>
      <div class="amount-value">₹${fmtAmount(data.amount)}</div>
    </div>
    
    <div class="footer">
      <p>Thank you for choosing Paybazaar Technologies.</p>
      <p>This is a computer-generated receipt, no signature required.</p>
    </div>
  </div>
  
  <div class="actions">
    <button class="btn btn-print" onclick="window.print()">Print Receipt</button>
  </div>
</body>
</html>`;

  tab.document.open();
  tab.document.write(html);
  tab.document.close();
};

const MobileRecharge = () => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [retailerId, setRetailerId] = useState("");
  const [retailerProfile, setRetailerProfile] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingOperators, setIsLoadingOperators] = useState(true);
  const [isLoadingCircles, setIsLoadingCircles] = useState(true);
  const [operators, setOperators] = useState<Operator[]>([]);
  const [filteredOperators, setFilteredOperators] = useState<Operator[]>([]);
  const [operatorSearchQuery, setOperatorSearchQuery] = useState("");
  const [circles, setCircles] = useState<Circle[]>([]);
  const [filteredCircles, setFilteredCircles] = useState<Circle[]>([]);
  const [circleSearchQuery, setCircleSearchQuery] = useState("");
  const [plans, setPlans] = useState<Plan[]>([]);
  const [isLoadingPlans, setIsLoadingPlans] = useState(false);
  const [showPlansDialog, setShowPlansDialog] = useState(false);
  const [selectedPlanCategory, setSelectedPlanCategory] = useState<string>("all");
  const [rechargeHistory, setRechargeHistory] = useState<RechargeHistory[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  // Success state for receipt
  const [showSuccessDialog, setShowSuccessDialog] = useState(false);
  const [pendingReceipt, setPendingReceipt] = useState<ReceiptData | null>(null);

  const [rechargeForm, setRechargeForm] = useState({
    mobileNumber: "",
    operatorCode: "",
    operatorName: "",
    circleCode: "",
    circleName: "",
    amount: "",
  });

  // ── JWT decode ──
  useEffect(() => {
    const token = localStorage.getItem("authToken");
    if (!token) {
      toast({ title: "⚠️ Authentication Required", description: "Please log in to access mobile recharge services", variant: "destructive" });
      navigate("/login");
      return;
    }
    try {
      const decoded: JwtPayload = jwtDecode(token);
      //@ts-ignore
      const userId = decoded.retailer_id || decoded.data?.user_id || decoded.user_id;
      if (!userId) {
        toast({ title: "⚠️ Session Error", description: "Unable to verify your identity. Please log in again.", variant: "destructive" });
        navigate("/login");
        return;
      }
      setRetailerId(userId);

      // Fetch retailer profile
      const fetchProfile = async () => {
        try {
          const profileRes = await axios.get(
            `${import.meta.env.VITE_API_BASE_URL}/retailer/get/retailer/${userId}`,
            { headers: { Authorization: `Bearer ${token}` } }
          );
          if (profileRes.data.status === "success") {
            setRetailerProfile(profileRes.data.data.retailer);
          }
        } catch (err) {
          console.error("Profile fetch error:", err);
        }
      };
      fetchProfile();
    } catch {
      toast({ title: "⚠️ Session Expired", description: "Your session has expired. Please log in again to continue.", variant: "destructive" });
      navigate("/login");
    }
  }, [toast, navigate]);

  // ── Fetch operators (prepaid only) ──
  useEffect(() => {
    const run = async () => {
      setIsLoadingOperators(true);
      try {
        const res = await axios.get(`${API_BASE_URL}/mobile_recharge/get/operators`, getAuthHeaders());
        const data = res.data?.data?.operators || [];
        if (!Array.isArray(data)) throw new Error();
        const prepaid = data.filter((op: Operator) => !op.operator_name.toLowerCase().includes("postpaid"));
        setOperators(prepaid);
        setFilteredOperators(prepaid);
      } catch (error: any) {
        setOperators([]); setFilteredOperators([]);
        let msg = "Unable to load operators.";
        if (!navigator.onLine) msg = "No internet connection.";
        else if (error.response?.status === 401) msg = "Session expired. Please log in again.";
        toast({ title: "❌ Failed to Load Operators", description: msg, variant: "destructive" });
      } finally { setIsLoadingOperators(false); }
    };
    run();
  }, [toast]);

  // ── Fetch circles ──
  useEffect(() => {
    const run = async () => {
      setIsLoadingCircles(true);
      try {
        const res = await axios.get(`${API_BASE_URL}/mobile_recharge/get/circle`, getAuthHeaders());
        const data = res.data?.data?.circles || [];
        if (!Array.isArray(data)) throw new Error();
        setCircles(data); setFilteredCircles(data);
      } catch (error: any) {
        setCircles([]); setFilteredCircles([]);
        let msg = "Unable to load circles.";
        if (!navigator.onLine) msg = "No internet connection.";
        else if (error.response?.status === 401) msg = "Session expired. Please log in again.";
        toast({ title: "❌ Failed to Load Circles", description: msg, variant: "destructive" });
      } finally { setIsLoadingCircles(false); }
    };
    run();
  }, [toast]);

  // ── Search filters ──
  useEffect(() => {
    setFilteredOperators(
      operatorSearchQuery.trim() === "" ? operators
        : operators.filter((op) => op.operator_name.toLowerCase().includes(operatorSearchQuery.toLowerCase()))
    );
  }, [operatorSearchQuery, operators]);

  useEffect(() => {
    setFilteredCircles(
      circleSearchQuery.trim() === "" ? circles
        : circles.filter((c) => c.circle_name.toLowerCase().includes(circleSearchQuery.toLowerCase()))
    );
  }, [circleSearchQuery, circles]);

  // ── Recharge history ──
  const fetchRechargeHistory = async () => {
    if (!retailerId) return;
    setIsLoadingHistory(true);
    try {
      const res = await axios.get(`${API_BASE_URL}/mobile_recharge/get/${retailerId}`, getAuthHeaders());
      const data = res.data?.data?.recharges || [];
      if (!Array.isArray(data)) throw new Error();
      setRechargeHistory(data);
    } catch (error: any) {
      setRechargeHistory([]);
      if (error.response?.status !== 404) {
        toast({ title: "⚠️ History Load Failed", description: "Unable to load your recharge history.", variant: "destructive" });
      }
    } finally { setIsLoadingHistory(false); }
  };
  useEffect(() => { if (retailerId) fetchRechargeHistory(); }, [retailerId]);

  // ── Fetch plans ──
  const fetchPlans = async () => {
    if (!rechargeForm.operatorCode || !rechargeForm.circleCode) {
      toast({ title: "⚠️ Missing Information", description: "Please select both operator and circle before browsing plans", variant: "destructive" });
      return;
    }
    setIsLoadingPlans(true);
    try {
      const res = await axios.post(
        `${API_BASE_URL}/mobile_recharge/get/plans`,
        { operator_code: parseInt(rechargeForm.operatorCode), circle: parseInt(rechargeForm.circleCode) },
        getAuthHeaders()
      );
      const apiData = res.data?.data;
      if (apiData?.planData?.length > 0) {
        const planObj = apiData.planData[0].plan;
        const allPlans: Plan[] = [];
        Object.keys(planObj).forEach((cat) => {
          const arr = planObj[cat];
          if (Array.isArray(arr)) {
            arr.forEach((p: any) => allPlans.push({ rs: p.amount, desc: p.planDescription || p.planName || "", validity: p.validity || "NA", category: cat, planName: p.planName, ...p }));
          }
        });
        if (allPlans.length > 0) {
          setPlans(allPlans); setShowPlansDialog(true);
          toast({ title: "✓ Plans Loaded", description: `Found ${allPlans.length} plans for ${rechargeForm.operatorName}` });
        } else {
          toast({ title: "⚠️ No Plans Available", description: `No plans for ${rechargeForm.operatorName} in ${rechargeForm.circleName}`, variant: "destructive" });
        }
      } else {
        toast({ title: "⚠️ No Plans Found", description: res.data?.message || "No plans available", variant: "destructive" });
      }
    } catch (error: any) {
      let msg = "Unable to load recharge plans.";
      if (error.response?.status === 404) msg = `No plans for ${rechargeForm.operatorName} in ${rechargeForm.circleName}`;
      else if (error.response?.data?.message) msg = error.response.data.message;
      toast({ title: "❌ Failed to Load Plans", description: msg, variant: "destructive" });
    } finally { setIsLoadingPlans(false); }
  };

  const getPlanCategories = () => { const s = new Set<string>(); plans.forEach((p) => { if (p.category) s.add(p.category); }); return Array.from(s); };
  const getPlanCountByCategory = (cat: string) => plans.filter((p) => p.category === cat).length;
  const getFilteredPlans = () => selectedPlanCategory === "all" ? plans : plans.filter((p) => p.category === selectedPlanCategory);

  const handleOperatorChange = (value: string) => {
    const sel = operators.find((op) => op.operator_code.toString() === value);
    if (sel) { setRechargeForm({ ...rechargeForm, operatorCode: value, operatorName: sel.operator_name }); toast({ title: "✓ Operator Selected", description: sel.operator_name }); }
  };

  const handleCircleChange = (value: string) => {
    const sel = circles.find((c) => c.circle_code.toString() === value);
    if (sel) { setRechargeForm({ ...rechargeForm, circleCode: value, circleName: sel.circle_name }); toast({ title: "✓ Circle Selected", description: sel.circle_name }); }
  };

  const handlePlanSelect = (plan: Plan) => {
    setRechargeForm({ ...rechargeForm, amount: plan.rs.toString() });
    setShowPlansDialog(false);
    toast({ title: "✓ Plan Selected", description: `₹${plan.rs}${plan.validity && plan.validity !== "NA" ? ` • ${plan.validity}` : ""}` });
  };

  const validateMobileNumber = (n: string) => /^[6-9]\d{9}$/.test(n);

  // ── Submit ──
  const handleRechargeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!retailerId) { toast({ title: "⚠️ Session Error", description: "Please log in again.", variant: "destructive" }); navigate("/login"); return; }
    if (!rechargeForm.mobileNumber) { toast({ title: "⚠️ Mobile Number Required", description: "Please enter the mobile number.", variant: "destructive" }); return; }
    if (!validateMobileNumber(rechargeForm.mobileNumber)) { toast({ title: "⚠️ Invalid Mobile Number", description: "Enter a valid 10-digit number starting with 6, 7, 8, or 9.", variant: "destructive" }); return; }
    if (!rechargeForm.operatorCode) { toast({ title: "⚠️ Operator Not Selected", description: "Please select the mobile operator.", variant: "destructive" }); return; }
    if (!rechargeForm.circleCode) { toast({ title: "⚠️ Circle Not Selected", description: "Please select the telecom circle.", variant: "destructive" }); return; }
    if (!rechargeForm.amount) { toast({ title: "⚠️ Amount Required", description: "Please enter the recharge amount.", variant: "destructive" }); return; }

    const amount = parseFloat(rechargeForm.amount);
    if (isNaN(amount) || amount <= 0) { toast({ title: "⚠️ Invalid Amount", description: "Enter a valid amount greater than ₹0.", variant: "destructive" }); return; }
    if (amount < 10)    { toast({ title: "⚠️ Amount Too Low",  description: "Minimum recharge amount is ₹10.", variant: "destructive" }); return; }
    if (amount > 10000) { toast({ title: "⚠️ Amount Too High", description: "Maximum recharge amount is ₹10,000.", variant: "destructive" }); return; }

    setIsLoading(true);
    const partnerRequestId = `REQ_${Date.now()}`;

    try {
      const response = await axios.post(
        `${API_BASE_URL}/mobile_recharge/create`,
        {
          retailer_id: retailerId,
          mobile_number: parseInt(rechargeForm.mobileNumber),
          operator_code: parseInt(rechargeForm.operatorCode),
          operator_name: rechargeForm.operatorName,
          amount,
          circle_code: parseInt(rechargeForm.circleCode),
          circle_name: rechargeForm.circleName,
          recharge_type: "1",
          partner_request_id: partnerRequestId,
          commision: 0,
          status: "pending",
        },
        getAuthHeaders()
      );

      if (response.status === 200 || response.status === 201) {
        const transactionId =
          response.data?.data?.mobile_recharge_transaction_id ||
          response.data?.data?.transaction_id ||
          response.data?.data?.id ||
          undefined;

        const rechargeStatus = response.data?.data?.status || "Success";

        toast({ title: "🎉 Recharge Successful!", description: `₹${amount} recharged to ${rechargeForm.mobileNumber} (${rechargeForm.operatorName})` });

        // ── Show Success Dialog and set receipt data ──
        setPendingReceipt({
          mobileNumber: rechargeForm.mobileNumber,
          operatorName: rechargeForm.operatorName,
          circleName: rechargeForm.circleName,
          amount,
          transactionId,
          partnerRequestId,
          status: rechargeStatus,
          createdAt: new Date().toISOString(),
        });
        setShowSuccessDialog(true);

        setRechargeForm({ mobileNumber: "", operatorCode: "", operatorName: "", circleCode: "", circleName: "", amount: "" });
        fetchRechargeHistory();
      }
    } catch (error: any) {
      let errorTitle = "❌ Recharge Failed";
      let errorMessage = "Unable to process your recharge. Please try again.";
      if (error.response?.data?.message)        errorMessage = error.response.data.message;
      else if (error.response?.status === 400)  { errorTitle = "⚠️ Invalid Request";      errorMessage = "The recharge information is invalid. Please check and try again."; }
      else if (error.response?.status === 401)  { errorTitle = "🔒 Session Expired";      errorMessage = "Your session has expired. Please log in again."; }
      else if (error.response?.status === 402)  { errorTitle = "💰 Insufficient Balance"; errorMessage = "Not enough balance. Please add funds to your wallet."; }
      else if (error.response?.status === 403)  { errorTitle = "🚫 Access Denied";        errorMessage = "You don't have permission to perform this recharge."; }
      else if (error.response?.status === 500)  { errorTitle = "⚠️ Server Error";         errorMessage = "Server error. Please try again later."; }
      else if (error.response?.status === 503)  { errorTitle = "⚠️ Service Unavailable";  errorMessage = "Service is down for maintenance. Try again in a few minutes."; }
      else if (!navigator.onLine)               { errorTitle = "📡 No Internet";           errorMessage = "Please check your internet connection."; }
      toast({ title: errorTitle, description: errorMessage, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status.toLowerCase()) {
      case "success": return <Badge className="bg-green-500/10 text-green-600 hover:bg-green-500/20"><CheckCircle2 className="w-3 h-3 mr-1" />Success</Badge>;
      case "pending": return <Badge className="bg-amber-500/10 text-amber-600 hover:bg-amber-500/20"><RefreshCw className="w-3 h-3 mr-1" />Pending</Badge>;
      case "failed":  return <Badge className="bg-red-500/10 text-red-600 hover:bg-red-500/20"><AlertCircle className="w-3 h-3 mr-1" />Failed</Badge>;
      default:        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="flex min-h-screen w-full bg-background">
      <AppSidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Header />
        <div className="flex-1 p-6 overflow-y-auto">
          <div className="max-w-6xl mx-auto space-y-8">

            <Button variant="ghost" onClick={() => navigate("/recharge")} className="gap-2 hover:bg-muted/50">
              <ArrowLeft className="w-4 h-4" />Back to Recharge
            </Button>

            {/* Recharge Card */}
            <Card className="shadow-lg border-border/50">
              <CardHeader className="paybazaar-gradient text-white rounded-t-xl space-y-1 pb-6">
                <CardTitle className="flex items-center gap-2 text-xl">
                  <Smartphone className="w-5 h-5" />Mobile Recharge - Prepaid
                </CardTitle>
                <p className="text-sm text-white/90">Instant recharge for all major prepaid mobile operators</p>
              </CardHeader>

              <CardContent className="pt-6 pb-8 px-6">
                <form onSubmit={handleRechargeSubmit} className="space-y-6">

                  {/* Mobile Number */}
                  <div className="space-y-2">
                    <Label htmlFor="mobileNumber" className="text-sm font-medium">Mobile Number <span className="text-red-500">*</span></Label>
                    <Input id="mobileNumber" type="tel" placeholder="Enter 10-digit mobile number"
                      value={rechargeForm.mobileNumber}
                      onChange={(e) => { const v = e.target.value.replace(/\D/g, ""); if (v.length <= 10) setRechargeForm({ ...rechargeForm, mobileNumber: v }); }}
                      maxLength={10} inputMode="numeric" required disabled={isLoading} className="h-12 text-base" />
                    {rechargeForm.mobileNumber.length > 0 && rechargeForm.mobileNumber.length < 10 && (
                      <p className="text-xs text-amber-600 flex items-center gap-1"><AlertTriangle className="w-3 h-3" />{10 - rechargeForm.mobileNumber.length} more digit{10 - rechargeForm.mobileNumber.length > 1 ? "s" : ""} required</p>
                    )}
                    {rechargeForm.mobileNumber.length === 10 && !validateMobileNumber(rechargeForm.mobileNumber) && (
                      <p className="text-xs text-red-600 flex items-center gap-1"><AlertCircle className="w-3 h-3" />Invalid mobile number (must start with 6, 7, 8, or 9)</p>
                    )}
                    {rechargeForm.mobileNumber.length === 10 && validateMobileNumber(rechargeForm.mobileNumber) && (
                      <p className="text-xs text-green-600 flex items-center gap-1"><CheckCircle2 className="w-3 h-3" />Valid mobile number</p>
                    )}
                  </div>

                  {/* Operator & Circle */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Operator */}
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">Operator <span className="text-red-500">*</span></Label>
                      <Select value={rechargeForm.operatorCode} onValueChange={handleOperatorChange} disabled={isLoading || isLoadingOperators}>
                        <SelectTrigger className="h-12"><SelectValue placeholder={isLoadingOperators ? "Loading operators..." : "Select mobile operator"} /></SelectTrigger>
                        <SelectContent>
                          <div className="sticky top-0 bg-background z-10 p-2 border-b">
                            <div className="relative">
                              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                              <Input type="text" placeholder="Search operators..." value={operatorSearchQuery}
                                onChange={(e) => { e.stopPropagation(); setOperatorSearchQuery(e.target.value); }}
                                onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()} className="h-9 pl-9 pr-9" />
                              {operatorSearchQuery && (
                                <button type="button" onClick={(e) => { e.stopPropagation(); setOperatorSearchQuery(""); }} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"><X className="w-3 h-3" /></button>
                              )}
                            </div>
                          </div>
                          <div className="max-h-[300px] overflow-y-auto">
                            {isLoadingOperators ? (
                              <div className="py-8 flex flex-col items-center justify-center text-muted-foreground"><Loader2 className="w-6 h-6 animate-spin mb-2" /><p className="text-sm">Loading operators...</p></div>
                            ) : filteredOperators.length > 0 ? (
                              filteredOperators.map((op) => <SelectItem key={op.operator_code} value={op.operator_code.toString()}>{op.operator_name}</SelectItem>)
                            ) : operatorSearchQuery ? (
                              <div className="py-6 text-center text-sm text-muted-foreground"><Search className="w-8 h-8 mx-auto mb-2 opacity-50" />No operators found for "{operatorSearchQuery}"</div>
                            ) : (
                              <div className="py-6 text-center text-sm text-muted-foreground"><WifiOff className="w-8 h-8 mx-auto mb-2 opacity-50" />No operators available</div>
                            )}
                          </div>
                          {operatorSearchQuery && filteredOperators.length > 0 && (
                            <div className="sticky bottom-0 bg-background border-t p-2 text-xs text-center text-muted-foreground">Showing {filteredOperators.length} of {operators.length} operators</div>
                          )}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Circle */}
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">Circle <span className="text-red-500">*</span></Label>
                      <Select value={rechargeForm.circleCode} onValueChange={handleCircleChange} disabled={isLoading || isLoadingCircles}>
                        <SelectTrigger className="h-12"><SelectValue placeholder={isLoadingCircles ? "Loading circles..." : "Select your circle/region"} /></SelectTrigger>
                        <SelectContent>
                          <div className="sticky top-0 bg-background z-10 p-2 border-b">
                            <div className="relative">
                              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                              <Input type="text" placeholder="Search circles..." value={circleSearchQuery}
                                onChange={(e) => { e.stopPropagation(); setCircleSearchQuery(e.target.value); }}
                                onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()} className="h-9 pl-9 pr-9" />
                              {circleSearchQuery && (
                                <button type="button" onClick={(e) => { e.stopPropagation(); setCircleSearchQuery(""); }} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"><X className="w-3 h-3" /></button>
                              )}
                            </div>
                          </div>
                          <div className="max-h-[300px] overflow-y-auto">
                            {isLoadingCircles ? (
                              <div className="py-8 flex flex-col items-center justify-center text-muted-foreground"><Loader2 className="w-6 h-6 animate-spin mb-2" /><p className="text-sm">Loading circles...</p></div>
                            ) : filteredCircles.length > 0 ? (
                              filteredCircles.map((c) => <SelectItem key={c.circle_code} value={c.circle_code.toString()}>{c.circle_name}</SelectItem>)
                            ) : circleSearchQuery ? (
                              <div className="py-6 text-center text-sm text-muted-foreground"><Search className="w-8 h-8 mx-auto mb-2 opacity-50" />No circles found for "{circleSearchQuery}"</div>
                            ) : (
                              <div className="py-6 text-center text-sm text-muted-foreground"><WifiOff className="w-8 h-8 mx-auto mb-2 opacity-50" />No circles available</div>
                            )}
                          </div>
                          {circleSearchQuery && filteredCircles.length > 0 && (
                            <div className="sticky bottom-0 bg-background border-t p-2 text-xs text-center text-muted-foreground">Showing {filteredCircles.length} of {circles.length} circles</div>
                          )}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Amount */}
                  <div className="space-y-2">
                    <Label htmlFor="amount" className="text-sm font-medium">Recharge Amount <span className="text-red-500">*</span></Label>
                    <div className="flex gap-2">
                      <div className="flex-1 relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-medium">₹</span>
                        <Input id="amount" type="number" placeholder="Enter recharge amount" value={rechargeForm.amount}
                          onChange={(e) => setRechargeForm({ ...rechargeForm, amount: e.target.value })}
                          min="10" max="10000" step="1" required disabled={isLoading} className="h-12 text-base pl-8" />
                      </div>
                      <Button type="button" variant="outline" onClick={fetchPlans}
                        disabled={isLoadingPlans || !rechargeForm.operatorCode || !rechargeForm.circleCode}
                        className="h-12 px-6">
                        {isLoadingPlans ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Zap className="w-4 h-4 mr-2" />Browse Plans</>}
                      </Button>
                    </div>
                    {parseFloat(rechargeForm.amount) > 0 && parseFloat(rechargeForm.amount) < 10 && (
                      <p className="text-xs text-amber-600 flex items-center gap-1"><AlertTriangle className="w-3 h-3" />Minimum recharge amount is ₹10</p>
                    )}
                    {parseFloat(rechargeForm.amount) > 10000 && (
                      <p className="text-xs text-red-600 flex items-center gap-1"><AlertCircle className="w-3 h-3" />Maximum recharge amount is ₹10,000</p>
                    )}
                    {parseFloat(rechargeForm.amount) >= 10 && parseFloat(rechargeForm.amount) <= 10000 && (
                      <p className="text-xs text-muted-foreground">You're recharging ₹{parseFloat(rechargeForm.amount).toLocaleString("en-IN")}</p>
                    )}
                  </div>

                  {/* Info */}
                  <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 space-y-2">
                    <p className="text-sm font-semibold text-blue-900 dark:text-blue-100 flex items-center gap-2">
                      <AlertCircle className="w-4 h-4" />Important Information
                    </p>
                    <ul className="text-sm text-blue-800 dark:text-blue-200 space-y-1.5 list-disc list-inside ml-1">
                      <li>Ensure you have sufficient balance in your wallet</li>
                      <li>Recharge will be processed instantly upon confirmation</li>
                      <li>Double-check the mobile number before submitting</li>
                      <li>Completed transactions cannot be reversed or cancelled</li>
                      <li>A receipt will automatically open in a new tab after successful recharge</li>
                    </ul>
                  </div>

                  {/* Submit */}
                  <Button type="submit" size="lg"
                    disabled={isLoading || !validateMobileNumber(rechargeForm.mobileNumber) || !rechargeForm.operatorCode || !rechargeForm.circleCode || parseFloat(rechargeForm.amount) < 10 || parseFloat(rechargeForm.amount) > 10000}
                    className="w-full paybazaar-gradient text-white hover:opacity-90 transition-opacity h-12 text-base font-medium disabled:opacity-50">
                    {isLoading
                      ? <span className="flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" />Processing Your Recharge...</span>
                      : <><Smartphone className="w-4 h-4 mr-2" />Recharge ₹{rechargeForm.amount || "0"} Now</>}
                  </Button>
                </form>
              </CardContent>
            </Card>

            {/* History */}
            <Card className="shadow-lg border-border/50">
              <CardHeader className="paybazaar-gradient text-white rounded-t-xl space-y-1 pb-6">
                <CardTitle className="flex items-center justify-between">
                  <span className="flex items-center gap-2 text-xl"><RefreshCw className="w-5 h-5" />Recent Recharge History</span>
                  <Button variant="secondary" size="sm" onClick={fetchRechargeHistory} disabled={isLoadingHistory}>
                    {isLoadingHistory ? <Loader2 className="w-4 h-4 animate-spin" /> : <><RefreshCw className="w-4 h-4 mr-1" />Refresh</>}
                  </Button>
                </CardTitle>
                <p className="text-sm text-white/90">View your last 10 recharge transactions</p>
              </CardHeader>
              <CardContent className="pt-6">
                {isLoadingHistory ? (
                  <div className="flex flex-col items-center justify-center py-12">
                    <Loader2 className="w-8 h-8 animate-spin text-primary mb-3" />
                    <p className="text-sm text-muted-foreground">Loading your recharge history...</p>
                  </div>
                ) : rechargeHistory.length === 0 ? (
                  <div className="text-center py-12">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-muted mb-4">
                      <Smartphone className="w-8 h-8 text-muted-foreground" />
                    </div>
                    <p className="text-lg font-semibold mb-2">No Recharge History</p>
                    <p className="text-sm text-muted-foreground">Your completed recharges will appear here</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {rechargeHistory.slice(0, 10).map((h) => (
                      <div key={h.mobile_recharge_transaction_id} className="border rounded-lg p-4 hover:bg-muted/50 transition-colors">
                        <div className="flex items-start justify-between">
                          <div className="space-y-1 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="font-semibold text-base font-mono">{h.mobile_number}</p>
                              {getStatusBadge(h.status)}
                            </div>
                            <p className="text-sm text-muted-foreground">{h.operator_name} • {h.circle_name}</p>
                            <p className="text-xs text-muted-foreground">
                              {new Date(h.created_at).toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="font-bold text-lg text-primary">₹{h.amount.toLocaleString("en-IN")}</p>
                            {h.commision > 0 && (
                              <p className="text-xs text-green-600 flex items-center gap-1 justify-end">
                                <CheckCircle2 className="w-3 h-3" />+₹{h.commision.toFixed(2)} earned
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

          </div>
        </div>
      </div>

      {/* Plans Dialog */}
      <Dialog open={showPlansDialog} onOpenChange={setShowPlansDialog}>
        <DialogContent className="max-w-5xl max-h-[85vh] overflow-hidden flex flex-col p-0 bg-background">
          <DialogHeader className="px-6 pt-6 pb-4 border-b bg-background z-10">
            <DialogTitle className="flex items-center gap-2 text-xl">
              <Zap className="w-5 h-5 text-primary" />Available Recharge Plans
            </DialogTitle>
            <DialogDescription className="text-sm">
              {rechargeForm.operatorName && rechargeForm.circleName
                ? `Plans for ${rechargeForm.operatorName} in ${rechargeForm.circleName} • Select a plan to auto-fill amount`
                : "Select a plan to auto-fill the recharge amount"}
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-hidden flex flex-col bg-background">
            <Tabs value={selectedPlanCategory} onValueChange={setSelectedPlanCategory} className="flex-1 flex flex-col overflow-hidden">
              <div className="px-6 pt-4 pb-2 border-b bg-background z-10 relative">
                <div className="overflow-x-auto">
                  <TabsList className="inline-flex h-auto p-1 bg-muted rounded-lg min-w-full w-max">
                    <TabsTrigger value="all" className="px-4 py-2.5 text-sm font-medium whitespace-nowrap data-[state=active]:bg-background data-[state=active]:shadow-sm">
                      <span>All Plans</span><Badge variant="outline" className="ml-2 text-xs bg-background">{plans.length}</Badge>
                    </TabsTrigger>
                    {getPlanCategories().map((cat) => (
                      <TabsTrigger key={cat} value={cat} className="px-4 py-2.5 text-sm font-medium whitespace-nowrap data-[state=active]:bg-background data-[state=active]:shadow-sm">
                        <span>{cat}</span><Badge variant="outline" className="ml-2 text-xs bg-background">{getPlanCountByCategory(cat)}</Badge>
                      </TabsTrigger>
                    ))}
                  </TabsList>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto px-6 py-4 bg-background">
                <TabsContent value={selectedPlanCategory} className="m-0 mt-0">
                  {getFilteredPlans().length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground">
                      <Zap className="w-12 h-12 mx-auto mb-3 opacity-50" />
                      <p className="font-semibold mb-1">No Plans Available</p>
                      <p className="text-sm">No plans found in this category</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pb-4">
                      {getFilteredPlans().map((plan, index) => (
                        <div key={index} className="border border-border rounded-lg p-5 hover:border-primary hover:shadow-lg cursor-pointer transition-all duration-200 bg-card" onClick={() => handlePlanSelect(plan)}>
                          <div className="flex items-start justify-between gap-3 mb-3">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-2">
                                <p className="font-bold text-2xl text-primary">₹{plan.rs}</p>
                                {plan.category && <Badge className="text-xs shrink-0 bg-primary/10 text-primary hover:bg-primary/20">{plan.category}</Badge>}
                              </div>
                              {plan.planName && <p className="text-sm font-semibold text-foreground mb-1">{plan.planName}</p>}
                              {plan.validity && plan.validity !== "NA" && plan.validity !== "NA days" && (
                                <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                  Validity: {plan.validity}
                                </p>
                              )}
                            </div>
                          </div>
                          <p className="text-sm text-muted-foreground line-clamp-3 leading-relaxed mb-4">{plan.desc}</p>
                          <div className="pt-3 border-t border-border/50">
                            <Button variant="outline" size="sm" className="w-full text-primary border-primary/50 hover:bg-primary hover:text-primary-foreground transition-colors"
                              onClick={(e) => { e.stopPropagation(); handlePlanSelect(plan); }}>
                              <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />Select This Plan
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </TabsContent>
              </div>
            </Tabs>
          </div>
        </DialogContent>
      </Dialog>

      {/* Success Dialog with Receipt Button */}
      <Dialog open={showSuccessDialog} onOpenChange={setShowSuccessDialog}>
        <DialogContent className="max-w-md p-0 overflow-hidden bg-white rounded-2xl shadow-2xl border-none">
          <div className="paybazaar-gradient p-8 text-center text-white relative">
            <div className="absolute top-4 right-4 cursor-pointer" onClick={() => setShowSuccessDialog(false)}>
              <X className="w-5 h-5 text-white/50" />
            </div>
            <div className="w-20 h-20 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4 animate-bounce">
              <CheckCircle2 className="w-12 h-12 text-white" />
            </div>
            <h2 className="text-2xl font-bold mb-1">Recharge Successful!</h2>
            <p className="text-white/80 text-sm">₹{pendingReceipt?.amount} added to {pendingReceipt?.mobileNumber}</p>
          </div>
          
          <div className="p-6 space-y-4">
            <div className="bg-gray-50 rounded-xl p-4 space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Operator</span>
                <span className="font-semibold">{pendingReceipt?.operatorName}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Transaction ID</span>
                <span className="font-mono font-medium">{pendingReceipt?.transactionId || pendingReceipt?.partnerRequestId}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Status</span>
                <Badge className="bg-green-500 hover:bg-green-600 text-white border-none">SUCCESS</Badge>
              </div>
            </div>

            <div className="flex flex-col gap-3 pt-2">
              <Button 
                onClick={() => pendingReceipt && openReceiptInNewTab(pendingReceipt, retailerProfile)}
                className="w-full bg-black hover:bg-gray-900 text-white h-12 rounded-xl font-bold text-base"
              >
                <Receipt className="w-5 h-5 mr-2" />
                View & Print Receipt
              </Button>
              <Button 
                variant="outline" 
                onClick={() => setShowSuccessDialog(false)}
                className="w-full h-12 rounded-xl border-gray-200 text-gray-600 font-semibold"
              >
                Done
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default MobileRecharge;