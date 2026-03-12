import { useState, useEffect, useRef, useCallback } from "react";
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
  Smartphone,
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

interface MobileRechargeTransaction {
  mobile_recharge_transaction_id: number;
  retailer_id: string;
  mobile_number: string;
  operator_code: number;
  operator_name: string;
  circle_code: number;
  circle_name: string;
  amount: number;
  before_balance: number;
  after_balance: number;
  commision: number;
  recharge_type: string;
  status: string;
  partner_request_id: string;
  created_at: string;
}

export default function MobileRechargeReport() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const receiptRef = useRef<HTMLDivElement>(null);

  /* -------------------- HELPER: Get Today's Date -------------------- */
  const getTodayDate = () => {
    return new Date().toISOString().split("T")[0];
  };

  const [retailerId, setRetailerId] = useState<string>("");
  const [allTransactions, setAllTransactions] = useState<MobileRechargeTransaction[]>([]);
  const [filteredTransactions, setFilteredTransactions] = useState<MobileRechargeTransaction[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [entriesPerPage, setEntriesPerPage] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);

  // Filter states - start with today's date
  const [startDate, setStartDate] = useState(getTodayDate());
  const [endDate, setEndDate] = useState(getTodayDate());
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [dateError, setDateError] = useState<string>("");
  const [isExporting, setIsExporting] = useState(false);

  // Receipt dialog
  const [selectedTransaction, setSelectedTransaction] =
    useState<MobileRechargeTransaction | null>(null);
  const [isReceiptOpen, setIsReceiptOpen] = useState(false);

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
    } catch (error) {
      toast({
        title: "Invalid token",
        description: "Please login.",
        variant: "destructive",
      });
      navigate("/login");
    }
  }, [navigate, toast]);

  /* -------------------- CLIENT-SIDE FILTERING -------------------- */

  const applyFilters = useCallback((transactions: MobileRechargeTransaction[]) => {
    let filtered = [...transactions];

    // 1. Date filtering (already done by backend, but keep for safety)
    if (startDate || endDate) {
      filtered = filtered.filter((tx) => {
        const txDate = new Date(tx.created_at);
        const start = startDate ? new Date(`${startDate}T00:00:00`) : null;
        const end = endDate ? new Date(`${endDate}T23:59:59`) : null;
        
        if (start && txDate < start) return false;
        if (end && txDate > end) return false;
        
        return true;
      });
    }

  // Status filter
if (statusFilter !== "ALL") {
  filtered = filtered.filter(
    (tx) => (tx.status ?? "").toUpperCase() === statusFilter
  );
}

// Search filter
if (searchTerm.trim()) {
  const search = searchTerm.trim().toLowerCase();

  filtered = filtered.filter((tx) => {
    return (
      String(tx.mobile_number ?? "").toLowerCase().includes(search) ||
      String(tx.operator_name ?? "").toLowerCase().includes(search) ||
      String(tx.circle_name ?? "").toLowerCase().includes(search) ||
      String(tx.mobile_recharge_transaction_id ?? "").includes(search) ||
      String(tx.partner_request_id ?? "").toLowerCase().includes(search)
    );
  });
}



    return filtered;
  }, [startDate, endDate, statusFilter, searchTerm]);

  /* -------------------- DATE VALIDATION -------------------- */

  const validateDates = useCallback((): boolean => {
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
  }, [startDate, endDate, toast]);

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

  // Build query params helper - only add params that have values (NO SEARCH, NO STATUS)
  const buildQueryParams = useCallback((params: {
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
  }, []);

  // Fetch transactions with query params (NO SEARCH, NO STATUS)
  const fetchTransactions = useCallback(async () => {
    if (!retailerId) return;
    if (!validateDates()) return;

    const token = localStorage.getItem("authToken");
    setLoading(true);

    try {
      // Build query params - REMOVE search and status
      const queryString = buildQueryParams({
        limit: 10000, // Fetch large number to get all data
        offset: 0,
        start_date: startDate,
        end_date: endDate,
      });

      const response = await axios.get(
        `${import.meta.env.VITE_API_BASE_URL}/mobile_recharge/get/${retailerId}?${queryString}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (
        response.data?.status === "success" &&
        Array.isArray(response.data.data?.recharges)
      ) {
        const raw: MobileRechargeTransaction[] = response.data.data.recharges || [];
        
        const sortedTransactions = raw.sort(
          (a: MobileRechargeTransaction, b: MobileRechargeTransaction) =>
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );

        setAllTransactions(sortedTransactions); // Store all data
      } else {
        setAllTransactions([]);
      }
    } catch (error: any) {
      console.error("Error fetching transactions:", error);
      setAllTransactions([]);
      toast({
        title: "Error",
        description:
          error.response?.data?.message || "Failed to fetch transactions",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [retailerId, startDate, endDate, validateDates, buildQueryParams, toast]);

  // Apply filters whenever allTransactions, searchTerm, or statusFilter changes
  useEffect(() => {
    const filtered = applyFilters(allTransactions);
    setFilteredTransactions(filtered);
    setCurrentPage(1); // Reset to first page when filters change
  }, [allTransactions, applyFilters]);

  // Fetch only when dates change (not search or status)
  useEffect(() => {
    if (retailerId) {
      fetchTransactions();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [retailerId, startDate, endDate]);

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

  // Export to Excel - use filtered data
  const exportToExcel = async () => {
    if (filteredTransactions.length === 0) {
      toast({
        title: "No Data",
        description: "No transactions to export",
        variant: "destructive",
      });
      return;
    }

    setIsExporting(true);

    try {
      const exportData = filteredTransactions.map((tx, index) => ({
        "S.No": index + 1,
        "Transaction ID": tx.mobile_recharge_transaction_id,
        "Date & Time": formatDate(tx.created_at),
        "Mobile Number": tx.mobile_number,
        Operator: tx.operator_name,
        Circle: tx.circle_name,
        "Amount (₹)": tx.amount.toFixed(2),
        "Before Balance (₹)": tx.before_balance.toFixed(2),
        "After Balance (₹)": tx.after_balance.toFixed(2),
        "Commission (₹)": tx.commision.toFixed(2),
        "Recharge Type": tx.recharge_type === "1" ? "Prepaid" : "Postpaid",
        Status: tx.status,
      }));

      const worksheet = XLSX.utils.json_to_sheet(exportData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Mobile Recharge Report");

      const colWidths = [
        { wch: 8 },
        { wch: 15 },
        { wch: 20 },
        { wch: 15 },
        { wch: 20 },
        { wch: 20 },
        { wch: 12 },
        { wch: 15 },
        { wch: 15 },
        { wch: 12 },
        { wch: 15 },
        { wch: 12 },
      ];
      worksheet["!cols"] = colWidths;

      const fileName = `Mobile_Recharge_Report_${
        new Date().toISOString().split("T")[0]
      }.xlsx`;
      XLSX.writeFile(workbook, fileName);

      toast({
        title: "Success",
        description: `Exported ${exportData.length} transaction${exportData.length > 1 ? 's' : ''}`,
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

const formatDate = (dateString?: string | null) => {
  if (!dateString) return "-";
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return "-";

  return date.toLocaleString("en-IN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
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

  const getStatusColor = (status: string) => {
    switch (status.toUpperCase()) {
      case "SUCCESS":
        return "bg-green-600 text-white";
      case "FAILED":
      case "FAILURE":
        return "bg-red-600 text-white";
      case "PENDING":
        return "bg-yellow-600 text-white";
      default:
        return "bg-gray-600 text-white";
    }
  };

  const getStatusColorForReceipt = (status: string) => {
    switch (status.toUpperCase()) {
      case "SUCCESS":
        return "text-green-600 bg-green-50 border-green-200";
      case "FAILED":
      case "FAILURE":
        return "text-red-600 bg-red-50 border-red-200";
      case "PENDING":
        return "text-yellow-600 bg-yellow-50 border-yellow-200";
      default:
        return "text-gray-600 bg-gray-50 border-gray-200";
    }
  };

  // Pagination with filtered data
  const totalRecords = filteredTransactions.length;
  const totalPages = Math.ceil(totalRecords / entriesPerPage);
  const startIdx = (currentPage - 1) * entriesPerPage;
  const endIdx = startIdx + entriesPerPage;
  const paginatedTransactions = filteredTransactions.slice(startIdx, endIdx);

  const handleViewReceipt = (transaction: MobileRechargeTransaction) => {
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
        `mobile-recharge-receipt-${selectedTransaction.mobile_recharge_transaction_id}.pdf`
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
    if (!receiptRef.current) return;

    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    const receiptHTML = receiptRef.current.outerHTML;

    printWindow.document.open();
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Receipt</title>
          <script src="https://cdn.tailwindcss.com"></script>
          <style>
            body {
              background: white;
              margin: 0;
              padding: 20px;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }
            @page {
              size: A4;
              margin: 15mm;
            }
            @media print {
              body {
                margin: 0;
              }
            }
          </style>
        </head>
        <body>
          ${receiptHTML}
          <script>
            window.onload = () => {
              window.focus();
              window.print();
              window.close();
            };
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
                    <Smartphone className="h-6 w-6" />
                    Mobile Recharge Report
                  </h1>
                  <p className="text-white/90 text-sm mt-1">
                    Detailed mobile recharge transaction reports
                  </p>
                </div>
              </div>
              <div className="flex gap-3">
                <Button
                  onClick={exportToExcel}
                  disabled={isExporting || filteredTransactions.length === 0}
                  variant="secondary"
                  className="bg-white/20 hover:bg-white/30 text-white"
                >
                  <FileSpreadsheet className={`h-4 w-4 mr-2 ${isExporting ? "animate-pulse" : ""}`} />
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
              {/* Search */}
              <div className="space-y-2">
                <Label htmlFor="search">Search</Label>
                <Input
                  id="search"
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Mobile, operator, circle..."
                  className="h-9"
                />
                {searchTerm && (
                  <p className="text-xs text-muted-foreground">
                    Searching for: "{searchTerm}"
                  </p>
                )}
              </div>

              {/* Status Filter */}
              <div className="space-y-2">
                <Label>Transaction Status</Label>
                <Select
                  value={statusFilter}
                  onValueChange={setStatusFilter}
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
                {statusFilter !== "ALL" && (
                  <p className="text-xs text-muted-foreground">
                    Showing: {statusFilter} transactions
                  </p>
                )}
              </div>

              {/* Start Date */}
              <div className="space-y-2">
                <Label htmlFor="startDate">Start Date</Label>
                <Input
                  id="startDate"
                  type="date"
                  value={startDate}
                  onChange={(e) => handleStartDateChange(e.target.value)}
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
                  onChange={(e) => handleEndDateChange(e.target.value)}
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
                    <span className="bg-green-100 text-green-700 px-2 py-1 rounded">
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
                Showing {totalRecords > 0 ? startIdx + 1 : 0} to{" "}
                {endIdx > totalRecords ? totalRecords : endIdx} of {totalRecords} records
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
                      MOBILE NUMBER
                    </TableHead>
                    <TableHead className="text-center whitespace-nowrap">
                      OPERATOR
                    </TableHead>
                    <TableHead className="text-center whitespace-nowrap">
                      CIRCLE
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
                      TYPE
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
                      <TableCell colSpan={13} className="text-center py-12">
                        <div className="flex flex-col items-center gap-3">
                          <RefreshCw className="h-8 w-8 animate-spin text-gray-400" />
                          <p className="text-gray-500">Loading transactions...</p>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : paginatedTransactions.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={13} className="text-center py-12">
                        <div className="flex flex-col items-center gap-3">
                          <Smartphone className="h-12 w-12 text-gray-300" />
                          <p className="text-gray-500 font-medium">
                            {hasActiveFilters
                              ? "No matching transactions found"
                              : "No transactions found"}
                          </p>
                          <p className="text-sm text-gray-400">
                            {hasActiveFilters
                              ? "Try adjusting your filters"
                              : "Your recharge transactions will appear here"}
                          </p>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    paginatedTransactions.map((transaction, index) => (
                      <TableRow
                        key={transaction.mobile_recharge_transaction_id}
                      >
                        <TableCell className="text-center">
                          {startIdx + index + 1}
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-center">
                          {formatDate(transaction.created_at)}
                        </TableCell>
                        <TableCell className="font-mono text-xs text-center">
                          {transaction.mobile_recharge_transaction_id}
                        </TableCell>
                        <TableCell className="text-center">
                          {transaction.mobile_number}
                        </TableCell>
                        <TableCell className="text-center">
                          {transaction.operator_name}
                        </TableCell>
                        <TableCell className="text-center">
                          {transaction.circle_name}
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
                          <span className="px-2 py-1 text-xs rounded-full bg-blue-100 text-blue-700">
                            {transaction.recharge_type === "1"
                              ? "Prepaid"
                              : "Postpaid"}
                          </span>
                        </TableCell>
                        <TableCell className="text-center">
                          <span
                            className={`px-2 py-1 text-xs rounded-full ${getStatusColor(
                              transaction.status
                            )}`}
                          >
                            {transaction.status}
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
            <DialogTitle>Mobile Recharge Receipt</DialogTitle>
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
              {/* Header */}
              <div className="text-center border-b pb-6">
                <h2 className="text-2xl font-bold text-gray-800">
                  MOBILE RECHARGE RECEIPT
                </h2>
                <p className="text-sm text-black font-bold">
                  Paybazaar Technologies Pvt. Ltd.
                </p>
              </div>

              {/* Transaction Status */}
              <div className="space-y-3">
                <div className="text-center">
                  <p className="text-xs text-black mb-1">UTR Number</p>
                  <p className="font-mono text-sm font-semibold">
                    {selectedTransaction.mobile_recharge_transaction_id}
                  </p>
                </div>

                <div
                  className={`text-center py-3 rounded-lg border-2 ${getStatusColorForReceipt(
                    selectedTransaction.status
                  )}`}
                >
                  <p className="font-bold text-lg uppercase">
                    {selectedTransaction.status}
                  </p>
                </div>
              </div>

              {/* Transaction Details */}
              <div className="space-y-4">
                <h3 className="font-semibold text-black pb-2 border-b">
                  Transaction Details
                </h3>

                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-black">Date & Time</p>
                    <p className="font-medium">
                      {formatDate(selectedTransaction.created_at)}
                    </p>
                  </div>

                  <div>
                    <p className="text-black">Mobile Number</p>
                    <p className="font-medium font-mono">
                      {selectedTransaction.mobile_number}
                    </p>
                  </div>

                  <div>
                    <p className="text-black">Operator</p>
                    <p className="font-medium">
                      {selectedTransaction.operator_name}
                    </p>
                  </div>

                  <div>
                    <p className="text-black">Circle</p>
                    <p className="font-medium">
                      {selectedTransaction.circle_name}
                    </p>
                  </div>

                  <div>
                    <p className="text-black">Recharge Type</p>
                    <p className="font-medium">
                      {selectedTransaction.recharge_type === "1"
                        ? "Prepaid"
                        : "Postpaid"}
                    </p>
                  </div>

                  <div>
                    <p className="text-black">Partner Request ID</p>
                    <p className="font-medium font-mono text-xs">
                      {selectedTransaction.partner_request_id}
                    </p>
                  </div>
                </div>
              </div>

              {/* Amount Details */}
              <div className="space-y-4">
                <h3 className="font-semibold text-black pb-2 border-b">
                  Amount Details
                </h3>

                <div className="space-y-3">
                  <div className="flex justify-between items-center py-2 border-b">
                    <span className="text-black font-medium">
                      Recharge Amount
                    </span>
                    <span className="font-bold text-2xl text-black">
                      ₹{formatAmount(selectedTransaction.amount)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="border-t pt-6 text-center space-y-2">
                <p className="text-xs text-gray-500">
                  This is a computer-generated receipt and does not require a
                  signature.
                </p>
                <p className="text-xs text-gray-500">
                  For any technical queries, contact{" "}
                  <a
                    href="https://www.gvinfotech.org"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 underline hover:text-blue-800"
                  >
                    www.gvinfotech.org
                  </a>{" "}
                  or{" "}
                  <a
                    href="https://www.paybazaar.in"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 underline hover:text-blue-800"
                  >
                    www.paybazaar.in
                  </a>
                </p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}