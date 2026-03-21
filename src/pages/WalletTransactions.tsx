import { useState, useEffect } from "react";
import axios from "axios";
import { jwtDecode } from "jwt-decode";
import { motion } from "framer-motion";
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
import { AppSidebar } from "@/components/layout/AppSidebar";
import { Header } from "@/components/layout/Header";
import {
  ArrowLeft,
  RefreshCw,
  FileText,
  FileSpreadsheet,
  Calendar,
  Loader2,
  X,
  AlertCircle,
  Filter,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import * as XLSX from "xlsx";

/* -------------------- INTERFACES -------------------- */

interface DecodedToken {
  user_id: string;
  user_name: string;
  exp: number;
  iat: number;
}

interface WalletTransactionRaw {
  wallet_transaction_id: string;
  user_id: string;
  reference_id: string;
  credit_amount?: string;
  debit_amount?: string;
  before_balance: string;
  after_balance: string;
  transaction_reason: string;
  remarks: string;
  created_at: string;
}

interface WalletTransaction {
  id: string;
  type: "CREDIT" | "DEBIT";
  amount: number;
  reason: string;
  remarks: string;
  beforeBalance: number;
  afterBalance: number;
  createdAt: string;
}

interface PaginationMeta {
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}

/* -------------------- COMPONENT -------------------- */

const UserWalletTransactions = () => {
  const { toast } = useToast();
  const navigate = useNavigate();

  /* -------------------- HELPER: Get Today's Date -------------------- */
  const getTodayDate = () => {
    return new Date().toISOString().split("T")[0];
  };

  const [userId, setUserId] = useState<string | null>(null);
  const [allTransactions, setAllTransactions] = useState<WalletTransaction[]>([]); // All fetched data
  const [filteredTransactions, setFilteredTransactions] = useState<WalletTransaction[]>([]); // After filters
  const [loading, setLoading] = useState(true);

  // Filters - Set today's date as default
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "CREDIT" | "DEBIT">("ALL");
  const [startDate, setStartDate] = useState(getTodayDate());
  const [endDate, setEndDate] = useState(getTodayDate());
  const [dateError, setDateError] = useState<string>("");

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [entriesPerPage, setEntriesPerPage] = useState(10);
  const [totalRecords, setTotalRecords] = useState(0);

  // Export state
  const [isExporting, setIsExporting] = useState(false);

  /* -------------------- TOKEN VALIDATION -------------------- */

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
      const decoded = jwtDecode<DecodedToken>(token);

      // Check if token is expired
      if (decoded.exp * 1000 < Date.now()) {
        localStorage.removeItem("authToken");
        toast({
          title: "Session expired",
          description: "Your session has expired. Please login again.",
          variant: "destructive",
        });
        navigate("/login");
        return;
      }

      // Check if user role is retailer
      setUserId(decoded.user_id);
    } catch (error) {
      console.error("Token decode error:", error);
      localStorage.removeItem("authToken");
      toast({
        title: "Invalid session",
        description: "Please login again.",
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

  /* -------------------- CLIENT-SIDE FILTERING -------------------- */

  const applyFilters = (transactions: WalletTransaction[]) => {
    let filtered = [...transactions];

    // 1. Date filtering
    if (startDate || endDate) {
      filtered = filtered.filter((tx) => {
        const txDate = new Date(tx.createdAt);
        const start = startDate ? new Date(`${startDate}T00:00:00`) : null;
        const end = endDate ? new Date(`${endDate}T23:59:59`) : null;
        
        if (start && txDate < start) return false;
        if (end && txDate > end) return false;
        
        return true;
      });
    }

    // 2. Status filtering
    if (statusFilter !== "ALL") {
      filtered = filtered.filter((tx) => tx.type === statusFilter);
    }

    // 3. Search filtering (search in ID, reason, and remarks)
    if (searchTerm.trim()) {
      const search = searchTerm.trim().toLowerCase();
      filtered = filtered.filter((tx) => {
        return (
          tx.id.toLowerCase().includes(search) ||
          tx.reason.toLowerCase().includes(search) ||
          tx.remarks.toLowerCase().includes(search)
        );
      });
    }

    return filtered;
  };

  /* -------------------- FETCH TRANSACTIONS (WITHOUT SEARCH PARAM) -------------------- */

  const fetchTransactions = async () => {
    if (!userId) return;

    if (!validateDates()) return;

    const token = localStorage.getItem("authToken");
    setLoading(true);

    try {
      // Build query params for server-side pagination
      const params = new URLSearchParams({
        limit: entriesPerPage.toString(),
        offset: ((currentPage - 1) * entriesPerPage).toString(),
      });

      // Always send date filters
      if (startDate) {
        params.append("start_date", startDate);
      }

      if (endDate) {
        params.append("end_date", endDate);
      }

      const res = await axios.get(
        import.meta.env.VITE_API_BASE_URL + `/wallet-transaction/user/${userId}?${params.toString()}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const body = res.data;
      let raw: WalletTransactionRaw[] = [];

      if (body.status === "success" || res.status === 200) {
        if (Array.isArray(body?.data?.transactions)) {
          raw = body.data.transactions;
        } else if (Array.isArray(body?.transactions)) {
          raw = body.transactions;
        } else if (Array.isArray(body?.data)) {
          raw = body.data;
        } else if (Array.isArray(body)) {
          raw = body;
        }

        // Handle total records for pagination
        const total = body?.data?.total ?? body?.total ?? raw.length;
        setTotalRecords(total);

        const mapped: WalletTransaction[] = raw.map((tx) => {
          const isCredit = !!tx.credit_amount;

          return {
            id: tx.wallet_transaction_id,
            type: isCredit ? "CREDIT" : "DEBIT",
            amount: parseFloat(tx.credit_amount || tx.debit_amount || "0"),
            reason: tx.transaction_reason,
            remarks: tx.remarks,
            beforeBalance: parseFloat(tx.before_balance),
            afterBalance: parseFloat(tx.after_balance),
            createdAt: tx.created_at,
          };
        });

        setAllTransactions(mapped);
      } else {
        setAllTransactions([]);
        setTotalRecords(0);
      }
    } catch (error: any) {
      console.error("Error fetching wallet transactions:", error);
      toast({
        title: "Error",
        description: error.response?.data?.message || "Unable to fetch transactions",
        variant: "destructive",
      });
      setAllTransactions([]);
      setTotalRecords(0);
    } finally {
      setLoading(false);
    }
  };

  // Apply filters whenever allTransactions, searchTerm, or statusFilter changes
  useEffect(() => {
    const filtered = applyFilters(allTransactions);
    setFilteredTransactions(filtered);
  }, [allTransactions, searchTerm, statusFilter, startDate, endDate]);

  // Reset to first page when filters or search term changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, statusFilter, startDate, endDate]);

  // Fetch when dates, page, or limit changes
  useEffect(() => {
    if (userId && validateDates()) {
      fetchTransactions();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, startDate, endDate, currentPage, entriesPerPage]);

  /* -------------------- CLEAR FILTERS -------------------- */

  const clearAllFilters = () => {
    setSearchTerm("");
    setStatusFilter("ALL");
    setStartDate(getTodayDate());
    setEndDate(getTodayDate());
    setDateError("");
    setCurrentPage(1);
  };

  const hasActiveFilters = 
    searchTerm || 
    statusFilter !== "ALL" || 
    startDate !== getTodayDate() || 
    endDate !== getTodayDate();

  /* -------------------- EXPORT TO EXCEL (FILTERED DATA) -------------------- */

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
      const exportData = filteredTransactions.map((tx, index) => {
        return {
          "S.No": index + 1,
          "Date & Time": formatDateTimeExport(tx.createdAt),
          "Transaction ID": tx.id,
          "Type": tx.type,
          "Reason": tx.reason,
          "Amount (₹)": tx.amount.toFixed(2),
          "Before Balance (₹)": tx.beforeBalance.toFixed(2),
          "After Balance (₹)": tx.afterBalance.toFixed(2),
          "Remarks": tx.remarks,
        };
      });

      const worksheet = XLSX.utils.json_to_sheet(exportData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Wallet Transactions");

      // Set column widths
      worksheet["!cols"] = [
        { wch: 8 },  // S.No
        { wch: 20 }, // Date & Time
        { wch: 20 }, // Transaction ID
        { wch: 12 }, // Type
        { wch: 20 }, // Reason
        { wch: 15 }, // Amount
        { wch: 18 }, // Before Balance
        { wch: 18 }, // After Balance
        { wch: 30 }, // Remarks
      ];

      const fileName = `Wallet_Transactions_${new Date().toISOString().split("T")[0]}.xlsx`;
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

  /* -------------------- HELPERS -------------------- */

  const formatDateTime = (dateString: string) => {
    if (!dateString) return "-";
    try {
      const date = new Date(dateString);
      return (
        <div className="text-center">
          <div className="font-medium text-sm">
            {date.toLocaleDateString("en-IN", {
              year: "numeric",
              month: "short",
              day: "2-digit",
            })}
          </div>
          <div className="text-xs text-muted-foreground">
            {date.toLocaleTimeString("en-IN", {
              hour: "2-digit",
              minute: "2-digit",
              second: "2-digit",
              hour12: true,
            })}
          </div>
        </div>
      );
    } catch {
      return "-";
    }
  };

  const formatDateTimeExport = (dateString: string) => {
    if (!dateString) return "-";
    try {
      return new Date(dateString).toLocaleString("en-IN");
    } catch {
      return "-";
    }
  };

  const getTypeBadge = (type: "CREDIT" | "DEBIT") =>
    type === "CREDIT" ? (
      <span className="px-3 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-700 border border-green-300">
        Credit
      </span>
    ) : (
      <span className="px-3 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-700 border border-red-300">
        Debit
      </span>
    );

  /* -------------------- PAGINATION -------------------- */

  const totalCount = totalRecords;
  const totalPages = Math.ceil(totalCount / entriesPerPage);
  const startIndex = (currentPage - 1) * entriesPerPage;
  // Use filteredTransactions.length for the end index calculation to reflect current page content
  const endIndex = Math.min(startIndex + filteredTransactions.length, totalCount);
  const paginatedTransactions = filteredTransactions;

  /* -------------------- RENDER -------------------- */

  if (loading && !userId) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-background w-full">
      <AppSidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Header />

        <motion.main 
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4 }}
          className="flex-1 overflow-auto bg-muted/20"
        >
          {/* Header Section */}
          <div className="paybazaar-gradient text-white p-6">
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
                  <h1 className="text-2xl font-bold">Wallet Transactions</h1>
                  <p className="text-white/80 text-sm mt-1">
                    View and export your wallet transaction history
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Button
                  onClick={exportToExcel}
                  className="bg-white text-primary hover:bg-white/90 font-semibold"
                  disabled={loading || isExporting || totalCount === 0}
                >
                  <FileSpreadsheet
                    className={`h-4 w-4 mr-2 ${isExporting ? "animate-pulse" : ""}`}
                  />
                  {isExporting ? "Exporting..." : "Export to Excel"}
                </Button>
                <Button
                  onClick={() => fetchTransactions()}
                  className="bg-white text-primary hover:bg-white/90 font-semibold"
                  disabled={loading}
                >
                  <RefreshCw
                    className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`}
                  />
                  Refresh
                </Button>
              </div>
            </div>
          </div>

          {/* Filters Section */}
          <div className="p-6 pb-0">
            <div className="bg-card rounded-lg border border-border shadow-sm p-4 mb-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                    <Filter className="h-4 w-4 text-primary" />
                    Filters
                  </h3>
                  {hasActiveFilters && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={clearAllFilters}
                      className="text-red-600 hover:text-red-700 hover:bg-red-50"
                    >
                      <X className="h-4 w-4 mr-1" />
                      Clear All
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
                    <Label className="text-sm font-medium">Search</Label>
                    <Input
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      placeholder="Search by ID, reason, remarks..."
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
                    <Label className="text-sm font-medium">Status</Label>
                    <Select
                      value={statusFilter}
                      onValueChange={(value: "ALL" | "CREDIT" | "DEBIT") => setStatusFilter(value)}
                    >
                      <SelectTrigger className="h-9">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ALL">All Transactions</SelectItem>
                        <SelectItem value="CREDIT">Credit Only</SelectItem>
                        <SelectItem value="DEBIT">Debit Only</SelectItem>
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
                    <Label className="text-sm font-medium">From Date</Label>
                    <Input
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
                    <Label className="text-sm font-medium">To Date</Label>
                    <Input
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
            </div>

            {/* Active Filter Status */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-6">
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
          </div>

          {/* Table Section */}
          <div className="px-6 pb-6">
            <div className="bg-card rounded-lg border border-border shadow-lg overflow-hidden">
              {/* Table Controls */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between border-b bg-gray-50 px-4 md:px-6 py-4 gap-3">
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium text-gray-700">Show</span>
                  <Select
                    value={entriesPerPage.toString()}
                    onValueChange={(value) => {
                      setEntriesPerPage(Number(value));
                      setCurrentPage(1);
                    }}
                  >
                    <SelectTrigger className="h-9 w-20 bg-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="5">5</SelectItem>
                      <SelectItem value="10">10</SelectItem>
                      <SelectItem value="25">25</SelectItem>
                      <SelectItem value="50">50</SelectItem>
                      <SelectItem value="100">100</SelectItem>
                    </SelectContent>
                  </Select>
                  <span className="text-sm font-medium text-gray-700">entries</span>
                </div>
                <div className="text-sm text-gray-700">
                  Showing {totalCount > 0 ? startIndex + 1 : 0} to {endIndex} of {totalCount} entries
                </div>
              </div>

              {/* Table */}
              <div className="overflow-x-auto">
                {loading ? (
                  <div className="flex flex-col items-center justify-center py-20">
                    <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
                    <p className="text-sm text-muted-foreground">Loading transactions...</p>
                  </div>
                ) : paginatedTransactions.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-20">
                    <FileText className="h-12 w-12 text-muted-foreground mb-4" />
                    <p className="text-lg font-semibold text-gray-900">
                      No transactions found
                    </p>
                    <p className="text-sm text-gray-600">
                      {hasActiveFilters
                        ? "Try adjusting your filters"
                        : "Your transactions will appear here"}
                    </p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-gray-50 hover:bg-gray-50">
                        <TableHead className="text-center text-xs font-semibold uppercase text-gray-700 whitespace-nowrap px-4">
                          S.No
                        </TableHead>
                        <TableHead className="text-center text-xs font-semibold uppercase text-gray-700 whitespace-nowrap px-4">
                          Date & Time
                        </TableHead>
                        <TableHead className="text-center text-xs font-semibold uppercase text-gray-700 whitespace-nowrap px-4">
                          Transaction ID
                        </TableHead>
                        <TableHead className="text-center text-xs font-semibold uppercase text-gray-700 whitespace-nowrap px-4">
                          Type
                        </TableHead>
                        <TableHead className="text-center text-xs font-semibold uppercase text-gray-700 whitespace-nowrap px-4">
                          Reason
                        </TableHead>
                        <TableHead className="text-center text-xs font-semibold uppercase text-gray-700 whitespace-nowrap px-4">
                          Amount (₹)
                        </TableHead>
                        <TableHead className="text-center text-xs font-semibold uppercase text-gray-700 whitespace-nowrap px-4">
                          Before Balance
                        </TableHead>
                        <TableHead className="text-center text-xs font-semibold uppercase text-gray-700 whitespace-nowrap px-4">
                          After Balance
                        </TableHead>
                        <TableHead className="text-center text-xs font-semibold uppercase text-gray-700 whitespace-nowrap px-4">
                          Remarks
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedTransactions.map((tx, idx) => (
                        <TableRow
                          key={tx.id}
                          className={`border-b hover:bg-gray-50 ${
                            idx % 2 === 0 ? "bg-white" : "bg-gray-50/60"
                          }`}
                        >
                          <TableCell className="py-3 px-4 text-center text-sm text-gray-900 whitespace-nowrap">
                            {startIndex + idx + 1}
                          </TableCell>
                          <TableCell className="py-3 px-4 text-center whitespace-nowrap">
                            {formatDateTime(tx.createdAt)}
                          </TableCell>
                          <TableCell className="py-3 px-4 text-center font-mono text-sm text-gray-900 whitespace-nowrap">
                            {tx.id}
                          </TableCell>
                          <TableCell className="py-3 px-4 text-center whitespace-nowrap">
                            {getTypeBadge(tx.type)}
                          </TableCell>
                          <TableCell className="py-3 px-4 text-center text-sm text-gray-900 whitespace-nowrap">
                            {tx.reason}
                          </TableCell>
                          <TableCell
                            className={`py-3 px-4 text-center font-semibold text-sm whitespace-nowrap ${
                              tx.type === "CREDIT" ? "text-green-600" : "text-red-600"
                            }`}
                          >
                            {tx.type === "CREDIT" ? "+" : "-"}₹
                            {tx.amount.toLocaleString("en-IN", {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}
                          </TableCell>
                          <TableCell className="py-3 px-4 text-center text-sm text-gray-900 whitespace-nowrap">
                            ₹
                            {tx.beforeBalance.toLocaleString("en-IN", {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}
                          </TableCell>
                          <TableCell className="py-3 px-4 text-center text-sm text-gray-900 whitespace-nowrap">
                            ₹
                            {tx.afterBalance.toLocaleString("en-IN", {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}
                          </TableCell>
                          <TableCell className="py-3 px-4 text-center text-sm text-gray-600">
                            {tx.remarks}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </div>

              {/* Pagination */}
              {totalCount > 0 && totalPages > 1 && (
                <div className="flex flex-col sm:flex-row items-center justify-between border-t px-4 md:px-6 py-4 gap-3">
                  <div className="text-sm text-gray-600">
                    Page {currentPage} of {totalPages}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                      disabled={currentPage === 1}
                    >
                      Previous
                    </Button>
                    <div className="flex items-center gap-1">
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
                            variant={currentPage === pageNum ? "default" : "outline"}
                            size="sm"
                            onClick={() => setCurrentPage(pageNum)}
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
          </div>
        </motion.main>
      </div>
    </div>
  );
};

export default UserWalletTransactions;