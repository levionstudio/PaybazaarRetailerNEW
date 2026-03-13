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
  Zap,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Search,
  ArrowLeft,
  X,
  Loader2,
  WifiOff,
  AlertTriangle,
  FileText,
  Receipt,
  Smartphone,
} from "lucide-react";
import axios from "axios";
import { jwtDecode, JwtPayload } from "jwt-decode";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────
interface Operator {
  operator_code: number;
  operator_name: string;
}

interface BillDetails {
  billAmount: string;
  billDate: string;
  consumerId: string;
  consumerName: string;
  dueDate: string;
}

interface PaymentHistory {
  electricity_bill_transaction_id: number;
  operator_transaction_id: string | null;
  order_id: string | null;
  partner_request_id: string;
  retailer_id: string;
  retailer_name: string;
  retailer_business_name: string;
  customer_id: string;
  customer_email: string;
  operator_name: string;
  operator_id: number;
  amount: number;
  commision: number;
  before_balance: number;
  after_balance: number;
  transaction_status: string;
  created_at: string;
}

interface ElectricityReceiptData {
  customerId: string;
  consumerName: string;
  operatorName: string;
  customerEmail: string;
  amount: number;
  orderId: string;
  status: string;
  createdAt: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Write receipt HTML into an already-opened tab
// ─────────────────────────────────────────────────────────────────────────────
const writeReceiptToTab = (tab: Window, data: ElectricityReceiptData, retailerProfile: any) => {
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

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1.0"/>
  <title>Electricity Bill Receipt - ${data.customerId}</title>
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
      background: ${statusUp.includes('SUCCESS') ? '#00c853' : statusUp.includes('FAILED') ? '#ff1744' : '#ffab00'};
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
        <div class="value">Electricity Bill Payment</div>
      </div>
      <div class="detail-item">
        <div class="label">Customer Name</div>
        <div class="value">${data.consumerName || "N/A"}</div>
      </div>
      <div class="detail-item">
        <div class="label">Consumer Number</div>
        <div class="value">${data.customerId}</div>
      </div>
      <div class="detail-item">
        <div class="label">Operator</div>
        <div class="value">${data.operatorName}</div>
      </div>
      <div class="detail-item">
        <div class="label">Txn ID / UTR</div>
        <div class="value">${data.orderId}</div>
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

// ─────────────────────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────────────────────
const ElectricityBillPayment = () => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [retailerId, setRetailerId] = useState("");
  const [retailerProfile, setRetailerProfile] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingOperators, setIsLoadingOperators] = useState(true);
  const [isFetchingBill, setIsFetchingBill] = useState(false);
  const [operators, setOperators] = useState<Operator[]>([]);
  const [filteredOperators, setFilteredOperators] = useState<Operator[]>([]);
  const [operatorSearchQuery, setOperatorSearchQuery] = useState("");
  const [paymentHistory, setPaymentHistory] = useState<PaymentHistory[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [billAmount, setBillAmount] = useState<number | null>(null);
  const [billDetails, setBillDetails] = useState<BillDetails | null>(null);
  const [isBillDialogOpen, setIsBillDialogOpen] = useState(false);

  // ── Receipt / success state ──
  const [showSuccessAnimation, setShowSuccessAnimation] = useState(false);
  const [transactionId, setTransactionId] = useState<string | null>(null);
  const [pendingReceiptData, setPendingReceiptData] =
    useState<ElectricityReceiptData | null>(null);

  const [paymentForm, setPaymentForm] = useState({
    customerId: "",
    customerEmail: "",
    operatorCode: "",
    operatorName: "",
    amount: "",
  });

  // ── Decode JWT ──
  useEffect(() => {
    const token = localStorage.getItem("authToken");
    if (!token) {
      toast({
        title: "⚠️ Authentication Required",
        description: "Please log in to access electricity bill payment services",
        variant: "destructive",
      });
      navigate("/login");
      return;
    }
    try {
      const decoded = jwtDecode(token) as any;
      const userId =
        decoded.retailer_id || decoded.data?.user_id || decoded.user_id;
      if (!userId) {
        toast({
          title: "⚠️ Session Error",
          description: "Unable to verify your identity. Please log in again.",
          variant: "destructive",
        });
        navigate("/login");
        return;
      }
      setRetailerId(userId);

      // Fetch retailer profile
      const fetchProfile = async () => {
        try {
          const profileRes = await axios.get(
            `${API_BASE_URL}/retailer/get/retailer/${userId}`,
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
      toast({
        title: "⚠️ Session Expired",
        description: "Your session has expired. Please log in again to continue.",
        variant: "destructive",
      });
      navigate("/login");
    }
  }, [toast, navigate]);

  // ── Fetch operators ──
  useEffect(() => {
    const fetchOperators = async () => {
      setIsLoadingOperators(true);
      try {
        const response = await axios.get(
          `${API_BASE_URL}/bbps/get/electricity/operators`,
          getAuthHeaders()
        );
        const operatorsData = response.data?.data?.operators || [];
        if (!Array.isArray(operatorsData)) throw new Error("Invalid response format");
        if (operatorsData.length === 0) {
          toast({
            title: "⚠️ No Operators Available",
            description: "No electricity operators are currently available. Please try again later.",
            variant: "destructive",
          });
        }
        setOperators(operatorsData);
        setFilteredOperators(operatorsData);
      } catch (error: any) {
        setOperators([]);
        setFilteredOperators([]);
        let errorMessage = "Unable to load electricity operators. Please try again.";
        if (!navigator.onLine) errorMessage = "No internet connection. Please check your network and try again.";
        else if (error.code === "ECONNABORTED" || error.message?.includes("timeout")) errorMessage = "Request timed out. Please check your connection and try again.";
        else if (error.response?.status === 401) errorMessage = "Your session has expired. Please log in again.";
        else if (error.response?.status === 500) errorMessage = "Server error. Our team has been notified. Please try again later.";
        toast({ title: "❌ Failed to Load Operators", description: errorMessage, variant: "destructive" });
      } finally {
        setIsLoadingOperators(false);
      }
    };
    fetchOperators();
  }, [toast]);

  // ── Filter operators ──
  useEffect(() => {
    if (operatorSearchQuery.trim() === "") {
      setFilteredOperators(operators);
    } else {
      setFilteredOperators(
        operators.filter((op) =>
          op.operator_name.toLowerCase().includes(operatorSearchQuery.toLowerCase())
        )
      );
    }
  }, [operatorSearchQuery, operators]);

  // No auto-open


  // ── Fetch payment history ──
  const fetchPaymentHistory = async () => {
    if (!retailerId) return;
    setIsLoadingHistory(true);
    try {
      const response = await axios.get(
        `${API_BASE_URL}/bbps/get/electricity/transactions/${retailerId}`,
        getAuthHeaders()
      );
      const historyData = response.data?.data?.transactions || [];
      if (!Array.isArray(historyData)) throw new Error("Invalid response format");
      setPaymentHistory(historyData);
      if (historyData.length > 0) {
        toast({
          title: "✓ History Loaded",
          description: `Found ${historyData.length} recent payment${historyData.length > 1 ? "s" : ""}`,
        });
      }
    } catch (error: any) {
      setPaymentHistory([]);
      if (error.response?.status !== 404) {
        let errorMessage = "Unable to load your payment history.";
        if (!navigator.onLine) errorMessage = "No internet connection. Please check your network.";
        else if (error.response?.status === 401) errorMessage = "Your session has expired. Please log in again.";
        else if (error.response?.status === 500) errorMessage = "Server error. Please try again later.";
        toast({ title: "⚠️ History Load Failed", description: errorMessage, variant: "destructive" });
      }
    } finally {
      setIsLoadingHistory(false);
    }
  };

  useEffect(() => {
    if (retailerId) fetchPaymentHistory();
  }, [retailerId]);

  // ── Operator change ──
  const handleOperatorChange = (value: string) => {
    const selectedOperator = operators.find(
      (op) => op.operator_code.toString() === value
    );
    if (selectedOperator) {
      setPaymentForm({ ...paymentForm, operatorCode: value, operatorName: selectedOperator.operator_name });
      setBillAmount(null);
      setBillDetails(null);
      toast({ title: "✓ Operator Selected", description: `${selectedOperator.operator_name} selected` });
    }
  };

  const validateCustomerId = (id: string) => id.length >= 6 && id.length <= 20;
  const validateEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  // ── Fetch bill ──
  const handleFetchBill = async () => {
    if (!paymentForm.customerId) {
      toast({ title: "⚠️ Customer ID Required", description: "Please enter your customer ID or consumer number", variant: "destructive" });
      return;
    }
    if (!validateCustomerId(paymentForm.customerId)) {
      toast({ title: "⚠️ Invalid Customer ID", description: "Customer ID must be between 6 and 20 characters", variant: "destructive" });
      return;
    }
    if (!paymentForm.operatorCode) {
      toast({ title: "⚠️ Operator Not Selected", description: "Please select your electricity operator before fetching bill", variant: "destructive" });
      return;
    }

    setIsFetchingBill(true);
    setBillAmount(null);
    setBillDetails(null);

    try {
      const response = await axios.post(
        `${API_BASE_URL}/bbps/get/electricity/balance`,
        { customer_id: paymentForm.customerId, operator_code: parseInt(paymentForm.operatorCode) },
        getAuthHeaders()
      );
      const apiResponse = response.data?.data?.response;
      if (apiResponse?.status === 1 && apiResponse?.billAmount) {
        const billData = apiResponse.billAmount;
        const amount = parseFloat(billData.billAmount);
        setBillAmount(amount);
        setBillDetails({
          billAmount: billData.billAmount,
          billDate: billData.billDate || "",
          consumerId: billData.consumerId || paymentForm.customerId,
          consumerName: billData.consumerName || "",
          dueDate: billData.dueDate || "",
        });
        setPaymentForm({ ...paymentForm, amount: amount.toString() });
        setIsBillDialogOpen(true);
        toast({
          title: "✓ Bill Fetched Successfully",
          description: `Bill for ${billData.consumerName || paymentForm.customerId}: ₹${amount.toLocaleString("en-IN")}${billData.dueDate ? ` • Due: ${new Date(billData.dueDate).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}` : ""}`,
        });
      } else {
        toast({ title: "⚠️ Bill Not Found", description: `${apiResponse?.msg || "Unable to fetch bill details"}. Please verify your customer ID and operator.`, variant: "destructive" });
      }
    } catch (error: any) {
      let errorTitle = "❌ Failed to Fetch Bill";
      let errorMessage = "Unable to retrieve bill details. Please try again.";
      if (!navigator.onLine) { errorTitle = "📡 No Internet Connection"; errorMessage = "Please check your internet connection and try again."; }
      else if (error.code === "ECONNABORTED" || error.message?.includes("timeout")) { errorTitle = "⏱️ Request Timeout"; errorMessage = "The request took too long. Please check your connection and try again."; }
      else if (error.response?.status === 400) { errorTitle = "⚠️ Invalid Request"; errorMessage = "The customer ID or operator combination is invalid. Please verify and try again."; }
      else if (error.response?.status === 401) { errorTitle = "🔒 Session Expired"; errorMessage = "Your session has expired. Please log in again."; }
      else if (error.response?.status === 404) { errorTitle = "📄 No Bill Found"; errorMessage = "No pending electricity bill found for this customer ID. Please verify your details."; }
      else if (error.response?.status === 500) { errorTitle = "⚠️ Server Error"; errorMessage = "Our server encountered an error. Our team has been notified. Please try again later."; }
      else if (error.response?.data?.message) { errorMessage = error.response.data.message; }
      else if (error.response?.data?.data?.response?.msg) { errorMessage = error.response.data.data.response.msg; }
      toast({ title: errorTitle, description: errorMessage, variant: "destructive" });
    } finally {
      setIsFetchingBill(false);
    }
  };

  // ── Payment submit ──
  const handlePaymentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!retailerId) {
      toast({ title: "⚠️ Session Error", description: "Your session has expired. Please log in again to continue.", variant: "destructive" });
      navigate("/login");
      return;
    }
    if (!paymentForm.customerId || !validateCustomerId(paymentForm.customerId)) {
      toast({ title: "⚠️ Invalid Customer ID", description: "Customer ID must be between 6 and 20 characters", variant: "destructive" });
      return;
    }
    if (!paymentForm.operatorCode) {
      toast({ title: "⚠️ Operator Not Selected", description: "Please select your electricity operator", variant: "destructive" });
      return;
    }
    if (!paymentForm.customerEmail || !validateEmail(paymentForm.customerEmail)) {
      toast({ title: "⚠️ Invalid Email", description: "Please enter a valid email address (e.g., name@example.com)", variant: "destructive" });
      return;
    }
    const amount = parseFloat(paymentForm.amount);
    if (!paymentForm.amount || isNaN(amount) || amount <= 0) {
      toast({ title: "⚠️ Invalid Amount", description: "Please enter a valid payment amount greater than ₹0", variant: "destructive" });
      return;
    }
    if (amount > 100000) {
      toast({ title: "⚠️ Amount Too High", description: "Maximum payment amount is ₹1,00,000 per transaction", variant: "destructive" });
      return;
    }

    setIsLoading(true);

    try {
      const response = await axios.post(
        `${API_BASE_URL}/bbps/create/electricity`,
        {
          retailer_id: retailerId,
          customer_id: paymentForm.customerId,
          customer_email: paymentForm.customerEmail,
          operator_name: paymentForm.operatorName,
          operator_code: parseInt(paymentForm.operatorCode),
          amount,
        },
        getAuthHeaders()
      );

      if (response.status === 200 || response.status === 201) {
        const orderId =
          response.data?.data?.order_id ||
          response.data?.data?.orderId ||
          response.data?.data?.transaction_id ||
          Date.now().toString();

        // Capture receipt data before clearing the form
        const receiptData: ElectricityReceiptData = {
          customerId: paymentForm.customerId,
          consumerName: billDetails?.consumerName || "",
          operatorName: paymentForm.operatorName,
          customerEmail: paymentForm.customerEmail,
          amount,
          orderId,
          status: "SUCCESS",
          createdAt: new Date().toISOString(),
        };

        // Show success animation; receipt tab opens after animation fades (3.5 s)
        setTransactionId(orderId);
        setShowSuccessAnimation(true);
        setPendingReceiptData(receiptData);

        toast({
          title: "🎉 Payment Successful!",
          description: `₹${amount.toLocaleString("en-IN")} paid successfully for ${paymentForm.customerId} (${paymentForm.operatorName})`,
        });

        // Reset form
        setPaymentForm({ customerId: "", customerEmail: "", operatorCode: "", operatorName: "", amount: "" });
        setBillAmount(null);
        setBillDetails(null);

        fetchPaymentHistory();
      }
    } catch (error: any) {
      let errorTitle = "❌ Payment Failed";
      let errorMessage = "Unable to process your payment. Please try again.";
      if (error.response?.data?.message) errorMessage = error.response.data.message;
      else if (error.response?.status === 400) { errorTitle = "⚠️ Invalid Request"; errorMessage = "The payment information provided is invalid. Please check and try again."; }
      else if (error.response?.status === 401) { errorTitle = "🔒 Session Expired"; errorMessage = "Your session has expired. Please log in again to continue."; }
      else if (error.response?.status === 402) { errorTitle = "💰 Insufficient Balance"; errorMessage = "You don't have enough balance to complete this payment. Please add funds to your wallet."; }
      else if (error.response?.status === 403) { errorTitle = "🚫 Access Denied"; errorMessage = "You don't have permission to perform this payment."; }
      else if (error.response?.status === 404) { errorTitle = "⚠️ Service Not Found"; errorMessage = "The payment service is temporarily unavailable. Please try again later."; }
      else if (error.response?.status === 500) { errorTitle = "⚠️ Server Error"; errorMessage = "Our server encountered an error. Our team has been notified. Please try again later."; }
      else if (error.response?.status === 503) { errorTitle = "⚠️ Service Unavailable"; errorMessage = "The payment service is temporarily down for maintenance. Please try again in a few minutes."; }
      else if (!navigator.onLine) { errorTitle = "📡 No Internet Connection"; errorMessage = "Please check your internet connection and try again."; }
      else if (error.code === "ECONNABORTED" || error.message?.includes("timeout")) { errorTitle = "⏱️ Request Timeout"; errorMessage = "The request took too long. Please check your connection and try again."; }
      toast({ title: errorTitle, description: errorMessage, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const s = status.toLowerCase();
    if (s === "success" || s === "completed")
      return <Badge className="bg-green-500/10 text-green-600 hover:bg-green-500/20"><CheckCircle2 className="w-3 h-3 mr-1" />Success</Badge>;
    if (s === "pending" || s === "processing")
      return <Badge className="bg-amber-500/10 text-amber-600 hover:bg-amber-500/20"><RefreshCw className="w-3 h-3 mr-1" />Pending</Badge>;
    if (s === "failed" || s === "failure")
      return <Badge className="bg-red-500/10 text-red-600 hover:bg-red-500/20"><AlertCircle className="w-3 h-3 mr-1" />Failed</Badge>;
    return <Badge variant="outline">{status}</Badge>;
  };

  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <div className="flex min-h-screen w-full bg-background">
      <AppSidebar />

      <div className="flex-1 flex flex-col min-w-0">
        <Header />

        <div className="flex-1 p-6 overflow-y-auto">
          <div className="max-w-6xl mx-auto space-y-8">
            {/* Back */}
            <Button variant="ghost" onClick={() => navigate("/bbps")} className="gap-2 hover:bg-muted/50">
              <ArrowLeft className="w-4 h-4" />
              Back to BBPS
            </Button>

            {/* Payment Card */}
            <Card className="shadow-lg border-border/50">
              <CardHeader className="paybazaar-gradient text-white rounded-t-xl space-y-1 pb-6">
                <CardTitle className="flex items-center gap-2 text-xl">
                  <Zap className="w-5 h-5" />
                  Electricity Bill Payment
                </CardTitle>
                <p className="text-sm text-white/90">Pay your electricity bills instantly for all major providers</p>
              </CardHeader>

              <CardContent className="pt-6 pb-8 px-6">
                <form onSubmit={handlePaymentSubmit} className="space-y-6">
                  {/* Customer ID */}
                  <div className="space-y-2">
                    <Label htmlFor="customerId" className="text-sm font-medium text-foreground">
                      Customer ID / Consumer Number <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="customerId"
                      type="text"
                      placeholder="Enter your customer ID or consumer number"
                      value={paymentForm.customerId}
                      onChange={(e) => {
                        const value = e.target.value.toUpperCase();
                        if (value.length <= 20) {
                          setPaymentForm({ ...paymentForm, customerId: value });
                          setBillAmount(null);
                          setBillDetails(null);
                        }
                      }}
                      maxLength={20}
                      required
                      disabled={isLoading}
                      className="h-12 text-base"
                    />
                    {paymentForm.customerId.length > 0 && paymentForm.customerId.length < 6 && (
                      <p className="text-xs text-amber-600 flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3" />
                        {6 - paymentForm.customerId.length} more character{6 - paymentForm.customerId.length > 1 ? "s" : ""} required (minimum 6)
                      </p>
                    )}
                    {paymentForm.customerId.length >= 6 && (
                      <p className="text-xs text-green-600 flex items-center gap-1"><CheckCircle2 className="w-3 h-3" />Valid customer ID</p>
                    )}
                  </div>

                  {/* Operator */}
                  <div className="space-y-2">
                    <Label htmlFor="operator" className="text-sm font-medium text-foreground">
                      Electricity Operator <span className="text-red-500">*</span>
                    </Label>
                    <Select value={paymentForm.operatorCode} onValueChange={handleOperatorChange} disabled={isLoading || isLoadingOperators} required>
                      <SelectTrigger className="h-12">
                        <SelectValue placeholder={isLoadingOperators ? "Loading operators..." : "Select your electricity provider"} />
                      </SelectTrigger>
                      <SelectContent>
                        <div className="sticky top-0 bg-background z-10 p-2 border-b">
                          <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                            <Input
                              type="text"
                              placeholder="Search operators..."
                              value={operatorSearchQuery}
                              onChange={(e) => { e.stopPropagation(); setOperatorSearchQuery(e.target.value); }}
                              onClick={(e) => e.stopPropagation()}
                              onKeyDown={(e) => e.stopPropagation()}
                              className="h-9 pl-9 pr-9"
                            />
                            {operatorSearchQuery && (
                              <button type="button" onClick={(e) => { e.stopPropagation(); setOperatorSearchQuery(""); }} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                                <X className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                        </div>
                        <div className="max-h-[300px] overflow-y-auto">
                          {isLoadingOperators ? (
                            <div className="py-8 flex flex-col items-center justify-center text-muted-foreground">
                              <Loader2 className="w-6 h-6 animate-spin mb-2" />
                              <p className="text-sm">Loading operators...</p>
                            </div>
                          ) : Array.isArray(filteredOperators) && filteredOperators.length > 0 ? (
                            filteredOperators.map((op) => (
                              <SelectItem key={op.operator_code} value={op.operator_code.toString()}>{op.operator_name}</SelectItem>
                            ))
                          ) : operatorSearchQuery ? (
                            <div className="py-6 text-center text-sm text-muted-foreground">
                              <Search className="w-8 h-8 mx-auto mb-2 opacity-50" />
                              No operators found for "{operatorSearchQuery}"
                            </div>
                          ) : (
                            <div className="py-6 text-center text-sm text-muted-foreground">
                              <WifiOff className="w-8 h-8 mx-auto mb-2 opacity-50" />
                              No operators available
                            </div>
                          )}
                        </div>
                        {operatorSearchQuery && filteredOperators.length > 0 && (
                          <div className="sticky bottom-0 bg-background border-t p-2 text-xs text-center text-muted-foreground">
                            Showing {filteredOperators.length} of {operators.length} operators
                          </div>
                        )}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Fetch Bill Button */}
                  {paymentForm.customerId && paymentForm.operatorCode && (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleFetchBill}
                      disabled={isFetchingBill || isLoading || !validateCustomerId(paymentForm.customerId)}
                      className="w-full h-12"
                    >
                      {isFetchingBill ? (
                        <span className="flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" />Fetching Bill Details...</span>
                      ) : (
                        <><FileText className="w-4 h-4 mr-2" />Fetch Bill Amount</>
                      )}
                    </Button>
                  )}

                  {/* Bill Amount Display */}
                  {billAmount !== null && (
                    <div className="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-950/20 dark:to-emerald-950/20 border-2 border-green-200 dark:border-green-800 rounded-lg p-5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="p-2 rounded-full bg-green-500/10">
                            <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400" />
                          </div>
                          <span className="text-sm font-semibold text-green-800 dark:text-green-200">Current Bill Amount</span>
                        </div>
                        <span className="text-3xl font-bold text-green-600 dark:text-green-400">₹{billAmount.toLocaleString("en-IN")}</span>
                      </div>
                      {billDetails?.dueDate && (
                        <p className="text-xs text-green-700 dark:text-green-300 mt-2 flex items-center gap-1">
                          <AlertCircle className="w-3 h-3" />
                          Due Date: {new Date(billDetails.dueDate).toLocaleDateString("en-IN", { day: "2-digit", month: "long", year: "numeric" })}
                        </p>
                      )}
                    </div>
                  )}

                  {/* Email */}
                  <div className="space-y-2">
                    <Label htmlFor="customerEmail" className="text-sm font-medium text-foreground">
                      Customer Email <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="customerEmail"
                      type="email"
                      placeholder="Enter your email for payment confirmation"
                      value={paymentForm.customerEmail}
                      onChange={(e) => setPaymentForm({ ...paymentForm, customerEmail: e.target.value })}
                      required
                      disabled={isLoading}
                      className="h-12 text-base"
                    />
                    {paymentForm.customerEmail.length > 0 && !validateEmail(paymentForm.customerEmail) && (
                      <p className="text-xs text-red-600 flex items-center gap-1"><AlertCircle className="w-3 h-3" />Please enter a valid email address (e.g., name@example.com)</p>
                    )}
                    {paymentForm.customerEmail.length > 0 && validateEmail(paymentForm.customerEmail) && (
                      <p className="text-xs text-green-600 flex items-center gap-1"><CheckCircle2 className="w-3 h-3" />Valid email address</p>
                    )}
                  </div>

                  {/* Amount */}
                  <div className="space-y-2">
                    <Label htmlFor="amount" className="text-sm font-medium text-foreground">
                      Payment Amount <span className="text-red-500">*</span>
                    </Label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-medium">₹</span>
                      <Input
                        id="amount"
                        type="number"
                        placeholder={billAmount ? "Amount auto-filled from bill" : "Enter payment amount"}
                        value={paymentForm.amount}
                        onChange={(e) => setPaymentForm({ ...paymentForm, amount: e.target.value })}
                        min="1"
                        max="100000"
                        step="0.01"
                        required
                        disabled={isLoading}
                        className="h-12 text-base pl-8"
                      />
                    </div>
                    {parseFloat(paymentForm.amount) > 0 && parseFloat(paymentForm.amount) <= 100000 && (
                      <p className="text-xs text-muted-foreground">
                        Paying ₹{parseFloat(paymentForm.amount).toLocaleString("en-IN")}
                        {billAmount && parseFloat(paymentForm.amount) === billAmount && " (Full bill amount)"}
                      </p>
                    )}
                    {parseFloat(paymentForm.amount) > 100000 && (
                      <p className="text-xs text-red-600 flex items-center gap-1"><AlertCircle className="w-3 h-3" />Maximum payment amount is ₹1,00,000 per transaction</p>
                    )}
                  </div>

                  {/* Info box */}
                  <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 space-y-2">
                    <p className="text-sm font-semibold text-blue-900 dark:text-blue-100 flex items-center gap-2">
                      <AlertCircle className="w-4 h-4" />Important Information
                    </p>
                    <ul className="text-sm text-blue-800 dark:text-blue-200 space-y-1.5 list-disc list-inside ml-1">
                      <li>Ensure you have sufficient balance in your wallet</li>
                      <li>Payment will be processed instantly upon confirmation</li>
                      <li>Double-check customer ID and operator before submitting</li>
                      <li>Completed transactions cannot be reversed or cancelled</li>
                      <li>You will receive a confirmation email after payment</li>
                      <li>A receipt will automatically open in a new tab on success</li>
                    </ul>
                  </div>

                  {/* Submit */}
                  <Button
                    type="submit"
                    size="lg"
                    disabled={
                      isLoading ||
                      !validateCustomerId(paymentForm.customerId) ||
                      !validateEmail(paymentForm.customerEmail) ||
                      !paymentForm.operatorCode ||
                      parseFloat(paymentForm.amount) <= 0 ||
                      parseFloat(paymentForm.amount) > 100000
                    }
                    className="w-full paybazaar-gradient text-white hover:opacity-90 transition-opacity h-12 text-base font-medium disabled:opacity-50"
                  >
                    {isLoading ? (
                      <span className="flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" />Processing Your Payment...</span>
                    ) : (
                      <><Zap className="w-4 h-4 mr-2" />Pay Bill ₹{paymentForm.amount || "0"} Now</>
                    )}
                  </Button>
                </form>
              </CardContent>
            </Card>

            {/* History Card */}
            <Card className="shadow-lg border-border/50">
              <CardHeader className="paybazaar-gradient text-white rounded-t-xl space-y-1 pb-6">
                <CardTitle className="flex items-center justify-between">
                  <span className="flex items-center gap-2 text-xl">
                    <RefreshCw className="w-5 h-5" />
                    Recent Payment History
                  </span>
                  <Button variant="secondary" size="sm" onClick={fetchPaymentHistory} disabled={isLoadingHistory}>
                    {isLoadingHistory ? <Loader2 className="w-4 h-4 animate-spin" /> : <><RefreshCw className="w-4 h-4 mr-1" />Refresh</>}
                  </Button>
                </CardTitle>
                <p className="text-sm text-white/90">View your last 10 electricity bill payments</p>
              </CardHeader>
              <CardContent className="pt-6">
                {isLoadingHistory ? (
                  <div className="flex flex-col items-center justify-center py-12">
                    <Loader2 className="w-8 h-8 animate-spin text-primary mb-3" />
                    <p className="text-sm text-muted-foreground">Loading your payment history...</p>
                  </div>
                ) : paymentHistory.length === 0 ? (
                  <div className="text-center py-12">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-muted mb-4">
                      <Zap className="w-8 h-8 text-muted-foreground" />
                    </div>
                    <p className="text-lg font-semibold text-foreground mb-2">No Payment History</p>
                    <p className="text-sm text-muted-foreground">Your electricity bill payments will appear here</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {paymentHistory.slice(0, 10).map((history) => (
                      <div key={history.electricity_bill_transaction_id} className="border rounded-lg p-4 hover:bg-muted/50 transition-colors">
                        <div className="flex items-start justify-between">
                          <div className="space-y-1 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="font-semibold text-base font-mono">{history.customer_id}</p>
                              {getStatusBadge(history.transaction_status)}
                            </div>
                            <p className="text-sm text-muted-foreground">{history.operator_name}</p>
                            <p className="text-xs text-muted-foreground">{history.customer_email}</p>
                            {history.order_id && <p className="text-xs text-muted-foreground font-mono">Order: {history.order_id}</p>}
                            <p className="text-xs text-muted-foreground">
                              {new Date(history.created_at).toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                            </p>
                          </div>
                          <div className="text-right space-y-1">
                            <p className="font-bold text-lg text-primary">₹{history.amount.toLocaleString("en-IN")}</p>
                            {history.commision > 0 && (
                              <p className="text-xs text-green-600 flex items-center gap-1 justify-end">
                                <CheckCircle2 className="w-3 h-3" />+₹{history.commision.toFixed(2)} earned
                              </p>
                            )}
                            {history.before_balance > 0 && (
                              <p className="text-xs text-muted-foreground">Balance: ₹{history.after_balance.toLocaleString("en-IN")}</p>
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

      {/* ── Success animation overlay ── */}
      {showSuccessAnimation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="relative">
            {/* Confetti particles */}
            <div className="absolute inset-0 flex items-center justify-center">
              {[...Array(12)].map((_, i) => (
                <div
                  key={i}
                  className="absolute w-3 h-3 bg-gradient-to-r from-green-400 to-emerald-400 rounded-full animate-ping"
                  style={{
                    animationDelay: `${i * 0.1}s`,
                    animationDuration: "1.5s",
                    left: `${50 + 40 * Math.cos((i * Math.PI * 2) / 12)}%`,
                    top: `${50 + 40 * Math.sin((i * Math.PI * 2) / 12)}%`,
                  }}
                />
              ))}
            </div>
            {/* Card */}
            <div className="relative bg-white rounded-3xl shadow-2xl p-12 max-w-md mx-4 animate-scale-in">
              <div className="relative mx-auto w-32 h-32 mb-6">
                <div className="absolute inset-0 rounded-full bg-gradient-to-r from-green-400 to-emerald-500 animate-pulse" />
                <div className="absolute inset-2 rounded-full bg-white flex items-center justify-center">
                  <CheckCircle2 className="w-20 h-20 text-green-500 animate-check-draw" strokeWidth={3} />
                </div>
              </div>
              <div className="text-center space-y-3">
                <h2 className="text-3xl font-bold text-gray-900">Payment Successful! 🎉</h2>
                <p className="text-lg text-gray-600">Your electricity bill has been paid successfully</p>
                {transactionId && (
                  <p className="text-sm text-gray-500 font-mono">Transaction ID: {transactionId}</p>
                )}
                
                <div className="flex flex-col gap-3 pt-4">
                  <Button 
                    onClick={() => {
                      const tab = window.open("", "_blank");
                      if (tab && pendingReceiptData) writeReceiptToTab(tab, pendingReceiptData, retailerProfile);
                    }}
                    className="w-full bg-black hover:bg-gray-900 text-white h-12 rounded-xl font-bold text-base"
                  >
                    <Receipt className="w-5 h-5 mr-2" />
                    View & Print Receipt
                  </Button>
                  <Button 
                    variant="ghost" 
                    onClick={() => setShowSuccessAnimation(false)}
                    className="w-full h-12 rounded-xl text-gray-500 font-semibold"
                  >
                    Close
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Bill Details Dialog */}
      <Dialog open={isBillDialogOpen} onOpenChange={setIsBillDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div className="p-2 rounded-full bg-green-500/10">
                <CheckCircle2 className="w-5 h-5 text-green-600" />
              </div>
              Bill Details Retrieved
            </DialogTitle>
            <DialogDescription>Review your electricity bill details before payment</DialogDescription>
          </DialogHeader>
          {billDetails && (
            <div className="space-y-4 py-4">
              <div className="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-950/20 dark:to-emerald-950/20 border-2 border-green-200 dark:border-green-800 rounded-lg p-5">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium text-green-800 dark:text-green-200">Bill Amount</span>
                  <span className="text-3xl font-bold text-green-600 dark:text-green-400">₹{parseFloat(billDetails.billAmount).toLocaleString("en-IN")}</span>
                </div>
                <p className="text-xs text-green-700 dark:text-green-300 text-right">Amount auto-filled in payment form</p>
              </div>
              <div className="space-y-3">
                {billDetails.consumerName && (
                  <div className="flex justify-between items-center py-2 border-b">
                    <span className="text-sm font-medium text-muted-foreground">Consumer Name</span>
                    <span className="text-sm font-semibold">{billDetails.consumerName}</span>
                  </div>
                )}
                <div className="flex justify-between items-center py-2 border-b">
                  <span className="text-sm font-medium text-muted-foreground">Consumer ID</span>
                  <span className="text-sm font-semibold font-mono">{billDetails.consumerId}</span>
                </div>
                {billDetails.billDate && (
                  <div className="flex justify-between items-center py-2 border-b">
                    <span className="text-sm font-medium text-muted-foreground">Bill Date</span>
                    <span className="text-sm font-semibold">{new Date(billDetails.billDate).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}</span>
                  </div>
                )}
                {billDetails.dueDate && (
                  <div className="flex justify-between items-center py-2 border-b">
                    <span className="text-sm font-medium text-muted-foreground">Due Date</span>
                    <span className="text-sm font-semibold text-amber-600 dark:text-amber-400">{new Date(billDetails.dueDate).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}</span>
                  </div>
                )}
              </div>
              <div className="flex gap-3 pt-4">
                <Button variant="outline" onClick={() => setIsBillDialogOpen(false)} className="flex-1">Cancel</Button>
                <Button onClick={() => { setIsBillDialogOpen(false); setTimeout(() => document.getElementById("customerEmail")?.focus(), 100); }} className="flex-1 paybazaar-gradient text-white">
                  <CheckCircle2 className="w-4 h-4 mr-2" />Proceed to Pay
                </Button>
              </div>
              <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-md p-3">
                <p className="text-xs text-center text-blue-700 dark:text-blue-300 flex items-center justify-center gap-2">
                  <AlertCircle className="w-3 h-3" />
                  Bill amount has been automatically filled. Enter your email to continue.
                </p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Animations */}
      <style>{`
        @keyframes scale-in { 0% { transform: scale(0.5); opacity: 0; } 50% { transform: scale(1.05); } 100% { transform: scale(1); opacity: 1; } }
        @keyframes check-draw { 0% { stroke-dasharray: 0 100; } 100% { stroke-dasharray: 100 100; } }
        .animate-scale-in { animation: scale-in 0.6s cubic-bezier(0.34, 1.56, 0.64, 1); }
        .animate-check-draw { animation: check-draw 0.8s ease-in-out 0.3s forwards; }
      `}</style>
    </div>
  );
};

export default ElectricityBillPayment;