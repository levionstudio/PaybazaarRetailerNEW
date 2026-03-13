import { useState, useEffect, FormEvent } from "react";
import { AppSidebar } from "@/components/layout/AppSidebar";
import { Header } from "@/components/layout/Header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ArrowLeft, Eye, CheckCircle2, Trash2, X, AlertTriangle, Printer } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { AddBeneficiaryDialog } from "@/components/dialogs/AddBeneficiaryDialog";
import { useToast } from "@/hooks/use-toast";
import axios from "axios";
import { jwtDecode } from "jwt-decode";

interface DecodedToken {
  admin_id: string;
  user_id: string;
  user_name: string;
  user_role: string;
  exp: number;
  iat: number;
}

interface Beneficiary {
  beneficiary_id: string;
  mobile_number: string;
  bank_name: string;
  beneficiary_name: string;
  account_number: string;
  ifsc_code: string;
  beneficiary_phone: string;
  beneficiary_verified: boolean;
}

interface PayoutReceiptData {
  beneficiaryName: string;
  bankName: string;
  accountNumber: string;
  ifscCode: string;
  mobileNumber: string;
  amount: number;
  transferType: string;
  transactionId: string;
  status: string;
  createdAt: string;
  retailerName?: string;
  retailerBusinessName?: string;
  retailerId?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Writes receipt HTML into an already-opened tab.
// Open the tab BEFORE any await, then call this after the response.
// ─────────────────────────────────────────────────────────────────────────────
const writeReceiptToTab = (tab: Window, data: PayoutReceiptData) => {
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

  const numberToWords = (num: number): string => {
    const a = ['', 'One ', 'Two ', 'Three ', 'Four ', 'Five ', 'Six ', 'Seven ', 'Eight ', 'Nine ', 'Ten ', 'Eleven ', 'Twelve ', 'Thirteen ', 'Fourteen ', 'Fifteen ', 'Sixteen ', 'Seventeen ', 'Eighteen ', 'Nineteen '];
    const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

    const numStr = num.toString().split('.')[0];
    if (numStr === '0') return 'Zero';
    
    const n = ('000000000' + numStr).substr(-9).match(/^(\d{2})(\d{2})(\d{2})(\d{1})(\d{2})$/);
    if (!n) return ''; 
    
    let str = '';
    str += (Number(n[1]) != 0) ? (a[Number(n[1])] || b[n[1][0]] + ' ' + a[n[1][1]]) + 'Crore ' : '';
    str += (Number(n[2]) != 0) ? (a[Number(n[2])] || b[n[2][0]] + ' ' + a[n[2][1]]) + 'Lakh ' : '';
    str += (Number(n[3]) != 0) ? (a[Number(n[3])] || b[n[3][0]] + ' ' + a[n[3][1]]) + 'Thousand ' : '';
    str += (Number(n[4]) != 0) ? (a[Number(n[4])] || b[n[4][0]] + ' ' + a[n[4][1]]) + 'Hundred ' : '';
    str += (Number(n[5]) != 0) ? ((str != '') ? 'and ' : '') + (a[Number(n[5])] || b[n[5][0]] + ' ' + a[n[5][1]]) : '';
    return str.trim() + ' Rupees';
  };

  const statusUp = data.status.toUpperCase();
  const amountInWords = numberToWords(data.amount);

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1.0"/>
  <title>Receipt - ${data.transactionId}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background: #f3f4f6;
      font-family: Arial, sans-serif;
      padding: 20px;
      color: #000;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .action-bar { display: flex; gap: 10px; justify-content: center; margin-bottom: 20px; }
    .btn { padding: 10px 20px; border-radius: 5px; font-weight: bold; cursor: pointer; border: none; }
    .btn-print { background: #000; color: #fff; }
    .btn-close { background: #ddd; color: #333; }
    
    .receipt-container {
      width: 210mm;
      min-height: 148mm;
      margin: 0 auto;
      background: #fff;
      border: 1px solid #000;
      padding: 15px;
      color: #000;
    }
    .header-logo {
      text-align: center;
      margin-bottom: 20px;
      border-bottom: 1px solid #000;
      padding-bottom: 15px;
    }
    .header-logo h1 {
      font-size: 32px;
      font-weight: 800;
      letter-spacing: 4px;
      color: #000;
    }
    .details-row {
      display: flex;
      border-bottom: 1px solid #000;
    }
    .shop-details {
      flex: 1;
      padding: 15px;
      border-right: 1px solid #000;
      font-size: 14px;
      line-height: 1.5;
    }
    .beneficiary-details {
      flex: 1.5;
    }
    .bene-title {
      font-weight: bold;
      font-size: 11px;
      border-bottom: 1px solid #000;
      padding: 8px 15px;
      text-transform: uppercase;
      background: #f9f9f9;
    }
    .bene-content {
      padding: 15px;
      font-size: 14px;
      line-height: 1.8;
    }
    .bene-grid {
      display: grid;
      grid-template-columns: 140px 1fr;
    }
    .bene-value {
      font-weight: bold;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 0;
    }
    th {
      border: 1px solid #000;
      padding: 8px;
      font-size: 11px;
      background: #f0f0f0;
      text-transform: uppercase;
    }
    td {
      border: 1px solid #000;
      padding: 10px;
      font-size: 14px;
    }
    .text-center { text-align: center; }
    .text-right { text-align: right; }
    .totals-row td {
      font-weight: bold;
    }
    .amount-words {
      font-size: 20px;
      font-weight: bold;
      text-align: right;
      padding: 15px 0;
    }
    .footer-section {
      margin-top: 15px;
      display: flex;
      justify-content: space-between;
      border-top: 1px solid #000;
      padding-top: 15px;
      font-size: 13px;
    }
    .shop-footer {
      text-align: right;
    }
    @media print {
      body { background: white; padding: 0; }
      .action-bar { display: none !important; }
      .receipt-container { border: 1px solid #000; margin: 0; width: 100%; box-shadow: none; }
      @page { size: A4 landscape; margin: 10mm; }
    }
  </style>
</head>
<body>
  <div class="action-bar">
    <button class="btn btn-print" onclick="window.print()">Print Receipt</button>
    <button class="btn btn-close" onclick="window.close()">Close</button>
  </div>
  <div class="receipt-container">
    <div class="header-logo">
      <h1>PAYBAZAAR</h1>
      <div style="font-size: 12px; margin-top: -5px; font-weight: bold; color: #333;">TECHNOLOGIES</div>
    </div>

    <div class="details-row">
      <div class="shop-details">
        <div style="font-weight: bold; font-size: 18px; color: #000; margin-bottom: 5px;">${data.retailerBusinessName || 'PAYBAZAAR'}</div>
        <div style="font-size: 14px; margin-bottom: 2px;">Prop: ${data.retailerName || 'Retailer'}</div>
        <div style="font-size: 14px; margin-bottom: 2px;">Mob: ${data.mobileNumber}</div>
        <div style="font-size: 13px; color: #444;">ID: ${data.retailerId || '-'}</div>
      </div>
      <div class="beneficiary-details">
        <div class="bene-title">Beneficiary Detail</div>
        <div class="bene-content">
          <div class="bene-grid">
            <span class="bene-label">Beneficiary Name</span>
            <span class="bene-value">: ${data.beneficiaryName.toUpperCase()}</span>
            
            <span class="bene-label">Sender Number</span>
            <span class="bene-value">: ${data.mobileNumber}</span>
            
            <span class="bene-label">Bank</span>
            <span class="bene-value">: ${data.bankName.toUpperCase()}</span>
            
            <span class="bene-label">Account No.</span>
            <span class="bene-value">: ${data.accountNumber} (${data.ifscCode})</span>
            
            <span class="bene-label">Date Time</span>
            <span class="bene-value">: ${formatDate(data.createdAt)}</span>
          </div>
        </div>
      </div>
    </div>

    <table>
      <thead>
        <tr>
          <th style="width: 50px;">S.No</th>
          <th>Description</th>
          <th>Bank Ref ID</th>
          <th style="width: 120px;">Amount (Rs.)</th>
        </tr>
      </thead>
      <tbody>
        <tr style="height: 70px;">
          <td class="text-center" style="vertical-align: top;">1</td>
          <td style="vertical-align: top;">
            ${data.transferType} Transaction SUCCESS.<br/>
            ${data.transactionId}
          </td>
          <td class="text-center" style="vertical-align: top;">-</td>
          <td class="text-right" style="vertical-align: top;">${fmtAmount(data.amount)}</td>
        </tr>
        <tr class="totals-row">
          <td colspan="3" class="text-right">SUBTOTAL</td>
          <td class="text-right">₹ ${fmtAmount(data.amount)}</td>
        </tr>
        <tr class="totals-row">
          <td colspan="3" class="text-right">GRAND TOTAL</td>
          <td class="text-right">₹ ${fmtAmount(data.amount)}</td>
        </tr>
      </tbody>
    </table>

    <div class="amount-words">${amountInWords}</div>

    <div class="footer-section">
      <div style="line-height: 1.8;">
        Thank you!<br/>
        <strong>Customer Services:</strong>
      </div>
      <div class="shop-footer">
        <div style="font-size: 10px; color: #333; margin-bottom: 2px;">PLATFORM BY</div>
        <div style="font-weight: bold; font-size: 14px; color: #000;">Paybazaar Technologies</div>
        <div style="font-size: 11px; color: #555;">Support: info@paybazaar.in</div>
      </div>
    </div>
  </div>
  <script>
    function doPrint() {
      window.focus();
      window.print();
    }
    if (document.readyState === 'complete') {
      doPrint();
    } else {
      window.onload = doPrint;
    }
  </script>
</body>
</html>`;

  tab.document.open();
  tab.document.write(html);
  tab.document.close();
};

// ─────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────
export default function Settlement() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [showLoginDialog, setShowLoginDialog] = useState(true);
  const [payoutPhoneNumber, setPayoutPhoneNumber] = useState("");
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [showAddBeneficiary, setShowAddBeneficiary] = useState(false);
  const [showPayDialog, setShowPayDialog] = useState(false);
  const [selectedBeneficiary, setSelectedBeneficiary] = useState<Beneficiary | null>(null);
  const [beneficiaries, setBeneficiaries] = useState<Beneficiary[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetchingBeneficiaries, setFetchingBeneficiaries] = useState(false);
  const [tokenData, setTokenData] = useState<DecodedToken | null>(null);
  
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [beneficiaryToDelete, setBeneficiaryToDelete] = useState<Beneficiary | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  
  const [showMpinVerificationDialog, setShowMpinVerificationDialog] = useState(false);
  const [verifiedMpin, setVerifiedMpin] = useState("");
  const [mpinVerificationError, setMpinVerificationError] = useState<string | null>(null);
  
  const [showSuccessAnimation, setShowSuccessAnimation] = useState(false);
  const [transactionId, setTransactionId] = useState<string | null>(null);
  const [pendingReceiptData, setPendingReceiptData] = useState<PayoutReceiptData | null>(null);
  const [retailerProfile, setRetailerProfile] = useState<any>(null);

  const [payFormData, setPayFormData] = useState({
    transactionType: "",
    amount: "",
  });

  const fetchBeneficiaries = async (phoneNumber: string) => {
    try {
      setFetchingBeneficiaries(true);
      const token = localStorage.getItem("authToken");
      const response = await axios.get(
        `${import.meta.env.VITE_API_BASE_URL}/bene/get/beneficiaries/${phoneNumber}`,
        { headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" } }
      );
      if (response.data.status === "success" && response.data.data?.beneficieries) {
        setBeneficiaries(response.data.data.beneficieries);
        if (response.data.data.beneficieries.length > 0) {
          toast({ title: "✓ Beneficiaries Loaded", description: `Found ${response.data.data.beneficieries.length} beneficiar${response.data.data.beneficieries.length > 1 ? 'ies' : 'y'} for this account` });
        }
      } else {
        setBeneficiaries([]);
      }
    } catch (error: any) {
      console.error("Error fetching beneficiaries:", error);
      setBeneficiaries([]);
      if (error.response?.status === 404) return;
      let errorMessage = "Unable to load beneficiaries. Please try again.";
      if (error.code === "ECONNABORTED" || error.message?.includes("timeout")) errorMessage = "Request timed out. Please check your connection and try again.";
      else if (error.response?.status === 401) errorMessage = "Your session has expired. Please log in again.";
      else if (error.response?.status === 500) errorMessage = "Server error. Please try again in a few moments.";
      else if (!navigator.onLine) errorMessage = "No internet connection. Please check your network.";
      toast({ title: "⚠️ Error Loading Beneficiaries", description: errorMessage, variant: "destructive" });
    } finally {
      setFetchingBeneficiaries(false);
    }
  };

  useEffect(() => {
    const token = localStorage.getItem("authToken");
    if (!token) return;
    try {
      const decoded: DecodedToken = jwtDecode(token);
      setTokenData(decoded);
      
      // Fetch retailer profile once token is available
      const fetchProfile = async () => {
        try {
          const profileRes = await axios.get(
            `${import.meta.env.VITE_API_BASE_URL}/retailer/get/retailer/${decoded.user_id}`,
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
    } catch (error) {
      console.error("Error decoding token:", error);
      toast({ title: "⚠️ Session Error", description: "Unable to verify your session. Please log in again.", variant: "destructive" });
    }
  }, []);

  useEffect(() => {
    if (showSuccessAnimation && transactionId) {
      const timer = setTimeout(() => {
        // setShowSuccessAnimation(false); // Don't auto-hide, let user see success and click button
      }, 3500);
      return () => clearTimeout(timer);
    }
  }, [showSuccessAnimation, transactionId, pendingReceiptData]);

  const handleLogin = async () => {
    if (!payoutPhoneNumber) {
      toast({ title: "⚠️ Missing Information", description: "Please enter your 10-digit mobile number to continue", variant: "destructive" });
      return;
    }
    if (payoutPhoneNumber.length !== 10) {
      toast({ title: "⚠️ Invalid Mobile Number", description: "Mobile number must be exactly 10 digits", variant: "destructive" });
      return;
    }
    try {
      setIsAuthenticated(true);
      setShowLoginDialog(false);
      const token = localStorage.getItem("authToken");
      if (token) {
        try { const decoded: DecodedToken = jwtDecode(token); setTokenData(decoded); } catch {}
      }
      await fetchBeneficiaries(payoutPhoneNumber);
      toast({ title: "✓ Login Successful", description: `Welcome! You can now manage payouts for ${payoutPhoneNumber}` });
    } catch (error: any) {
      let errorMessage = "Unable to log in. Please try again.";
      if (error.response?.status === 401) errorMessage = "Invalid credentials. Please check your information.";
      else if (error.response?.status === 403) errorMessage = "Access denied. You don't have permission to access this service.";
      toast({ title: "❌ Login Failed", description: error.response?.data?.message || errorMessage, variant: "destructive" });
    }
  };

  const handleAddBeneficiary = async () => {
    if (payoutPhoneNumber) await fetchBeneficiaries(payoutPhoneNumber);
  };

  const handleDeleteClick = (beneficiary: Beneficiary) => {
    setBeneficiaryToDelete(beneficiary);
    setShowDeleteDialog(true);
  };

  const handleDeleteConfirm = async () => {
    if (!beneficiaryToDelete) return;
    try {
      setIsDeleting(true);
      const token = localStorage.getItem("authToken");
      const response = await axios.get(
        `${import.meta.env.VITE_API_BASE_URL}/bene/delete/beneficiary/${beneficiaryToDelete.beneficiary_id}`,
        { headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" } }
      );
      if (response.status === 204 || response.status === 200 || response.data?.status === "success") {
        toast({ title: "✓ Beneficiary Deleted", description: `${beneficiaryToDelete.beneficiary_name} has been successfully removed from your list` });
        if (payoutPhoneNumber) await fetchBeneficiaries(payoutPhoneNumber);
        setShowDeleteDialog(false);
        setBeneficiaryToDelete(null);
      } else {
        toast({ title: "❌ Deletion Failed", description: response.data?.message || "Unable to delete beneficiary. Please try again.", variant: "destructive" });
      }
    } catch (error: any) {
      let errorMessage = "Unable to delete beneficiary. Please try again.";
      if (error.response?.status === 404) errorMessage = "Beneficiary not found. It may have already been deleted.";
      else if (error.response?.status === 403) errorMessage = "You don't have permission to delete this beneficiary.";
      else if (error.response?.status === 500) errorMessage = "Server error occurred. Please try again in a moment.";
      toast({ title: "❌ Deletion Failed", description: error.response?.data?.message || errorMessage, variant: "destructive" });
    } finally {
      setIsDeleting(false);
    }
  };

  const handlePayClick = (beneficiary: Beneficiary) => {
    setSelectedBeneficiary(beneficiary);
    setPayFormData({ transactionType: "", amount: "" });
    setShowPayDialog(true);
  };

  const handleMpinVerificationInput = (value: string) => {
    if (/^\d{0,4}$/.test(value)) {
      setVerifiedMpin(value);
      setMpinVerificationError(null);
    }
  };

  // ── Called when user submits MPIN form ──
  // Open the receipt tab HERE (directly in user gesture) before any await
  const handleMpinVerification = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (verifiedMpin.length !== 4) {
      setMpinVerificationError("Please enter your complete 4-digit MPIN");
      return;
    }

    setShowMpinVerificationDialog(false);
    setMpinVerificationError(null);
    await submitPayout();
  };

  const handlePaySubmit = async () => {
    if (!selectedBeneficiary) return;
    if (!payFormData.transactionType) {
      toast({ title: "⚠️ Missing Information", description: "Please select a transfer type (IMPS or NEFT)", variant: "destructive" });
      return;
    }
    if (!payFormData.amount) {
      toast({ title: "⚠️ Missing Information", description: "Please enter the payout amount", variant: "destructive" });
      return;
    }
    const amount = parseFloat(payFormData.amount);
    if (amount <= 0) {
      toast({ title: "⚠️ Invalid Amount", description: "Payout amount must be greater than ₹0", variant: "destructive" });
      return;
    }
    if (amount > 200000) {
      toast({ title: "⚠️ Amount Too High", description: "Maximum payout amount is ₹2,00,000 per transaction", variant: "destructive" });
      return;
    }
    setShowMpinVerificationDialog(true);
    setVerifiedMpin("");
    setMpinVerificationError(null);
  };

  const submitPayout = async () => {
    if (!selectedBeneficiary) return;
    if (!verifiedMpin || verifiedMpin.length !== 4) {
      toast({ title: "⚠️ MPIN Required", description: "Please enter your 4-digit MPIN to authorize this transaction", variant: "destructive" });
      setShowMpinVerificationDialog(true);
      return;
    }

    try {
      setLoading(true);
      const token = localStorage.getItem("authToken");
      if (!tokenData?.user_id || !tokenData?.admin_id) {
        toast({ title: "⚠️ Session Error", description: "Your session has expired. Please log in again to continue.", variant: "destructive" });

      }

      const response = await axios.post(
        `${import.meta.env.VITE_API_BASE_URL}/payout/create`,
        {
          admin_id: tokenData.admin_id,
          retailer_id: tokenData.user_id,
          mobile_number: selectedBeneficiary.mobile_number,
          ifsc_code: selectedBeneficiary.ifsc_code,
          bank_name: selectedBeneficiary.bank_name,
          account_number: selectedBeneficiary.account_number,
          beneficiary_name: selectedBeneficiary.beneficiary_name,
          amount: parseFloat(payFormData.amount),
          transfer_type: parseInt(payFormData.transactionType),
          mpin: parseInt(verifiedMpin),
        },
        { headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" } }
      );

      const txnId = response.data?.data?.orderid ||
                    response.data?.data?.transaction_id ||
                    Date.now().toString();

      const transferTypeLabel = payFormData.transactionType === "5" ? "IMPS" : "NEFT";

      setShowPayDialog(false);
      setTransactionId(txnId);
      setShowSuccessAnimation(true);

      // ── Store receipt data — tab opens after animation fades (3.5s) ──
      setPendingReceiptData({
        beneficiaryName: selectedBeneficiary.beneficiary_name,
        bankName:        selectedBeneficiary.bank_name,
        accountNumber:   selectedBeneficiary.account_number,
        ifscCode:        selectedBeneficiary.ifsc_code,
        mobileNumber:    selectedBeneficiary.mobile_number,
        amount:          parseFloat(payFormData.amount),
        transferType:    transferTypeLabel,
        transactionId:   txnId,
        status:          "SUCCESS",
        createdAt:       new Date().toISOString(),
        retailerName:    retailerProfile?.retailer_name || tokenData?.user_name,
        retailerBusinessName: retailerProfile?.business_name,
        retailerId:      retailerProfile?.retailer_id || tokenData?.user_id,
      });

      setPayFormData({ transactionType: "", amount: "" });
      setVerifiedMpin("");
      if (payoutPhoneNumber) await fetchBeneficiaries(payoutPhoneNumber);

      toast({ title: "✓ Payout Initiated Successfully", description: `₹${payFormData.amount} sent to ${selectedBeneficiary.beneficiary_name}. Transaction ID: ${txnId}` });

    } catch (error: any) {

      setVerifiedMpin("");

      let errorTitle = "Transaction Failed";
      let errorMessage = "Unable to process your payout. Please try again.";

      if (error.response?.status === 401 || error.response?.status === 403) {
        errorTitle = "🔒 Authentication Failed";
        errorMessage = "Incorrect MPIN. Please try again.";
        setShowMpinVerificationDialog(true);
      } else if (error.response?.data?.message?.toLowerCase().includes("mpin")) {
        errorTitle = "🔒 Invalid MPIN";
        errorMessage = "The MPIN you entered is incorrect. Please try again.";
        setShowMpinVerificationDialog(true);
      } else if (error.response?.data?.message?.toLowerCase().includes("insufficient")) {
        errorTitle = "💰 Insufficient Balance";
        errorMessage = "You don't have enough balance to complete this transaction.";
      } else if (error.response?.data?.message?.toLowerCase().includes("limit")) {
        errorTitle = "⚠️ Transaction Limit Exceeded";
        errorMessage = "This transaction exceeds your daily limit. Please try a smaller amount.";
      } else if (error.response?.data?.message?.toLowerCase().includes("beneficiary")) {
        errorTitle = "⚠️ Beneficiary Issue";
        errorMessage = "There's a problem with this beneficiary. Please verify the details.";
      } else if (error.response?.status === 500) {
        errorTitle = "⚠️ Server Error";
        errorMessage = "Our service is temporarily unavailable. Please try again in a few moments.";
      } else if (!navigator.onLine) {
        errorTitle = "📡 No Internet Connection";
        errorMessage = "Please check your internet connection and try again.";
      } else if (error.response?.data?.message) {
        const rawMsg: string = error.response.data.message;
        const hiddenMessages = ["invalid status from recharge kit", "recharge kit"];
        const isHidden = hiddenMessages.some((m) => rawMsg.toLowerCase().includes(m.toLowerCase()));
        if (!isHidden) errorMessage = rawMsg;
      }

      setMpinVerificationError(errorMessage);
      toast({ title: errorTitle, description: errorMessage, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="flex min-h-screen bg-background w-full">
        <AppSidebar />
        <div className="flex-1 flex flex-col w-full">
          <Header />
          <div className="paybazaar-gradient rounded-lg p-6 text-white m-6">
            <div className="flex items-center space-x-4">
              <Button variant="ghost" size="icon" onClick={() => navigate("/services")} className="text-white hover:bg-slate-700">
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div>
                <h1 className="text-2xl font-bold">Remitter Login</h1>
                <p className="text-white/90">Enter your phone number to access payout services</p>
              </div>
            </div>
          </div>
          <div className="flex-1 flex justify-center p-6">
            <div className="w-full max-w-xl">
              <div className="bg-card rounded-lg border border-border shadow-lg p-8">
                <form onSubmit={(e) => { e.preventDefault(); handleLogin(); }} className="space-y-6">
                  <div className="space-y-2">
                    <Label htmlFor="phoneNumber" className="text-sm font-medium text-foreground">
                      Mobile Number <span className="text-destructive">*</span>
                    </Label>
                    <div className="relative">
                      <Input id="phoneNumber" type="tel" value={payoutPhoneNumber}
                        onChange={(e) => setPayoutPhoneNumber(e.target.value.replace(/\D/g, "").slice(0, 10))}
                        placeholder="Enter 10-digit mobile number"
                        className="h-12 border-2 border-border focus:border-primary transition-colors pr-10"
                        maxLength={10} required />
                      {payoutPhoneNumber && (
                        <button type="button" onClick={() => setPayoutPhoneNumber("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
                          <X className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                    {payoutPhoneNumber && payoutPhoneNumber.length < 10 && (
                      <p className="text-xs text-muted-foreground">{10 - payoutPhoneNumber.length} more digit{10 - payoutPhoneNumber.length > 1 ? 's' : ''} required</p>
                    )}
                  </div>
                  <Button type="submit" className="w-full h-12 paybazaar-gradient text-white hover:opacity-90 shadow-lg font-semibold" disabled={payoutPhoneNumber.length !== 10}>
                    Continue to Payout Services
                  </Button>
                </form>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-background w-full">
      <AppSidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Header />

        <main className="flex-1 overflow-auto bg-muted/20">
          <div className="paybazaar-gradient text-white p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="text-white hover:bg-white/20">
                  <ArrowLeft className="h-5 w-5" />
                </Button>
                <h1 className="text-2xl font-bold">Settlement</h1>
              </div>
              <Button onClick={() => setShowAddBeneficiary(true)} className="bg-white text-primary hover:bg-white/90">
                + Add Beneficiary
              </Button>
            </div>
          </div>

          <div className="p-6">
            <div className="bg-card rounded-lg border border-border shadow-lg overflow-hidden">
              <div className="paybazaar-gradient p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-white font-medium">Show</span>
                    <Select defaultValue="10">
                      <SelectTrigger className="w-20 h-9 bg-white/10 border-white/20 text-white hover:bg-white/20">
                        <SelectValue className="text-white" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="10">10</SelectItem>
                        <SelectItem value="25">25</SelectItem>
                        <SelectItem value="50">50</SelectItem>
                      </SelectContent>
                    </Select>
                    <span className="text-sm text-white font-medium">entries</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-white font-medium">Search:</span>
                    <Input className="w-56 h-9 bg-white/10 border-white/20 text-white placeholder:text-white/60 focus:bg-white/20" placeholder="Search beneficiaries..." />
                  </div>
                </div>
              </div>

              <div className="overflow-x-auto">
                <div className="w-full min-w-full">
                  <Table>
                    <TableHeader>
                      <TableRow className="paybazaar-gradient hover:opacity-95">
                        <TableHead className="font-bold text-white text-center w-[180px] min-w-[180px]">BENEFICIARY NAME</TableHead>
                        <TableHead className="font-bold text-white text-center w-[180px] min-w-[180px]">BANK NAME</TableHead>
                        <TableHead className="font-bold text-white text-center w-[140px] min-w-[140px]">IFSC</TableHead>
                        <TableHead className="font-bold text-white text-center w-[180px] min-w-[180px]">ACCOUNT NUMBER</TableHead>
                        <TableHead className="font-bold text-white text-center w-[150px] min-w-[150px]">MOBILE NUMBER</TableHead>
                        <TableHead className="font-bold text-white text-center w-[120px] min-w-[120px]">PAY</TableHead>
                        <TableHead className="font-bold text-white text-center w-[120px] min-w-[120px]">DELETE</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {fetchingBeneficiaries ? (
                        <TableRow>
                          <TableCell colSpan={7} className="text-center py-16">
                            <div className="flex flex-col items-center justify-center">
                              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mb-4"></div>
                              <p className="text-sm text-muted-foreground">Loading your beneficiaries...</p>
                            </div>
                          </TableCell>
                        </TableRow>
                      ) : beneficiaries.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={7} className="text-center py-16">
                            <div className="flex flex-col items-center justify-center">
                              <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-muted mb-4">
                                <Eye className="h-10 w-10 text-muted-foreground" />
                              </div>
                              <p className="text-lg font-semibold text-foreground mb-2">No beneficiaries found</p>
                              <p className="text-sm text-muted-foreground mb-4">Start by adding your first beneficiary to send payouts</p>
                              <Button onClick={() => setShowAddBeneficiary(true)} className="paybazaar-gradient text-white">+ Add Your First Beneficiary</Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ) : (
                        beneficiaries.map((beneficiary, index) => (
                          <TableRow key={beneficiary.beneficiary_id} className={`hover:bg-muted/50 transition-colors ${index % 2 === 0 ? "bg-background" : "bg-muted/20"}`}>
                            <TableCell className="text-center font-medium py-4">{beneficiary.beneficiary_name}</TableCell>
                            <TableCell className="text-center py-4">{beneficiary.bank_name}</TableCell>
                            <TableCell className="text-center py-4 font-mono text-sm">{beneficiary.ifsc_code}</TableCell>
                            <TableCell className="text-center py-4 font-mono text-sm">{beneficiary.account_number}</TableCell>
                            <TableCell className="text-center py-4 font-mono">{beneficiary.beneficiary_phone || beneficiary.mobile_number}</TableCell>
                            <TableCell className="text-center py-4">
                              <Button size="sm" onClick={() => handlePayClick(beneficiary)} className="paybazaar-gradient text-white hover:opacity-90 shadow-md">
                                <Eye className="h-4 w-4 mr-1" />Pay
                              </Button>
                            </TableCell>
                            <TableCell className="text-center py-4">
                              <Button size="sm" variant="destructive" onClick={() => handleDeleteClick(beneficiary)} className="shadow-md">
                                <Trash2 className="h-4 w-4 mr-1" />Delete
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>

      {/* Success animation */}
      {showSuccessAnimation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="relative flex flex-col items-center">
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              {[...Array(12)].map((_, i) => (
                <div key={i} className="absolute w-3 h-3 bg-gradient-to-r from-green-400 to-emerald-400 rounded-full animate-ping"
                  style={{ animationDelay: `${i * 0.1}s`, animationDuration: '1.5s', left: `${50 + 40 * Math.cos((i * Math.PI * 2) / 12)}%`, top: `${50 + 40 * Math.sin((i * Math.PI * 2) / 12)}%` }} />
              ))}
            </div>
            
            <div className="bg-white p-8 rounded-2xl shadow-2xl flex flex-col items-center max-w-sm w-full mx-4 border border-green-100 relative">
              <div className="w-20 h-20 bg-green-50 rounded-full flex items-center justify-center mb-6 border-4 border-white shadow-inner">
                <CheckCircle2 className="w-12 h-12 text-green-500" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Payout Successful!</h2>
              <p className="text-gray-500 text-center mb-6">
                Your transaction has been processed successfully.
                <br />
                <span className="text-xs font-mono mt-2 block bg-gray-50 p-2 rounded">ID: {transactionId}</span>
              </p>
              
              <div className="flex flex-col gap-3 w-full">
                <Button 
                  onClick={() => {
                    if (pendingReceiptData) {
                      const tab = window.open("", "_blank");
                      if (tab) writeReceiptToTab(tab, pendingReceiptData);
                    }
                  }}
                  className="w-full bg-black hover:bg-gray-800 text-white py-6 text-lg font-semibold h-auto"
                >
                  <Eye className="mr-2 h-5 w-5" />
                  View & Print Receipt
                </Button>
                <Button 
                  onClick={() => {
                    setShowSuccessAnimation(false);
                    setPendingReceiptData(null);
                  }}
                  variant="ghost" 
                  className="w-full text-gray-500 py-3"
                >
                  Close
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      <AddBeneficiaryDialog open={showAddBeneficiary} onOpenChange={setShowAddBeneficiary} onAdd={handleAddBeneficiary} mobileNumber={payoutPhoneNumber} />

      {/* Delete Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />Delete Beneficiary?
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-3">
              <p>Are you sure you want to remove this beneficiary from your list?</p>
              {beneficiaryToDelete && (
                <div className="mt-4 p-4 bg-muted rounded-lg border">
                  <p className="font-semibold text-foreground mb-2">{beneficiaryToDelete.beneficiary_name}</p>
                  <div className="space-y-1 text-sm">
                    <p><span className="text-muted-foreground">Bank:</span> <span className="text-foreground">{beneficiaryToDelete.bank_name}</span></p>
                    <p><span className="text-muted-foreground">Account:</span> <span className="text-foreground font-mono">{beneficiaryToDelete.account_number}</span></p>
                    <p><span className="text-muted-foreground">IFSC:</span> <span className="text-foreground font-mono">{beneficiaryToDelete.ifsc_code}</span></p>
                  </div>
                </div>
              )}
              <p className="text-destructive font-medium">⚠️ This action cannot be undone.</p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfirm} disabled={isDeleting} className="bg-destructive hover:bg-destructive/90">
              {isDeleting ? <><span className="animate-spin mr-2">⏳</span>Deleting...</> : <><Trash2 className="mr-2 h-4 w-4" />Yes, Delete</>}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Pay Dialog */}
      <Dialog open={showPayDialog} onOpenChange={setShowPayDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl font-semibold">Send Payout</DialogTitle>
            <DialogDescription>Enter the transaction details to send money</DialogDescription>
          </DialogHeader>
          {selectedBeneficiary && (
            <div className="space-y-4 py-4">
              <div className="space-y-2 p-4 bg-muted rounded-lg">
                <p className="text-xs text-muted-foreground font-medium mb-2">SENDING TO:</p>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div><span className="text-muted-foreground block text-xs mb-1">Beneficiary Name</span><p className="font-semibold text-foreground">{selectedBeneficiary.beneficiary_name}</p></div>
                  <div><span className="text-muted-foreground block text-xs mb-1">Bank Name</span><p className="font-semibold text-foreground">{selectedBeneficiary.bank_name}</p></div>
                  <div><span className="text-muted-foreground block text-xs mb-1">IFSC Code</span><p className="font-semibold text-foreground font-mono text-xs">{selectedBeneficiary.ifsc_code}</p></div>
                  <div><span className="text-muted-foreground block text-xs mb-1">Account Number</span><p className="font-semibold text-foreground font-mono text-xs">{selectedBeneficiary.account_number}</p></div>
                  <div className="col-span-2"><span className="text-muted-foreground block text-xs mb-1">Mobile Number</span><p className="font-semibold text-foreground font-mono">{selectedBeneficiary.mobile_number}</p></div>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="transactionType">Transfer Mode *</Label>
                <Select value={payFormData.transactionType} onValueChange={(value) => setPayFormData({ ...payFormData, transactionType: value })} required>
                  <SelectTrigger className="h-11"><SelectValue placeholder="Choose transfer method" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="5"><div className="flex flex-col items-start"><span className="font-medium">IMPS</span><span className="text-xs text-muted-foreground">Instant transfer (24/7)</span></div></SelectItem>
                    <SelectItem value="6"><div className="flex flex-col items-start"><span className="font-medium">NEFT</span><span className="text-xs text-muted-foreground">Standard transfer (Working hours)</span></div></SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="amount">Amount (₹) *</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-medium">₹</span>
                  <Input id="amount" type="number" value={payFormData.amount} onChange={(e) => setPayFormData({ ...payFormData, amount: e.target.value })} placeholder="Enter amount to send" className="h-11 pl-8" min="1" step="0.01" required />
                </div>
                {payFormData.amount && parseFloat(payFormData.amount) > 0 && (
                  <p className="text-xs text-muted-foreground">You're sending ₹{parseFloat(payFormData.amount).toLocaleString('en-IN')} to {selectedBeneficiary.beneficiary_name}</p>
                )}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPayDialog(false)}>Cancel</Button>
            <Button onClick={handlePaySubmit} className="paybazaar-gradient text-white" disabled={loading || !payFormData.transactionType || !payFormData.amount}>
              {loading ? <div className="flex items-center gap-2"><div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div><span>Processing...</span></div> : "Proceed to Payment"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MPIN Dialog */}
      <Dialog open={showMpinVerificationDialog}
        onOpenChange={(open) => {
          if (!loading) {
            setShowMpinVerificationDialog(open);
            if (!open) { setVerifiedMpin(""); setMpinVerificationError(null); }
          }
        }}
      >
        <DialogContent className="sm:max-w-md bg-background border-border"
          onEscapeKeyDown={(event) => { if (loading) event.preventDefault(); }}
          onInteractOutside={(event) => { if (loading) event.preventDefault(); }}
        >
          <DialogHeader>
            <DialogTitle className="text-xl font-semibold">🔒 Verify Your MPIN</DialogTitle>
            <DialogDescription>Enter your 4-digit MPIN to authorize this payout transaction</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleMpinVerification} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="verifyMpin" className="text-sm font-medium">Security PIN</Label>
              <Input id="verifyMpin" type="password" inputMode="numeric" autoComplete="one-time-code"
                value={verifiedMpin} maxLength={4} placeholder="••••"
                onChange={(event) => handleMpinVerificationInput(event.target.value)}
                required className="text-center tracking-[0.5em] text-2xl h-14 font-bold" disabled={loading} autoFocus />
              <p className="text-xs text-muted-foreground text-center">Enter your 4-digit MPIN to confirm</p>
            </div>
            {mpinVerificationError && (
              <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20">
                <p className="text-sm text-destructive font-medium flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4" />{mpinVerificationError}
                </p>
              </div>
            )}
            <DialogFooter className="flex gap-3">
              <Button type="button" variant="outline" className="flex-1" disabled={loading}
                onClick={() => { setShowMpinVerificationDialog(false); setVerifiedMpin(""); setMpinVerificationError(null); }}>
                Cancel
              </Button>
              <Button type="submit" className="flex-1 paybazaar-gradient text-white hover:opacity-90" disabled={loading || verifiedMpin.length !== 4}>
                {loading ? <div className="flex items-center gap-2"><div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div><span>Verifying...</span></div> : "Confirm & Pay"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <style>{`
        @keyframes scale-in { 0% { transform: scale(0.5); opacity: 0; } 50% { transform: scale(1.05); } 100% { transform: scale(1); opacity: 1; } }
        @keyframes check-draw { 0% { stroke-dasharray: 0 100; } 100% { stroke-dasharray: 100 100; } }
        .animate-scale-in { animation: scale-in 0.6s cubic-bezier(0.34, 1.56, 0.64, 1); }
        .animate-check-draw { animation: check-draw 0.8s ease-in-out 0.3s forwards; }
      `}</style>
    </div>
  );
}