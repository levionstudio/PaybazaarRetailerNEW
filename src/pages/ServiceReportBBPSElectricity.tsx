import { useState, useEffect, useRef } from "react";
import axios from "axios";
import { jwtDecode } from "jwt-decode";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { AppSidebar } from "@/components/layout/AppSidebar";
import { Header } from "@/components/layout/Header";
import {
  ArrowLeft,
  RefreshCw,
  FileSpreadsheet,
  Download,
  Printer,
  Filter,
  Receipt as ReceiptIcon,
  Zap,
  Calendar,
  AlertCircle,
  X,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import * as XLSX from "xlsx";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";

interface TokenData {
  retailer_id?: string;
  user_id?: string;
  exp: number;
}

interface ElectricityBillTransaction {
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

export default function ElectricityBillReport() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const receiptRef = useRef<HTMLDivElement>(null);

  /* -------------------- HELPER: Get Today's Date -------------------- */
  const getTodayDate = () => {
    return new Date().toISOString().split("T")[0];
  };

  const [retailerId, setRetailerId] = useState<string>("");
  const [transactions, setTransactions] = useState<ElectricityBillTransaction[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("");
  const [entriesPerPage, setEntriesPerPage] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);

  // Filter states - start with today's date
  const [startDate, setStartDate] = useState(getTodayDate());
  const [endDate, setEndDate] = useState(getTodayDate());
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [dateError, setDateError] = useState<string>("");
  const [isExporting, setIsExporting] = useState(false);

  // Receipt dialog
  const [selectedTransaction, setSelectedTransaction] =
    useState<ElectricityBillTransaction | null>(null);
  const [isReceiptOpen, setIsReceiptOpen] = useState(false);
  const [retailerProfile, setRetailerProfile] = useState<any>(null);

  // Debounce search term
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 500);

    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Decode token and get retailer ID
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
      const userId = decoded.retailer_id || decoded.user_id || "";
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
    } catch (error) {
      toast({
        title: "Invalid token",
        description: "Please login.",
        variant: "destructive",
      });
      navigate("/login");
    }
  }, [navigate, toast]);

  /* -------------------- DATE VALIDATION -------------------- */

  const validateDates = (): boolean => {
    setDateError("");

    // If no dates are selected, validation passes
    if (!startDate && !endDate) {
      return true;
    }

    const today = new Date(getTodayDate());
    today.setHours(0, 0, 0, 0);

    // Validate start date
    if (startDate) {
      const start = new Date(startDate);
      start.setHours(0, 0, 0, 0);

      if (start > today) {
        setDateError("Start date cannot be in the future");
        toast({
          title: "Invalid Date",
          description: "Start date cannot be in the future.",
          variant: "destructive",
        });
        return false;
      }
    }

    // Validate end date
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(0, 0, 0, 0);

      if (end > today) {
        setDateError("End date cannot be in the future");
        toast({
          title: "Invalid Date",
          description: "End date cannot be in the future.",
          variant: "destructive",
        });
        return false;
      }
    }

    // Validate date range
    if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      start.setHours(0, 0, 0, 0);
      end.setHours(0, 0, 0, 0);

      if (start > end) {
        setDateError("Start date cannot be after end date");
        toast({
          title: "Invalid Date Range",
          description: "Start date cannot be after end date.",
          variant: "destructive",
        });
        return false;
      }

      // Optional: Check if date range is too large (e.g., more than 1 year)
      const daysDifference = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
      if (daysDifference > 365) {
        setDateError("Date range cannot exceed 1 year");
        toast({
          title: "Invalid Date Range",
          description: "Please select a date range within 1 year.",
          variant: "destructive",
        });
        return false;
      }
    }

    return true;
  };

  /* -------------------- HANDLE DATE CHANGES -------------------- */

  const handleStartDateChange = (value: string) => {
    setStartDate(value);
    setDateError("");
    
    // If end date exists and new start date is after it, clear end date
    if (value && endDate) {
      const start = new Date(value);
      const end = new Date(endDate);
      if (start > end) {
        setEndDate("");
      }
    }
  };

  const handleEndDateChange = (value: string) => {
    setEndDate(value);
    setDateError("");
    
    // If start date exists and new end date is before it, clear start date
    if (value && startDate) {
      const start = new Date(startDate);
      const end = new Date(value);
      if (end < start) {
        setStartDate("");
      }
    }
  };

  // Build query params helper
  const buildQueryParams = (params: {
    limit?: number;
    offset?: number;
    start_date?: string;
    end_date?: string;
  }) => {
    const queryParams = new URLSearchParams();

    if (params.limit !== undefined)
      queryParams.append("limit", params.limit.toString());

    if (params.offset !== undefined)
      queryParams.append("offset", params.offset.toString());

    if (params.start_date)
      queryParams.append("start_date", `${params.start_date}T00:00:00`);

    if (params.end_date)
      queryParams.append("end_date", `${params.end_date}T23:59:59`);

    return queryParams.toString();
  };

  // Fetch transactions with query params
  const fetchTransactions = async () => {
    if (!retailerId) return;

    if (!validateDates()) return;

    const token = localStorage.getItem("authToken");
    setLoading(true);

    try {
      const offset = (currentPage - 1) * entriesPerPage;
      const queryString = buildQueryParams({
        limit: entriesPerPage,
        offset: offset,
        start_date: startDate,
        end_date: endDate,
      });

      const response = await axios.get(
        `${import.meta.env.VITE_API_BASE_URL}/bbps/get/electricity/transactions/${retailerId}?${queryString}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (
        response.data?.status === "success" &&
        Array.isArray(response.data.data?.transactions)
      ) {
        const raw: ElectricityBillTransaction[] = response.data.data.transactions || [];
        
        // Client-side date filtering as additional safety
        const filtered = raw.filter((tx) => {
          if (!startDate && !endDate) return true;
          
          const txDate = new Date(tx.created_at);
          const start = startDate ? new Date(`${startDate}T00:00:00`) : null;
          const end = endDate ? new Date(`${endDate}T23:59:59`) : null;
          
          if (start && txDate < start) return false;
          if (end && txDate > end) return false;
          
          return true;
        });

        const normalized = filtered.map((tx) => ({
          ...tx,
          customer_id: String(tx.customer_id ?? ""),
          customer_email: String(tx.customer_email ?? ""),
          operator_name: tx.operator_name ?? "",
          partner_request_id: tx.partner_request_id ?? "",
          transaction_status: tx.transaction_status ?? "",
          amount: tx.amount ?? 0,
          before_balance: tx.before_balance ?? 0,
          after_balance: tx.after_balance ?? 0,
          commision: tx.commision ?? 0,
        }));

        const sortedTransactions = normalized.sort(
          (a: ElectricityBillTransaction, b: ElectricityBillTransaction) =>
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );

        const frontendFiltered = applyFrontendFilters(sortedTransactions);

        setTotalRecords(frontendFiltered.length);

        const paginated = frontendFiltered.slice(
          (currentPage - 1) * entriesPerPage,
          currentPage * entriesPerPage
        );

        setTransactions(paginated);
      } else {
        setTransactions([]);
        setTotalRecords(0);
      }
    } catch (error: any) {
      console.error("Error fetching transactions:", error);
      setTransactions([]);
      setTotalRecords(0);
      toast({
        title: "Error",
        description:
          error.response?.data?.message || "Failed to fetch transactions",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const applyFrontendFilters = (
    data: ElectricityBillTransaction[]
  ) => {
    let filtered = [...data];

    // STATUS FILTER
    if (statusFilter !== "ALL") {
      filtered = filtered.filter(
        (tx) => (tx.transaction_status ?? "").toUpperCase() === statusFilter
      );
    }

    // SEARCH FILTER
    if (searchTerm.trim()) {
      const search = searchTerm.toLowerCase();

      filtered = filtered.filter((tx) =>
        String(tx.customer_id ?? "").toLowerCase().includes(search) ||
        String(tx.customer_email ?? "").toLowerCase().includes(search) ||
        String(tx.operator_name ?? "").toLowerCase().includes(search) ||
        String(tx.partner_request_id ?? "").toLowerCase().includes(search) ||
        String(tx.electricity_bill_transaction_id ?? "").includes(search)
      );
    }

    return filtered;
  };

  // Fetch transactions when filters or pagination changes
  useEffect(() => {
    if (retailerId && validateDates()) {
      fetchTransactions();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [retailerId, currentPage, entriesPerPage, startDate, endDate, statusFilter, debouncedSearchTerm]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, statusFilter]);

  // Clear filters
  const clearFilters = () => {
    setStartDate(getTodayDate());
    setEndDate(getTodayDate());
    setStatusFilter("ALL");
    setSearchTerm("");
    setDateError("");
    setCurrentPage(1);
  };

  // Check if filters are active
  const hasActiveFilters = 
    startDate !== getTodayDate() || 
    endDate !== getTodayDate() || 
    statusFilter !== "ALL" || 
    searchTerm;

  // Export to Excel - fetch all data
  const exportToExcel = async () => {
    if (!retailerId) return;
    if (!validateDates()) return;

    setIsExporting(true);

    try {
      toast({
        title: "Exporting",
        description: "Preparing Excel file...",
      });

      const token = localStorage.getItem("authToken");

      // Backend: date + pagination ONLY
      const queryString = buildQueryParams({
        limit: totalRecords,
        offset: 0,
        start_date: startDate,
        end_date: endDate,
      });

      const response = await axios.get(
        `${import.meta.env.VITE_API_BASE_URL}/bbps/get/electricity/transactions/${retailerId}?${queryString}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      let allData: ElectricityBillTransaction[] =
        response.data?.data?.transactions || [];

      if (allData.length === 0) {
        toast({
          title: "No Data",
          description: "No transactions to export",
          variant: "destructive",
        });
        return;
      }

      /* ---------------- NORMALIZE DATA ---------------- */
      let filteredData = allData.map((tx) => ({
        ...tx,
        customer_id: String(tx.customer_id ?? ""),
        customer_email: String(tx.customer_email ?? ""),
        operator_name: String(tx.operator_name ?? ""),
        transaction_status: String(tx.transaction_status ?? ""),
        amount: Number(tx.amount ?? 0),
        before_balance: Number(tx.before_balance ?? 0),
        after_balance: Number(tx.after_balance ?? 0),
        commision: Number(tx.commision ?? 0),
      }));

      /* ---------------- FRONTEND STATUS FILTER ---------------- */
      if (statusFilter !== "ALL") {
        filteredData = filteredData.filter(
          (tx) => tx.transaction_status.toUpperCase() === statusFilter.toUpperCase()
        );
      }

      /* ---------------- FRONTEND SEARCH FILTER ---------------- */
      if (searchTerm.trim()) {
        const search = searchTerm.toLowerCase();
        filteredData = filteredData.filter((tx) =>
          tx.customer_id.toLowerCase().includes(search) ||
          tx.customer_email.toLowerCase().includes(search) ||
          tx.operator_name.toLowerCase().includes(search) ||
          String(tx.electricity_bill_transaction_id).includes(search)
        );
      }

      if (filteredData.length === 0) {
        toast({
          title: "No Data",
          description: "No matching transactions to export",
          variant: "destructive",
        });
        return;
      }

      /* ---------------- SORT (MATCH TABLE) ---------------- */
      filteredData.sort(
        (a, b) =>
          new Date(b.created_at).getTime() -
          new Date(a.created_at).getTime()
      );

      /* ---------------- EXCEL DATA ---------------- */
      const exportData = filteredData.map((tx, index) => ({
        "S.No": index + 1,
        "Transaction ID": tx.electricity_bill_transaction_id,
        "Date & Time": formatDate(tx.created_at),
        "Customer ID": tx.customer_id,
        "Customer Email": tx.customer_email,
        "Operator": tx.operator_name,
        "Amount (₹)": tx.amount.toFixed(2),
        "Before Balance (₹)": tx.before_balance.toFixed(2),
        "After Balance (₹)": tx.after_balance.toFixed(2),
        "Commission (₹)": tx.commision.toFixed(2),
        "Order ID": tx.order_id || "-",
        "Status": tx.transaction_status,
      }));

      const worksheet = XLSX.utils.json_to_sheet(exportData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Electricity Bill Report");

      worksheet["!cols"] = [
        { wch: 8 },
        { wch: 18 },
        { wch: 22 },
        { wch: 15 },
        { wch: 25 },
        { wch: 20 },
        { wch: 14 },
        { wch: 18 },
        { wch: 18 },
        { wch: 14 },
        { wch: 20 },
        { wch: 14 },
      ];

      XLSX.writeFile(
        workbook,
        `Electricity_Bill_Report_${new Date().toISOString().split("T")[0]}.xlsx`
      );

      toast({
        title: "Success",
        description: `Exported ${filteredData.length} transactions`,
      });
    } catch (error) {
      console.error("Export error:", error);
      toast({
        title: "Export Failed",
        description: "Unable to export transactions",
        variant: "destructive",
      });
    } finally {
      setIsExporting(false);
    }
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return "-";
    try {
      const date = new Date(dateString);
      return date.toLocaleString("en-IN", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      });
    } catch (error) {
      return dateString;
    }
  };

  const formatAmount = (amount: number | string | null | undefined) => {
    const num =
      typeof amount === "number"
        ? amount
        : typeof amount === "string"
        ? parseFloat(amount)
        : 0;

    if (isNaN(num)) return "0.00";

    return num.toLocaleString("en-IN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

const numberToWords = (num: number): string => {
  const a = ['', 'One ', 'Two ', 'Three ', 'Four ', 'Five ', 'Six ', 'Seven ', 'Eight ', 'Nine ', 'Ten ', 'Eleven ', 'Twelve ', 'Thirteen ', 'Fourteen ', 'Fifteen ', 'Sixteen ', 'Seventeen ', 'Eighteen ', 'Nineteen '];
  const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  const convert = (n: number | string): string => {
    n = Math.floor(Number(n));
    if (n < 20) return a[n];
    const s = n.toString();
    return b[parseInt(s[0])] + ' ' + a[parseInt(s[1])];
  };

  if (!num || num === 0) return 'Zero Rupees Only';
  
  let str = '';
  const n = num.toString().split('.');
  
  // Lakhs
  const lakhs = Math.floor(num / 100000);
  if (lakhs > 0) str += convert(lakhs) + 'Lakh ';
  
  // Thousands
  const thousands = Math.floor((num % 100000) / 1000);
  if (thousands > 0) str += convert(thousands) + 'Thousand ';
  
  // Hundreds
  const hundreds = Math.floor((num % 1000) / 100);
  if (hundreds > 0) str += convert(hundreds) + 'Hundred ';
  
  // Rest
  const rest = Math.floor(num % 100);
  if (rest > 0) {
    if (str !== '') str += 'and ';
    str += convert(rest);
  }
  
  return str.trim() + ' Rupees Only';
};

  const getStatusColor = (status: string) => {
    switch (status.toUpperCase()) {
      case "SUCCESS":
      case "COMPLETED":
        return "bg-green-600 text-white";
      case "FAILED":
      case "FAILURE":
        return "bg-red-600 text-white";
      case "PENDING":
      case "PROCESSING":
        return "bg-yellow-600 text-white";
      default:
        return "bg-gray-600 text-white";
    }
  };

  const getStatusColorForReceipt = (status: string) => {
    switch (status.toUpperCase()) {
      case "SUCCESS":
      case "COMPLETED":
        return "text-green-600 bg-green-50 border-green-200";
      case "FAILED":
      case "FAILURE":
        return "text-red-600 bg-red-50 border-red-200";
      case "PENDING":
      case "PROCESSING":
        return "text-yellow-600 bg-yellow-50 border-yellow-200";
      default:
        return "text-gray-600 bg-gray-50 border-gray-200";
    }
  };

  // Pagination
  const totalPages = Math.ceil(totalRecords / entriesPerPage);

  const handleViewReceipt = (transaction: ElectricityBillTransaction) => {
    setSelectedTransaction(transaction);
    setIsReceiptOpen(true);
  };

  const handleDownloadReceipt = async () => {
    if (!receiptRef.current || !selectedTransaction) return;

    try {
      toast({
        title: "Generating PDF",
        description: "Please wait...",
      });

      const canvas = await html2canvas(receiptRef.current, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: "#ffffff",
      });

      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
      });

      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const imgWidth = canvas.width;
      const imgHeight = canvas.height;
      const ratio = Math.min(pdfWidth / imgWidth, pdfHeight / imgHeight);
      const imgX = (pdfWidth - imgWidth * ratio) / 2;
      const imgY = 10;

      pdf.addImage(
        imgData,
        "PNG",
        imgX,
        imgY,
        imgWidth * ratio,
        imgHeight * ratio
      );
      pdf.save(
        `electricity-bill-receipt-${selectedTransaction.electricity_bill_transaction_id}.pdf`
      );

      toast({
        title: "Success",
        description: "Receipt downloaded successfully",
      });
    } catch (error) {
      console.error("Error generating PDF:", error);
      toast({
        title: "Error",
        description: "Failed to download receipt",
        variant: "destructive",
      });
    }
  };

  const handlePrintReceipt = () => {
    if (!receiptRef.current || !selectedTransaction) return;

    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    const data = selectedTransaction;
    const amountInWords = numberToWords(typeof data.amount === 'string' ? parseFloat(data.amount) : data.amount);

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Receipt</title>
          <style>
            body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: #f0f2f5; margin: 0; padding: 40px 0; }
            .action-bar { position: fixed; top: 0; left: 0; right: 0; background: #fff; padding: 10px 40px; border-bottom: 2px solid #ddd; display: flex; gap: 15px; z-index: 100; }
            .btn { padding: 10px 20px; border-radius: 6px; border: none; font-weight: 600; cursor: pointer; transition: all 0.2s; }
            .btn-print { background: #000; color: #fff; }
            .btn-close { background: #eee; color: #333; }
            .receipt-container { width: 210mm; min-height: 148mm; margin: 0 auto; background: #fff; border: 1px solid #000; padding: 15px; color: #000; }
            .header-logo { text-align: center; margin-bottom: 20px; border-bottom: 1px solid #000; padding-bottom: 15px; }
            .header-logo h1 { font-size: 32px; font-weight: 800; letter-spacing: 4px; color: #000; margin: 0; }
            .details-row { display: flex; border-bottom: 1px solid #000; }
            .shop-details { flex: 1; padding: 15px; border-right: 1px solid #000; font-size: 14px; line-height: 1.5; }
            .beneficiary-details { flex: 1.5; }
            .bene-title { font-weight: bold; font-size: 11px; border-bottom: 1px solid #000; padding: 8px 15px; text-transform: uppercase; background: #f9f9f9; }
            .bene-content { padding: 15px; font-size: 14px; line-height: 1.8; }
            .bene-grid { display: grid; grid-template-columns: 140px 1fr; }
            .bene-value { font-weight: bold; }
            table { width: 100%; border-collapse: collapse; margin-top: 0; }
            th { border: 1px solid #000; padding: 8px; font-size: 11px; background: #f0f0f0; text-transform: uppercase; }
            td { border: 1px solid #000; padding: 10px; font-size: 14px; }
            .text-center { text-align: center; }
            .text-right { text-align: right; }
            .totals-row td { font-weight: bold; }
            .amount-words { font-size: 20px; font-weight: bold; text-align: right; padding: 15px 0; }
            .footer-section { margin-top: 15px; display: flex; justify-content: space-between; border-top: 1px solid #000; padding-top: 15px; font-size: 13px; }
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
                <div style="font-weight: bold; font-size: 18px; color: #000; margin-bottom: 5px;">${retailerProfile?.business_name || 'Retailer Shop'}</div>
                <div style="font-size: 14px; margin-bottom: 2px;">Prop: ${retailerProfile?.retailer_name || 'Retailer Name'}</div>
                <div style="font-size: 14px; margin-bottom: 2px;">Mob: ${retailerProfile?.retailer_phone || '-'}</div>
                <div style="font-size: 13px; color: #444;">ID: ${retailerProfile?.retailer_id || '-'}</div>
              </div>
              <div class="beneficiary-details">
                <div class="bene-title">Transaction Detail</div>
                <div class="bene-content">
                  <div class="bene-grid">
                    <span class="bene-label">Customer ID</span>
                    <span class="bene-value">: ${data.customer_id}</span>
                    
                    <span class="bene-label">Operator</span>
                    <span class="bene-value">: ${data.operator_name.toUpperCase()}</span>
                    
                    <span class="bene-label">Email</span>
                    <span class="bene-value">: ${data.customer_email || '-'}</span>
                    
                    <span class="bene-label">Status</span>
                    <span class="bene-value">: ${data.transaction_status.toUpperCase()}</span>
                    
                    <span class="bene-label">Date Time</span>
                    <span class="bene-value">: ${new Date(data.created_at).toLocaleString()}</span>
                  </div>
                </div>
              </div>
            </div>

            <table>
              <thead>
                <tr>
                  <th style="width: 50px;">S.No</th>
                  <th>Description</th>
                  <th>Reference ID</th>
                  <th style="width: 120px;">Amount (Rs.)</th>
                </tr>
              </thead>
              <tbody>
                <tr style="height: 70px;">
                  <td class="text-center" style="vertical-align: top;">1</td>
                  <td style="vertical-align: top;">
                    Electricity Bill Payment ${data.transaction_status.toUpperCase()}.<br/>
                    ID: ${data.electricity_bill_transaction_id}<br/>
                    Order: ${data.order_id || '-'}
                  </td>
                  <td class="text-center" style="vertical-align: top;">${data.partner_request_id || '-'}</td>
                  <td class="text-right" style="vertical-align: top;">${formatAmount(data.amount)}</td>
                </tr>
                <tr class="totals-row">
                  <td colspan="3" class="text-right">GRAND TOTAL</td>
                  <td class="text-right">₹ ${formatAmount(data.amount)}</td>
                </tr>
              </tbody>
            </table>

            <div class="amount-words">${amountInWords}</div>

            <div class="footer-section">
              <div style="line-height: 1.8;">
                Thank you!<br/>
                <strong>Customer Services:</strong>
              </div>
              <div class="shop-footer" style="text-align: right;">
                <div style="font-size: 10px; color: #333; margin-bottom: 2px;">PLATFORM BY</div>
                <div style="font-weight: bold; font-size: 14px; color: #000;">Paybazaar Technologies</div>
                <div style="font-size: 11px; color: #555;">Support: info@paybazaar.in</div>
              </div>
            </div>
          </div>
          <script>
            function doPrint() { window.focus(); window.print(); }
            if (document.readyState === 'complete') { doPrint(); } else { window.onload = doPrint; }
          </script>
        </body>
      </html>
    `);

    printWindow.document.close();
  };

  return (
    <div className="flex min-h-screen w-full bg-gray-50">
      <AppSidebar />

      <div className="flex-1 flex flex-col min-w-0">
        <Header />

        <main className="flex-1 p-6 space-y-6 overflow-auto">
          {/* Header Section */}
          <div className="paybazaar-gradient rounded-lg p-6 text-white shadow-lg">
            <div className="flex items-center justify-between">
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
                  <h1 className="text-2xl font-bold flex items-center gap-2">
                    <Zap className="h-6 w-6" />
                    Electricity Bill Payment Report
                  </h1>
                  <p className="text-white/90 text-sm mt-1">
                    Detailed electricity bill payment transaction reports
                  </p>
                </div>
              </div>
              <div className="flex gap-3">
                <Button
                  onClick={exportToExcel}
                  disabled={isExporting || transactions.length === 0}
                  variant="secondary"
                  className="bg-white/20 hover:bg-white/30 text-white"
                >
                  <FileSpreadsheet className="h-4 w-4 mr-2" />
                  {isExporting ? "Exporting..." : "Export to Excel"}
                </Button>
                <Button
                  onClick={fetchTransactions}
                  disabled={loading}
                  variant="secondary"
                  className="bg-white/20 hover:bg-white/30 text-white"
                >
                  <RefreshCw
                    className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`}
                  />
                  Refresh
                </Button>
              </div>
            </div>
          </div>

          {/* Filter Section */}
          <div className="bg-white rounded-lg shadow p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Filter className="h-5 w-5 text-gray-600" />
                <h2 className="text-lg font-semibold">Filters</h2>
              </div>
              {hasActiveFilters && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={clearFilters}
                  className="text-red-600 hover:bg-red-50"
                >
                  <X className="h-4 w-4 mr-1" />
                  Clear All Filters
                </Button>
              )}
            </div>

            {/* Date Error Alert */}
            {dateError && (
              <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-md">
                <AlertCircle className="h-4 w-4 text-red-600 flex-shrink-0" />
                <p className="text-sm text-red-700 font-medium">{dateError}</p>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {/* Start Date */}
              <div className="space-y-2">
                <Label htmlFor="startDate">Start Date</Label>
                <Input
                  id="startDate"
                  type="date"
                  value={startDate}
                  onChange={(e) => {
                    handleStartDateChange(e.target.value);
                    setCurrentPage(1);
                  }}
                  max={getTodayDate()}
                  className={`h-9 ${dateError && startDate ? "border-red-500" : ""}`}
                />
                {startDate && (
                  <p className="text-xs text-muted-foreground">
                    From: {new Date(startDate).toLocaleDateString("en-IN", {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                    })}
                  </p>
                )}
              </div>

              {/* End Date */}
              <div className="space-y-2">
                <Label htmlFor="endDate">End Date</Label>
                <Input
                  id="endDate"
                  type="date"
                  value={endDate}
                  onChange={(e) => {
                    handleEndDateChange(e.target.value);
                    setCurrentPage(1);
                  }}
                  min={startDate || undefined}
                  max={getTodayDate()}
                  className={`h-9 ${dateError && endDate ? "border-red-500" : ""}`}
                />
                {endDate && (
                  <p className="text-xs text-muted-foreground">
                    To: {new Date(endDate).toLocaleDateString("en-IN", {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                    })}
                  </p>
                )}
              </div>

              {/* Status Filter */}
              <div className="space-y-2">
                <Label>Transaction Status</Label>
                <Select
                  value={statusFilter}
                  onValueChange={(value) => {
                    setStatusFilter(value);
                    setCurrentPage(1);
                  }}
                >
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="All Statuses" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">All Statuses</SelectItem>
                    <SelectItem value="SUCCESS">Success</SelectItem>
                    <SelectItem value="PENDING">Pending</SelectItem>
                    <SelectItem value="FAILED">Failed</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Search */}
              <div className="space-y-2">
                <Label htmlFor="search">Search</Label>
                <Input
                  id="search"
                  type="text"
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
                    setCurrentPage(1);
                  }}
                  placeholder="Customer ID, email, operator..."
                  className="h-9"
                />
                {searchTerm && (
                  <p className="text-xs text-muted-foreground">
                    Searching for: "{searchTerm}"
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Active Filter Status */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <div className="flex items-start gap-2">
              <Calendar className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-medium text-blue-900">
                  Active Filters Applied
                </p>
                <div className="mt-1 flex flex-wrap gap-2 text-xs text-blue-700">
                  <span className="bg-blue-100 px-2 py-1 rounded">
                    Date Range: {new Date(startDate).toLocaleDateString("en-IN", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                    })} - {new Date(endDate).toLocaleDateString("en-IN", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                    })}
                  </span>
                  {statusFilter !== "ALL" && (
                    <span className="bg-blue-100 px-2 py-1 rounded">
                      Status: {statusFilter}
                    </span>
                  )}
                  {searchTerm && (
                    <span className="bg-blue-100 px-2 py-1 rounded">
                      Search: "{searchTerm}"
                    </span>
                  )}
                  {(startDate !== getTodayDate() || endDate !== getTodayDate()) && (
                    <span className="bg-amber-100 text-amber-700 px-2 py-1 rounded">
                      Custom date range selected
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Table Section */}
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="p-4 border-b flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-600">Show</span>
                <Select
                  value={entriesPerPage.toString()}
                  onValueChange={(value) => {
                    setEntriesPerPage(Number(value));
                    setCurrentPage(1);
                  }}
                >
                  <SelectTrigger className="w-20 h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="10">10</SelectItem>
                    <SelectItem value="25">25</SelectItem>
                    <SelectItem value="50">50</SelectItem>
                    <SelectItem value="100">100</SelectItem>
                  </SelectContent>
                </Select>
                <span className="text-sm text-gray-600">entries</span>
              </div>
              <div className="text-sm text-gray-600">
                Showing {totalRecords > 0 ? (currentPage - 1) * entriesPerPage + 1 : 0} to{" "}
                {Math.min(currentPage * entriesPerPage, totalRecords)} of {totalRecords} records
              </div>
            </div>

            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50">
                    <TableHead className="text-center whitespace-nowrap">
                      S.NO
                    </TableHead>
                    <TableHead className="text-center whitespace-nowrap">
                      DATE & TIME
                    </TableHead>
                    <TableHead className="text-center whitespace-nowrap">
                      TRANSACTION ID
                    </TableHead>
                    <TableHead className="text-center whitespace-nowrap">
                      CUSTOMER ID
                    </TableHead>
                    <TableHead className="text-center whitespace-nowrap">
                      EMAIL
                    </TableHead>
                    <TableHead className="text-center whitespace-nowrap">
                      OPERATOR
                    </TableHead>
                    <TableHead className="text-center whitespace-nowrap">
                      AMOUNT (₹)
                    </TableHead>
                    <TableHead className="text-center whitespace-nowrap">
                      BEFORE BAL (₹)
                    </TableHead>
                    <TableHead className="text-center whitespace-nowrap">
                      AFTER BAL (₹)
                    </TableHead>
                    <TableHead className="text-center whitespace-nowrap">
                      COMMISSION (₹)
                    </TableHead>
                    <TableHead className="text-center whitespace-nowrap">
                      STATUS
                    </TableHead>
                    <TableHead className="text-center whitespace-nowrap">
                      ACTION
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={12} className="text-center py-12">
                        <div className="flex flex-col items-center gap-3">
                          <RefreshCw className="h-8 w-8 animate-spin text-gray-400" />
                          <p className="text-gray-500">Loading transactions...</p>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : transactions.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={12} className="text-center py-12">
                        <div className="flex flex-col items-center gap-3">
                          <Zap className="h-12 w-12 text-gray-300" />
                          <p className="text-gray-500 font-medium">
                            {hasActiveFilters
                              ? "No matching transactions found"
                              : "No transactions found"}
                          </p>
                          <p className="text-sm text-gray-400">
                            {hasActiveFilters
                              ? "Try adjusting your filters"
                              : "Your bill payment transactions will appear here"}
                          </p>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    transactions.map((transaction, index) => (
                      <TableRow key={transaction.electricity_bill_transaction_id}>
                        <TableCell className="text-center">
                          {(currentPage - 1) * entriesPerPage + index + 1}
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-center">
                          {formatDate(transaction.created_at)}
                        </TableCell>
                        <TableCell className="font-mono text-xs text-center">
                          {transaction.electricity_bill_transaction_id}
                        </TableCell>
                        <TableCell className="text-center">
                          {transaction.customer_id}
                        </TableCell>
                        <TableCell className="text-center text-xs">
                          {transaction.customer_email}
                        </TableCell>
                        <TableCell className="text-center">
                          {transaction.operator_name}
                        </TableCell>
                        <TableCell className="font-semibold text-center">
                          ₹{formatAmount(transaction.amount)}
                        </TableCell>
                        <TableCell className="text-center font-semibold">
                          ₹{formatAmount(transaction.before_balance)}
                        </TableCell>
                        <TableCell className="text-center font-semibold">
                          ₹{formatAmount(transaction.after_balance)}
                        </TableCell>
                        <TableCell className="text-center font-semibold text-green-600">
                          ₹{formatAmount(transaction.commision)}
                        </TableCell>
                        <TableCell className="text-center">
                          <span
                            className={`px-2 py-1 text-xs rounded-full ${getStatusColor(
                              transaction.transaction_status
                            )}`}
                          >
                            {transaction.transaction_status}
                          </span>
                        </TableCell>
                        <TableCell className="text-center">
                          <Button
                            onClick={() => handleViewReceipt(transaction)}
                            size="sm"
                            variant="outline"
                            className="shadow-sm h-8 px-2"
                          >
                            <ReceiptIcon className="h-4 w-4 mr-1" />
                            Receipt
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>

            {/* Pagination */}
            {totalRecords > 0 && totalPages > 1 && (
              <div className="p-4 border-t flex items-center justify-between">
                <div className="text-sm text-gray-600">
                  Page {currentPage} of {totalPages} ({totalRecords} total
                  records)
                </div>

                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setCurrentPage((prev) => Math.max(1, prev - 1))
                    }
                    disabled={currentPage === 1}
                  >
                    Previous
                  </Button>

                  <div className="flex gap-1">
                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                      let pageNum;
                      if (totalPages <= 5) {
                        pageNum = i + 1;
                      } else if (currentPage <= 3) {
                        pageNum = i + 1;
                      } else if (currentPage >= totalPages - 2) {
                        pageNum = totalPages - 4 + i;
                      } else {
                        pageNum = currentPage - 2 + i;
                      }

                      return (
                        <Button
                          key={pageNum}
                          variant="outline"
                          size="sm"
                          onClick={() => setCurrentPage(pageNum)}
                          className={
                            currentPage === pageNum
                              ? "paybazaar-gradient text-white"
                              : ""
                          }
                        >
                          {pageNum}
                        </Button>
                      );
                    })}
                  </div>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setCurrentPage((prev) => Math.min(totalPages, prev + 1))
                    }
                    disabled={currentPage === totalPages}
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </div>
        </main>
      </div>

      {/* Receipt Dialog */}
      <Dialog open={isReceiptOpen} onOpenChange={setIsReceiptOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Electricity Bill Payment Receipt</DialogTitle>
          </DialogHeader>

          {/* Action Buttons */}
          <div className="flex gap-2 justify-end">
            <Button onClick={handlePrintReceipt} variant="outline" size="sm">
              <Printer className="h-4 w-4 mr-2" />
              Print
            </Button>
            <Button
              onClick={handleDownloadReceipt}
              variant="default"
              size="sm"
              className="paybazaar-gradient"
            >
              <Download className="h-4 w-4 mr-2" />
              Download
            </Button>
          </div>

          {selectedTransaction && (
            <div
              ref={receiptRef}
              className="bg-white p-8 space-y-6 border rounded-lg"
            >
              {/* Header Logo */}
              <div className="text-center border-b border-black pb-3">
                <h2 className="text-3xl font-extrabold tracking-widest text-black">PAYBAZAAR</h2>
                <p className="text-[11px] font-bold text-gray-700 tracking-[0.2em]">— TECHNOLOGIES —</p>
              </div>

              {/* Shop and Transaction Row */}
              <div className="flex border-b border-black -mx-4">
                <div className="flex-1 p-4 border-r border-black text-sm">
                  <p className="font-bold text-lg">{retailerProfile?.business_name || 'Retailer Shop'}</p>
                  <p>{retailerProfile?.retailer_name || 'Retailer Name'}</p>
                  <p>{retailerProfile?.retailer_phone || '-'}</p>
                  <p className="text-xs text-gray-500 mt-1">ID: {retailerProfile?.retailer_id || '-'}</p>
                </div>
                <div className="flex-[1.5]">
                  <div className="bg-gray-50 border-b border-black px-4 py-2 text-[10px] font-bold uppercase">
                    Transaction Detail
                  </div>
                  <div className="p-4 text-sm space-y-2">
                    <div className="grid grid-cols-[120px_1fr]">
                      <span>Customer ID</span>
                      <span className="font-bold">: {selectedTransaction.customer_id}</span>
                      
                      <span>Operator</span>
                      <span className="font-bold">: {selectedTransaction.operator_name.toUpperCase()}</span>
                      
                      <span>Email</span>
                      <span className="font-bold">: {selectedTransaction.customer_email || '-'}</span>
                      
                      <span>Date Time</span>
                      <span className="font-bold">: {formatDate(selectedTransaction.created_at)}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Items Table */}
              <div className="-mx-4">
                <table className="w-full border-collapse">
                  <thead>
                    <tr>
                      <th className="border-y border-black p-2 bg-gray-50 text-[10px] uppercase w-[50px]">S.No</th>
                      <th className="border border-black p-2 bg-gray-50 text-[10px] uppercase text-left">Description</th>
                      <th className="border border-black p-2 bg-gray-50 text-[10px] uppercase">Reference ID</th>
                      <th className="border-y border-black p-2 bg-gray-50 text-[10px] uppercase w-[120px] text-right">Amount (Rs.)</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr style={{ height: '70px' }}>
                      <td className="border-r border-black p-3 text-center align-top">1</td>
                      <td className="border-r border-black p-3 align-top">
                        Electricity Bill Payment SUCCESS.<br/>
                        ID: {selectedTransaction.electricity_bill_transaction_id}
                      </td>
                      <td className="border-r border-black p-3 text-center align-top">
                        {selectedTransaction.partner_request_id || '-'}
                      </td>
                      <td className="p-3 text-right align-top font-bold">
                        {formatAmount(selectedTransaction.amount)}
                      </td>
                    </tr>
                    <tr className="border-t border-black font-bold">
                      <td colSpan={3} className="border-r border-black p-2 text-right">GRAND TOTAL</td>
                      <td className="p-2 text-right">₹ {formatAmount(selectedTransaction.amount)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Amount in Words */}
              <div className="text-right text-lg font-bold py-2">
                {numberToWords(typeof selectedTransaction.amount === "string" ? parseFloat(selectedTransaction.amount) : selectedTransaction.amount)}
              </div>

              {/* Footer */}
              <div className="flex justify-between items-end border-t border-black pt-4">
                <div className="text-xs space-y-1">
                  <p>Thank you!</p>
                  <p className="font-bold">Customer Services:</p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] text-gray-500 uppercase font-semibold">Platform By</p>
                  <p className="font-bold text-lg text-black">Paybazaar Technologies</p>
                  <p className="text-[10px] text-gray-600">www.paybazaar.in</p>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}