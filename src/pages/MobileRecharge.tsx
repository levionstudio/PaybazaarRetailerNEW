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
const openReceiptInNewTab = (data: ReceiptData) => {
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

  type SC = { bg: string; border: string; text: string };
  const statusColors: Record<string, SC> = {
    SUCCESS: { bg: "#f0fdf4", border: "#86efac", text: "#16a34a" },
    PENDING: { bg: "#fefce8", border: "#fde047", text: "#ca8a04" },
    FAILED:  { bg: "#fef2f2", border: "#fca5a5", text: "#dc2626" },
  };
  const sc: SC = statusColors[statusUp] ?? { bg: "#f9fafb", border: "#d1d5db", text: "#4b5563" };

  // Two-column detail row
  const row = (label: string, value: string) => `
    <div class="row">
      <span class="r-label">${label}</span>
      <span class="r-value">${value}</span>
    </div>`;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1.0"/>
  <title>Prepaid Recharge Receipt</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      background: #f3f4f6;
      font-family: 'Segoe UI', Arial, sans-serif;
      padding: 28px 16px 48px;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
      color: #111827;
    }

    /* ── Action bar (hidden on print) ── */
    .action-bar {
      display: flex;
      gap: 10px;
      justify-content: center;
      margin-bottom: 20px;
    }
    .btn {
      padding: 8px 26px;
      border-radius: 7px;
      font-size: 0.88rem;
      font-weight: 600;
      cursor: pointer;
      border: none;
      letter-spacing: 0.01em;
    }
    .btn-print { background: #4f46e5; color: #fff; }
    .btn-print:hover { background: #4338ca; }
    .btn-close  { background: #e5e7eb; color: #374151; }
    .btn-close:hover { background: #d1d5db; }

    /* ── Receipt card — 148 mm wide (A5 / half-A4) ── */
    .receipt {
      width: 148mm;
      margin: 0 auto;
      background: #fff;
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      overflow: hidden;
      box-shadow: 0 2px 14px rgba(0,0,0,0.09);
    }

    /* ── Header ── */
    .r-header {
      text-align: center;
      padding: 22px 28px 16px;
      border-bottom: 1.5px solid #e5e7eb;
    }
    .r-header h1 {
      font-size: 1.28rem;
      font-weight: 800;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: #111827;
    }
    .r-header .company {
      font-size: 0.78rem;
      font-weight: 700;
      color: #374151;
      margin-top: 4px;
    }

    /* ── ID block ── */
    .id-block {
      text-align: center;
      padding: 14px 28px 6px;
    }
    .id-label {
      font-size: 0.68rem;
      color: #6b7280;
      text-transform: uppercase;
      letter-spacing: 0.07em;
      margin-bottom: 3px;
    }
    .id-value {
      font-family: 'Courier New', monospace;
      font-size: 0.9rem;
      font-weight: 700;
      color: #111827;
    }

    /* ── Status box ── */
    .status-box {
      margin: 10px 28px 16px;
      padding: 10px 0;
      border-radius: 8px;
      border: 2px solid ${sc.border};
      background: ${sc.bg};
      color: ${sc.text};
      text-align: center;
      font-size: 0.95rem;
      font-weight: 800;
      letter-spacing: 0.10em;
      text-transform: uppercase;
    }

    /* ── Section wrapper ── */
    .section {
      padding: 0 28px 16px;
    }
    .section-title {
      font-size: 0.78rem;
      font-weight: 700;
      color: #111827;
      padding-bottom: 7px;
      border-bottom: 1.5px solid #e5e7eb;
      margin-bottom: 2px;
    }

    /* ── Detail rows: label left, bold value right ── */
    .row {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      padding: 8px 0;
      border-bottom: 1px solid #f3f4f6;
      gap: 16px;
      font-size: 0.82rem;
    }
    .row:last-child { border-bottom: none; }
    .r-label { color: #6b7280; flex-shrink: 0; }
    .r-value  { font-weight: 700; color: #111827; text-align: right; word-break: break-word; }

    /* ── Amount section ── */
    .amount-section { padding: 0 28px 18px; }
    .amount-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 10px 14px;
      border: 1.5px solid #e5e7eb;
      border-radius: 7px;
      background: #f9fafb;
      margin-top: 7px;
    }
    .a-label { font-size: 0.85rem; font-weight: 600; color: #374151; }
    .a-value  { font-size: 1.5rem; font-weight: 800; color: #111827; }

    /* ── Footer ── */
    .r-footer {
      border-top: 1.5px solid #e5e7eb;
      padding: 12px 28px;
      text-align: center;
      background: #fafafa;
    }
    .r-footer p { font-size: 0.67rem; color: #9ca3af; line-height: 1.5; margin-bottom: 2px; }
    .r-footer a { color: #4f46e5; text-decoration: none; }

    /* ── Print styles ── */
    @media print {
      body { background: white; padding: 0; }
      .action-bar { display: none !important; }
      .receipt { width: 148mm; border: none; border-radius: 0; box-shadow: none; margin: 0 auto; }
      @page { size: 148mm auto; margin: 8mm; }
    }
  </style>
</head>
<body>

  <!-- Action Buttons -->
  <div class="action-bar">
    <button class="btn btn-print" onclick="window.print()">🖨️ &nbsp;Print Receipt</button>
    <button class="btn btn-close" onclick="window.close()">✕ &nbsp;Close</button>
  </div>

  <!-- Receipt -->
  <div class="receipt">

    <!-- Header -->
    <div class="r-header">
      <h1>Prepaid Recharge Receipt</h1>
      <div class="company">Paybazaar Technologies Pvt. Ltd.</div>
    </div>

    <!-- Partner Request ID -->
    <div class="id-block">
      <div class="id-label">Partner Request ID</div>
      <div class="id-value">${data.partnerRequestId}</div>
    </div>

    ${data.transactionId ? `
    <!-- Transaction ID -->
    <div class="id-block" style="padding-top:4px;">
      <div class="id-label">UTR Number</div>
      <div class="id-value">${data.transactionId}</div>
    </div>` : ""}

    <!-- Status -->
    <div class="status-box">${statusUp}</div>

    <!-- Recharge Details -->
    <div class="section">
      <div class="section-title">Recharge Details</div>
      ${row("Date &amp; Time",  formatDate(data.createdAt))}
      ${row("Mobile Number",    data.mobileNumber)}
      ${row("Operator",         data.operatorName)}
      ${row("Circle / Region",  data.circleName)}
      ${row("Recharge Type",    "Prepaid")}
    </div>

    <!-- Amount Details -->
    <div class="amount-section">
      <div class="section-title">Amount Details</div>
      <div class="amount-row">
        <span class="a-label">Amount Recharged</span>
        <span class="a-value">₹${fmtAmount(data.amount)}</span>
      </div>
    </div>

    <!-- Footer -->
    <div class="r-footer">
      <p>This is a computer-generated receipt and does not require a signature.</p>
      <p>
        For any technical queries, contact
        <a href="https://www.gvinfotech.org" target="_blank">www.gvinfotech.org</a>
        or
        <a href="https://www.paybazaar.in" target="_blank">www.paybazaar.in</a>
      </p>
    </div>

  </div><!-- /receipt -->
</body>
</html>`;

  const tab = window.open("", "_blank");
  if (tab) {
    tab.document.open();
    tab.document.write(html);
    tab.document.close();
  }
};

// ─────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────
const MobileRecharge = () => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [retailerId, setRetailerId] = useState("");
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

        // ── Auto open receipt ──
        openReceiptInNewTab({
          mobileNumber: rechargeForm.mobileNumber,
          operatorName: rechargeForm.operatorName,
          circleName: rechargeForm.circleName,
          amount,
          transactionId,
          partnerRequestId,
          status: rechargeStatus,
          createdAt: new Date().toISOString(),
        });

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
    </div>
  );
};

export default MobileRecharge;