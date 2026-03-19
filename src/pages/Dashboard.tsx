import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { jwtDecode } from "jwt-decode";

import { Header } from "@/components/layout/Header";
import { AppSidebar } from "@/components/layout/AppSidebar";
import { ServiceCard } from "@/components/dashboard/ServiceCard";
import { useToast } from "@/hooks/use-toast";

import {
  ArrowLeftRight,
  Smartphone,
  Shield,
  Wallet,
  Landmark,
  Building2,
  Loader2,
} from "lucide-react";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import { Badge } from "@/components/ui/badge";

/* -------------------- INTERFACES -------------------- */
interface DecodedToken {
  user_id: string;
  user_name: string;
  exp: number;
  iat: number;
}

interface UserInfo {
  id: string;
  name: string;
  role: string;
}

interface MobileRechargeTransaction {
  mobile_recharge_transaction_id: string;
  retailer_id: string;
  mobile_number: string;
  operator_code: string;
  operator_name: string;
  amount: number;
  before_balance: number;
  after_balance: number;
  commision: number;
  status: string;
  partner_request_id: string;
  created_at: string;
}

interface DTHTransaction {
  dth_transaction_id: number;
  retailer_id: string;
  customer_id: string;
  operator_code: number;
  operator_name: string;
  amount: number;
  before_balance: number;
  after_balance: number;
  commision: number;
  status: string;
  partner_request_id: string;
  created_at: string;
}

interface PostpaidTransaction {
  postpaid_recharge_transaction_id: number;
  retailer_id: string;
  retailer_name: string;
  retailer_business_name: string;
  partner_request_id: string;
  operator_transaction_id: string;
  order_id: string;
  mobile_number: string;
  operator_code: string;
  amount: number;
  before_balance: number;
  after_balance: number;
  circle_code: string;
  circle_name: string;
  operator_name: string;
  recharge_type: string;
  recharge_status: string;
  commission: number;
  created_at: string;
}

interface ElectricityBillTransaction {
  electricity_bill_transaction_id: number;
  retailer_id: string;
  customer_id: string;
  customer_email: string;
  operator_name: string;
  operator_id: number;
  amount: number;
  commision: number;
  before_balance: number;
  after_balance: number;
  transaction_status: string;
  partner_request_id: string;
  created_at: string;
}

interface PayoutTransaction {
  payout_transaction_id: string;
  operator_transaction_id: string | null;
  partner_request_id: string;
  order_id: string | null;
  retailer_id: string;
  retailer_name: string;
  retailer_business_name: string;
  mobile_number: string;
  bank_name: string;
  beneficiary_name: string;
  account_number: string;
  ifsc_code: string;
  amount: number;
  transfer_type: string;
  transaction_status: string;
  retailer_commision: number;
  before_balance: number;
  after_balance: number;
  created_at: string;
  updated_at: string;
}

interface RecentTransactions {
  mobile: MobileRechargeTransaction | null;
  dth: DTHTransaction | null;
  postpaid: PostpaidTransaction | null;
  electricity: ElectricityBillTransaction | null;
  payout: PayoutTransaction | null;
}

/* -------------------- DATE UTILITY (UTC SAFE) -------------------- */
const isToday = (dateString: string) => {
  const txDate = new Date(dateString); // UTC → local
  const today = new Date();

  return (
    txDate.getDate() === today.getDate() &&
    txDate.getMonth() === today.getMonth() &&
    txDate.getFullYear() === today.getFullYear()
  );
};

export default function Dashboard() {
  const navigate = useNavigate();
  const { toast } = useToast();

  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const [todayRechargeTotal, setTodayRechargeTotal] = useState(0);
  const [todayBBPSTotal, setTodayBBPSTotal] = useState(0);
  const [todayPayoutTotal, setTodayPayoutTotal] = useState(0);
  
  const [recentTransactions, setRecentTransactions] = useState<RecentTransactions>({
    mobile: null,
    dth: null,
    postpaid: null,
    electricity: null,
    payout: null,
  });

  /* -------------------- TOKEN VALIDATION -------------------- */
  useEffect(() => {
    const token = localStorage.getItem("authToken");

    if (!token) {
      toast({
        title: "Session expired",
        description: "Please login again.",
        variant: "destructive",
      });
      navigate("/login");
      return;
    }

    try {
      const decoded = jwtDecode<DecodedToken>(token);

      if (decoded.exp * 1000 < Date.now()) {
        localStorage.removeItem("authToken");
        navigate("/login");
        return;
      }

      setUserInfo({
        id: decoded.user_id,
        name: decoded.user_name,
        role: "retailer",
      });
    } catch {
      localStorage.removeItem("authToken");
      navigate("/login");
    } finally {
      setIsLoading(false);
    }
  }, [navigate, toast]);

  /* -------------------- FETCH TODAY TOTALS & RECENT TRANSACTIONS -------------------- */
  useEffect(() => {
    if (!userInfo?.id) return;

    const token = localStorage.getItem("authToken");
    if (!token) return;

    const headers = { Authorization: `Bearer ${token}` };

    const fetchTotals = async () => {
      try {
        /* ---------- MOBILE ---------- */
        const mobileRes = await axios.get(
          `${import.meta.env.VITE_API_BASE_URL}/mobile_recharge/get/${userInfo.id}`,
          { headers, params: { limit: 1000, offset: 0 } }
        );

        const mobileTransactions = mobileRes.data?.data?.recharges || [];
        const todayMobileTransactions = mobileTransactions.filter(
          (tx: MobileRechargeTransaction) => isToday(tx.created_at)
        );

        const mobileTotal = todayMobileTransactions.reduce(
          (sum: number, tx: MobileRechargeTransaction) => sum + tx.amount,
          0
        );

        // Get most recent mobile transaction from today
        const recentMobile = todayMobileTransactions.length > 0
          ? todayMobileTransactions[0]
          : null;

        /* ---------- DTH ---------- */
        const dthRes = await axios.get(
          `${import.meta.env.VITE_API_BASE_URL}/dth_recharge/get/${userInfo.id}`,
          { headers, params: { limit: 1000, offset: 0 } }
        );

        const dthTransactions = dthRes.data?.data?.recharges || [];
        const todayDTHTransactions = dthTransactions.filter(
          (tx: DTHTransaction) => isToday(tx.created_at)
        );

        const dthTotal = todayDTHTransactions.reduce(
          (sum: number, tx: DTHTransaction) => sum + tx.amount,
          0
        );

        // Get most recent DTH transaction from today
        const recentDTH = todayDTHTransactions.length > 0
          ? todayDTHTransactions[0]
          : null;

        setTodayRechargeTotal(mobileTotal + dthTotal);

        /* ---------- POSTPAID MOBILE RECHARGE ---------- */
        let postpaidTotal = 0;
        let recentPostpaid = null;
        
        try {
          const postpaidRes = await axios.get(
            `${import.meta.env.VITE_API_BASE_URL}/bbps/recharge/get/${userInfo.id}`,
            { headers }
          );

          // Backend returns: { status: "success", message: "...", data: { history: [...] } }
          const postpaidTransactions = postpaidRes.data?.data?.history || [];
          const todayPostpaidTransactions = postpaidTransactions.filter(
            (tx: PostpaidTransaction) => 
              isToday(tx.created_at) &&
              ["SUCCESS", "COMPLETED"].includes(tx.recharge_status?.toUpperCase())
          );

          postpaidTotal = todayPostpaidTransactions.reduce(
            (sum: number, tx: PostpaidTransaction) => sum + tx.amount,
            0
          );

          recentPostpaid = todayPostpaidTransactions.length > 0
            ? todayPostpaidTransactions[0]
            : null;
        } catch (error) {
          console.error("Postpaid fetch failed:", error);
        }

        /* ---------- ELECTRICITY BILL ---------- */
        let electricityTotal = 0;
        let recentElectricity = null;
        
        try {
          const electricityRes = await axios.get(
            `${import.meta.env.VITE_API_BASE_URL}/bbps/get/electricity/transactions/${userInfo.id}`,
            { headers }
          );

          const electricityTransactions = electricityRes.data?.data?.transactions || [];
          // Include all statuses for testing (SUCCESS, PENDING, FAILED)
          const todayElectricityTransactions = electricityTransactions.filter(
            (tx: ElectricityBillTransaction) => isToday(tx.created_at)
          );

          electricityTotal = todayElectricityTransactions.reduce(
            (sum: number, tx: ElectricityBillTransaction) => sum + tx.amount,
            0
          );

          recentElectricity = todayElectricityTransactions.length > 0
            ? todayElectricityTransactions[0]
            : null;
        } catch (error) {
          console.error("Electricity bill fetch failed:", error);
        }

        setTodayBBPSTotal(postpaidTotal + electricityTotal);

        /* ---------- PAYOUT (MONEY TRANSFER) ---------- */
        const payoutRes = await axios.get(
          `${import.meta.env.VITE_API_BASE_URL}/payout/get/${userInfo.id}`,
          { headers, params: { limit: 1000, offset: 0 } }
        );

        const payoutTransactions = payoutRes.data?.data?.transactions || [];
        const todayPayoutTransactions = payoutTransactions.filter(
          (tx: PayoutTransaction) =>
            isToday(tx.created_at) &&
            ["SUCCESS", "COMPLETED"].includes(tx.transaction_status)
        );

        const payoutTotal = todayPayoutTransactions.reduce(
          (sum: number, tx: PayoutTransaction) => sum + tx.amount,
          0
        );

        // Get most recent payout transaction from today
        const recentPayout = todayPayoutTransactions.length > 0
          ? todayPayoutTransactions[0]
          : null;

        setTodayPayoutTotal(payoutTotal);

        // Set all recent transactions
        setRecentTransactions({
          mobile: recentMobile,
          dth: recentDTH,
          postpaid: recentPostpaid,
          electricity: recentElectricity,
          payout: recentPayout,
        });
      } catch (error) {
        console.error("Dashboard totals fetch failed", error);
        setTodayRechargeTotal(0);
        setTodayBBPSTotal(0);
        setTodayPayoutTotal(0);
        setRecentTransactions({
          mobile: null,
          dth: null,
          postpaid: null,
          electricity: null,
          payout: null,
        });
      }
    };

    fetchTotals();
  }, [userInfo?.id]);

  /* -------------------- LOADING -------------------- */
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  /* -------------------- SERVICES -------------------- */
  const services = [
    {
      title: "Money Transfer",
      icon: ArrowLeftRight,
      status: "active" as const,
      description: "Send money instantly to any bank account",
      stats: [{ label: "Today", value: `₹${todayPayoutTotal.toFixed(2)}` }],
    },
    {
      title: "Mobile Recharge",
      icon: Smartphone,
      status: "active" as const,
      description: "Mobile & DTH recharges",
      stats: [{ label: "Today", value: `₹${todayRechargeTotal.toFixed(2)}` }],
    },
    {
      title: "AePS",
      icon: Shield,
      status: "active" as const,
      description: "Aadhaar Enabled Payment Services",
      stats: [{ label: "Today", value: "₹0.00" }],
    },
    {
      title: "BBPS",
      icon: Wallet,
      status: "active" as const,
      description: "Utility bill payments",
      stats: [{ label: "Today", value: `₹${todayBBPSTotal.toFixed(2)}` }],
    },
    {
      title: "Ticket Booking",
      icon: Building2,
      status: "active" as const,
      description: "Flight and bus booking",
      stats: [{ label: "Today", value: "₹0.00" }],
    },
    // {
    //   title: "UPI",
    //   icon: Landmark,
    //   status: "active" as const,
    //   description: "UPI payments",
    //   stats: [{ label: "Today", value: "₹0.00" }],
    // },
  ];

  /* -------------------- BUILD TABLE ROWS -------------------- */
  const recentTransactionRows = [];
  
  if (recentTransactions.mobile) {
    recentTransactionRows.push({
      type: "Mobile Recharge",
      amount: recentTransactions.mobile.amount,
      details: recentTransactions.mobile.mobile_number || "-",
      operator: recentTransactions.mobile.operator_name || "-",
      transactionId: recentTransactions.mobile.mobile_recharge_transaction_id || "-",
      status: recentTransactions.mobile.status || "SUCCESS",
      time: new Date(recentTransactions.mobile.created_at).toLocaleString(),
    });
  }

  if (recentTransactions.dth) {
    recentTransactionRows.push({
      type: "DTH Recharge",
      amount: recentTransactions.dth.amount,
      details: recentTransactions.dth.customer_id || "-",
      operator: recentTransactions.dth.operator_name || "-",
      transactionId: String(recentTransactions.dth.dth_transaction_id) || "-",
      status: recentTransactions.dth.status || "SUCCESS",
      time: new Date(recentTransactions.dth.created_at).toLocaleString(),
    });
  }

  if (recentTransactions.postpaid) {
    recentTransactionRows.push({
      type: "Postpaid Recharge",
      amount: recentTransactions.postpaid.amount,
      details: recentTransactions.postpaid.mobile_number || "-",
      operator: recentTransactions.postpaid.operator_name || "-",
      transactionId: String(recentTransactions.postpaid.postpaid_recharge_transaction_id) || "-",
      status: recentTransactions.postpaid.recharge_status || "SUCCESS",
      time: new Date(recentTransactions.postpaid.created_at).toLocaleString(),
    });
  }

  if (recentTransactions.electricity) {
    recentTransactionRows.push({
      type: "Electricity Bill",
      amount: recentTransactions.electricity.amount,
      details: recentTransactions.electricity.customer_id || "-",
      operator: recentTransactions.electricity.operator_name || "-",
      transactionId: String(recentTransactions.electricity.electricity_bill_transaction_id) || "-",
      status: recentTransactions.electricity.transaction_status || "SUCCESS",
      time: new Date(recentTransactions.electricity.created_at).toLocaleString(),
    });
  }

  if (recentTransactions.payout) {
    recentTransactionRows.push({
      type: "Money Transfer",
      amount: recentTransactions.payout.amount,
      details: recentTransactions.payout.beneficiary_name || "-",
      operator: recentTransactions.payout.account_number 
        ? `****${recentTransactions.payout.account_number.slice(-4)}`
        : "-",
      transactionId: recentTransactions.payout.payout_transaction_id || "-",
      status: recentTransactions.payout.transaction_status,
      time: new Date(recentTransactions.payout.created_at).toLocaleString(),
    });
  }

  /* -------------------- UI -------------------- */
  return (
    <div className="min-h-screen flex w-full bg-background">
      <AppSidebar />

      <div className="flex-1 flex flex-col min-w-0">
        <Header />

        <main className="flex-1 p-6 space-y-6 overflow-auto">
          <div className="paybazaar-gradient rounded-lg p-6 text-white">
            <h1 className="text-2xl font-bold">
              Welcome back, {userInfo?.name}!
            </h1>
            <p className="text-white/90">
              Today's Total Business: ₹
              {(todayRechargeTotal + todayBBPSTotal + todayPayoutTotal).toFixed(2)}
            </p>
          </div>

          <div>
            <h2 className="text-xl font-semibold mb-4">Your Services</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {services.map((service, index) => (
                <ServiceCard
                  key={index}
                  {...service}
                />
              ))}
            </div>
          </div>

          {/* Recent Transactions Table */}
          {recentTransactionRows.length > 0 && (
            <div className="space-y-4">
              <h2 className="text-xl font-semibold">Recent Transactions (Today)</h2>
              <div className="border rounded-lg">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Type</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Details</TableHead>
                      <TableHead>Operator/Account</TableHead>
                      <TableHead>Transaction ID</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Time</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {recentTransactionRows.map((row, index) => (
                      <TableRow key={index}>
                        <TableCell className="font-medium">{row.type}</TableCell>
                        <TableCell>₹{row.amount.toFixed(2)}</TableCell>
                        <TableCell>{row.details}</TableCell>
                        <TableCell>{row.operator}</TableCell>
                        <TableCell className="font-mono text-xs">{row.transactionId}</TableCell>
                        <TableCell>
                          <Badge 
                            variant={
                              row.status === "SUCCESS" || row.status === "COMPLETED"
                                ? "default"
                                : "secondary"
                            }
                            className={
                              row.status === "SUCCESS" || row.status === "COMPLETED"
                                ? "bg-green-500 hover:bg-green-600"
                                : ""
                            }
                          >
                            {row.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {row.time}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}

        </main>
      </div>
    </div>
  );
}