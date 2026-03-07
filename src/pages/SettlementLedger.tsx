import { useState, useEffect, useCallback } from "react";
import axios from "axios";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { RefreshCw, FileSpreadsheet, Filter, Calendar, AlertCircle, X } from "lucide-react";
import * as XLSX from "xlsx";

interface PayoutTransaction {
  payout_transaction_id: string;
  operator_transaction_id: string | null;
  order_id: string;
  partner_request_id: string;
  mobile_number: string;
  bank_name: string;
  beneficiary_name: string;
  account_number: string;
  ifsc_code: string;
  amount: number;
  transfer_type: string;
  retailer_commision: number;
  retailer_id: string;
  retailer_name: string;
  retailer_business_name: string;
  before_balance: number;
  after_balance: number;
  transaction_status: string;
  created_at: string;
}

interface SettlementLedgerProps {
  userId: string;
}

export default function SettlementLedger({ userId }: SettlementLedgerProps) {
  const { toast } = useToast();

  /* -------------------- HELPER: Get Today's Date -------------------- */
  const getTodayDate = () => new Date().toISOString().split("T")[0];

  const [allTransactions, setAllTransactions] = useState<PayoutTransaction[]>([]);
  const [filteredTransactions, setFilteredTransactions] = useState<PayoutTransaction[]>([]);
  const [loading, setLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [entriesPerPage, setEntriesPerPage] = useState(10);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [startDate, setStartDate] = useState(getTodayDate());
  const [endDate, setEndDate] = useState(getTodayDate());
  const [dateError, setDateError] = useState<string>("");

  /* -------------------- CLIENT-SIDE FILTERING -------------------- */

  const applyFilters = useCallback((transactions: PayoutTransaction[]) => {
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

    // 2. Status filtering (FRONTEND ONLY)
    if (statusFilter !== "ALL") {
      filtered = filtered.filter((tx) =>
        (tx.transaction_status ?? "").toUpperCase() === statusFilter.toUpperCase()
      );
    }

    // 3. Search filtering (FRONTEND ONLY)
    if (searchTerm.trim()) {
      const search = searchTerm.trim().toLowerCase();
      filtered = filtered.filter((tx) => {
        return (
          (tx.created_at ?? "").includes(search) ||
          (tx.operator_transaction_id ?? "").toLowerCase().includes(search) ||
          (tx.mobile_number ?? "").includes(search) ||
          (tx.bank_name ?? "").toLowerCase().includes(search) ||
          (tx.beneficiary_name ?? "").toLowerCase().includes(search) ||
          (tx.account_number ?? "").includes(search) ||
          (tx.ifsc_code ?? "").toLowerCase().includes(search) ||
          (tx.order_id ?? "").toLowerCase().includes(search) ||
          (tx.partner_request_id ?? "").toLowerCase().includes(search)
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

    // Always add limit and offset
    if (params.limit !== undefined) {
      queryParams.append("limit", params.limit.toString());
    }
    if (params.offset !== undefined) {
      queryParams.append("offset", params.offset.toString());
    }

    // Add date params with timestamps for proper filtering
    if (params.start_date && params.start_date.trim()) {
      queryParams.append("start_date", `${params.start_date.trim()}T00:00:00`);
    }
    if (params.end_date && params.end_date.trim()) {
      queryParams.append("end_date", `${params.end_date.trim()}T23:59:59`);
    }

    return queryParams.toString();
  }, []);

  // Fetch transactions (NO SEARCH, NO STATUS)
  const fetchTransactions = useCallback(async () => {
    if (!userId) return;

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
        `${import.meta.env.VITE_API_BASE_URL}/payout/get/${userId}?${queryString}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (response.data?.status === "success" && Array.isArray(response.data.data?.transactions)) {
        const raw: PayoutTransaction[] = response.data.data.transactions || [];

        const sorted = raw.sort(
          (a: PayoutTransaction, b: PayoutTransaction) =>
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );

        setAllTransactions(sorted); // Store all data
      } else {
        setAllTransactions([]);
      }
    } catch (error: any) {
      setAllTransactions([]);
      toast({
        title: "Error",
        description: error.response?.data?.message || "Failed to fetch payout transactions",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [userId, startDate, endDate, validateDates, buildQueryParams, toast]);

  // Apply filters whenever allTransactions, searchTerm, or statusFilter changes
  useEffect(() => {
    const filtered = applyFilters(allTransactions);
    setFilteredTransactions(filtered);
    setCurrentPage(1); // Reset to first page when filters change
  }, [allTransactions, applyFilters]);

  // Fetch only when dates change (not search or status)
  useEffect(() => {
    if (userId) {
      fetchTransactions();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, startDate, endDate]);

  const formatDate = (dateString: string) => {
    if (!dateString) return "-";
    try {
      return new Date(dateString).toLocaleString("en-IN", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return dateString;
    }
  };

  const formatAmount = (amount: number | string | null | undefined) => {
    if (amount === null || amount === undefined) return "0.00";
    const num = typeof amount === "string" ? parseFloat(amount) : amount;
    if (isNaN(num)) return "0.00";
    return num.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const getStatusColor = (status?: string) => {
    switch ((status ?? "").toUpperCase()) {
      case "SUCCESS": return "bg-green-600 text-white";
      case "FAILED": case "FAILURE": return "bg-red-600 text-white";
      case "PENDING": return "bg-yellow-600 text-white";
      default: return "bg-gray-600 text-white";
    }
  };

  const getTransferTypeName = (transferType: string) => {
    switch (transferType) {
      case "5":
      case "IMPS":
        return "IMPS";
      case "6":
      case "NEFT":
        return "NEFT";
      default:
        return transferType;
    }
  };

  // Export to Excel - use filtered data
  const exportToExcel = async () => {
    if (filteredTransactions.length === 0) {
      toast({
        title: "No Data",
        description: "No transactions to export",
        variant: "destructive"
      });
      return;
    }

    try {
      const toSafeFixed = (val: number | string | null | undefined) => {
        if (val === null || val === undefined) return "0.00";
        const n = typeof val === "string" ? parseFloat(val) : val;
        return isNaN(n) ? "0.00" : n.toFixed(2);
      };
      const exportData = filteredTransactions.map((tx, i) => ({
        "S.No": i + 1,
        "Transaction ID": tx.operator_transaction_id || "-",
        "Order ID": tx.order_id,
        "Partner Request ID": tx.partner_request_id,
        "Date & Time": formatDate(tx.created_at),
        "Retailer ID": tx.retailer_id,
        "Retailer Name": tx.retailer_name,
        "Business Name": tx.retailer_business_name,
        "Phone": tx.mobile_number,
        "Bank Name": tx.bank_name,
        "Beneficiary": tx.beneficiary_name,
        "Account Number": tx.account_number,
        "IFSC": tx.ifsc_code,
        "Before Balance (₹)": toSafeFixed(tx.before_balance),
        "Amount (₹)": toSafeFixed(tx.amount),
        "After Balance (₹)": toSafeFixed(tx.after_balance),
        "Transfer Type": getTransferTypeName(tx.transfer_type),
        "Commission (₹)": toSafeFixed(tx.retailer_commision),
        Status: tx.transaction_status,
      }));

      const worksheet = XLSX.utils.json_to_sheet(exportData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Settlement");

      // Set column widths
      worksheet["!cols"] = [
        { wch: 8 },  // S.No
        { wch: 25 }, // Transaction ID
        { wch: 20 }, // Order ID
        { wch: 25 }, // Partner Request ID
        { wch: 20 }, // Date & Time
        { wch: 15 }, // Retailer ID
        { wch: 20 }, // Retailer Name
        { wch: 25 }, // Business Name
        { wch: 15 }, // Phone
        { wch: 20 }, // Bank Name
        { wch: 20 }, // Beneficiary
        { wch: 18 }, // Account Number
        { wch: 15 }, // IFSC
        { wch: 15 }, // Before Balance
        { wch: 15 }, // Amount
        { wch: 15 }, // After Balance
        { wch: 15 }, // Transfer Type
        { wch: 12 }, // Commission
        { wch: 12 }, // Status
      ];

      XLSX.writeFile(workbook, `Settlement_${new Date().toISOString().split("T")[0]}.xlsx`);

      toast({
        title: "Success",
        description: `Exported ${exportData.length} transaction${exportData.length > 1 ? 's' : ''}`
      });
    } catch (error) {
      console.error("Export error:", error);
      toast({
        title: "Export Failed",
        description: "Unable to export transactions",
        variant: "destructive",
      });
    }
  };

  const clearFilters = () => {
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

  // Pagination with filtered data
  const totalRecords = filteredTransactions.length;
  const totalPages = Math.ceil(totalRecords / entriesPerPage);
  const startIdx = (currentPage - 1) * entriesPerPage;
  const endIdx = startIdx + entriesPerPage;
  const paginatedTransactions = filteredTransactions.slice(startIdx, endIdx);

  return (
    <>
      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-6 space-y-4 mb-6">
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
            <Label>Search</Label>
            <Input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search transactions..."
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
            <Label>Start Date</Label>
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
            <Label>End Date</Label>
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

      {/* Table */}
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
          <div className="flex items-center gap-3">
            <div className="text-sm text-gray-600">
              Showing {totalRecords > 0 ? startIdx + 1 : 0} to{" "}
              {endIdx > totalRecords ? totalRecords : endIdx} of {totalRecords} records
            </div>
            <Button
              onClick={exportToExcel}
              disabled={filteredTransactions.length === 0}
              variant="outline"
              size="sm"
            >
              <FileSpreadsheet className="h-4 w-4 mr-2" />
              Export
            </Button>
            <Button
              onClick={fetchTransactions}
              disabled={loading}
              variant="outline"
              size="sm"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50">
                <TableHead className="text-center whitespace-nowrap">S.NO</TableHead>
                <TableHead className="text-center whitespace-nowrap">DATE & TIME</TableHead>
                <TableHead className="text-center whitespace-nowrap">TRANSACTION ID</TableHead>
                <TableHead className="text-center whitespace-nowrap">PHONE</TableHead>
                <TableHead className="text-center whitespace-nowrap">BANK NAME</TableHead>
                <TableHead className="text-center whitespace-nowrap">BENEFICIARY</TableHead>
                <TableHead className="text-center whitespace-nowrap">ACCOUNT NO.</TableHead>
                <TableHead className="text-center whitespace-nowrap">AMOUNT (₹)</TableHead>
                <TableHead className="text-center whitespace-nowrap">BEFORE BAL (₹)</TableHead>
                <TableHead className="text-center whitespace-nowrap">AFTER BAL (₹)</TableHead>
                <TableHead className="text-center whitespace-nowrap">TYPE</TableHead>
                <TableHead className="text-center whitespace-nowrap">COMMISSION (₹)</TableHead>
                <TableHead className="text-center whitespace-nowrap">STATUS</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={12} className="text-center py-12">
                    <RefreshCw className="h-8 w-8 animate-spin text-gray-400 mx-auto mb-2" />
                    <p className="text-gray-500">Loading transactions...</p>
                  </TableCell>
                </TableRow>
              ) : paginatedTransactions.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={12} className="text-center py-12">
                    <p className="text-gray-500 font-medium">No transactions found</p>
                    <p className="text-sm text-gray-400">
                      {hasActiveFilters
                        ? "Try adjusting your filters"
                        : "Your settlement transactions will appear here"}
                    </p>
                  </TableCell>
                </TableRow>
              ) : (
                paginatedTransactions.map((transaction, index) => (
                  <TableRow key={transaction.payout_transaction_id} className="hover:bg-gray-50">
                    <TableCell className="text-center whitespace-nowrap">
                      {startIdx + index + 1}
                    </TableCell>

                    <TableCell className="text-center whitespace-nowrap">
                      {formatDate(transaction.created_at)}
                    </TableCell>
                    <TableCell className="text-center font-mono text-xs">
                      {transaction.operator_transaction_id || "-"}
                    </TableCell>
                    <TableCell className="text-center">{transaction.mobile_number}</TableCell>
                    <TableCell className="text-center">{transaction.bank_name}</TableCell>
                    <TableCell className="text-center">{transaction.beneficiary_name}</TableCell>
                    <TableCell className="text-center font-mono text-xs">
                      {transaction.account_number}
                    </TableCell>
                    <TableCell className="text-center font-semibold">
                      ₹{formatAmount(transaction.amount)}
                    </TableCell>
                    <TableCell className="text-center font-semibold">
                      ₹{formatAmount(transaction.before_balance)}
                    </TableCell>
                    <TableCell className="text-center font-semibold">
                      ₹{formatAmount(transaction.after_balance)}
                    </TableCell>
                    <TableCell className="text-center">
                      <span className="px-2 py-1 text-xs rounded-full bg-blue-100 text-blue-700">
                        {getTransferTypeName(transaction.transfer_type)}
                      </span>
                    </TableCell>
                    <TableCell className="text-center font-semibold text-green-600">
                      ₹{formatAmount(transaction.retailer_commision || 0)}
                    </TableCell>
                    <TableCell className="text-center">
                      <span className={`px-2 py-1 text-xs rounded-full ${getStatusColor(transaction.transaction_status)}`}>
                        {transaction.transaction_status}
                      </span>
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
              Page {currentPage} of {totalPages} ({totalRecords} total records)
            </div>

            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
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
                      className={currentPage === pageNum ? "paybazaar-gradient text-white" : ""}
                    >
                      {pageNum}
                    </Button>
                  );
                })}
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}