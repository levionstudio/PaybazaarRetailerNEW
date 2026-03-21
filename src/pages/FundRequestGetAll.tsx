import { useState, useEffect } from "react";
import axios from "axios";
import { jwtDecode } from "jwt-decode";
import { motion, AnimatePresence } from "framer-motion";
import { AppSidebar } from "@/components/layout/AppSidebar";
import { Header } from "@/components/layout/Header";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ArrowLeft,
  RefreshCw,
  FileText,
  FileSpreadsheet,
  Calendar,
  Filter,
  Loader2,
  X,
  AlertCircle,
} from "lucide-react";
import * as XLSX from "xlsx";

/* -------------------- INTERFACES -------------------- */

interface DecodedToken {
  user_id: string;
  user_name: string;
  exp: number;
  iat: number;
}

interface FundRequestRaw {
  fund_request_id: number;
  requester_id: string;
  request_to_id: string;
  amount: number;
  bank_name: string | null;
  request_date: string;
  utr_number: string | null;
  request_type: string;
  request_status: string;
  remarks: string;
  admin_remarks?: string;
  reject_remarks: string;
  created_at: string;
  updated_at: string;
}

interface FundRequest {
  id: number;
  requesterId: string;
  requestToId: string;
  amount: number;
  bankName: string | null;
  requestDate: string;
  utrNumber: string | null;
  requestType: string;
  status: string;
  remarks: string;
  rejectRemarks: string;
  adminRemarks?: string;
  createdAt: string;
  updatedAt: string;
}

/* -------------------- COMPONENT -------------------- */
const getRequestTypeLabel = (type: string) => {
  switch (type?.toUpperCase()) {
    case "NORMAL":
      return "Bank Transfer";
    case "ADVANCE":
      return "Advance Credit";
    default:
      return type || "-";
  }
};

const GetFundRequests = () => {
  const { toast } = useToast();
  const navigate = useNavigate();

  /* -------------------- HELPER: Get Today's Date -------------------- */
  const getTodayDate = () => {
    return new Date().toISOString().split("T")[0];
  };

  const [userId, setUserId] = useState<string | null>(null);
  const [fundRequests, setFundRequests] = useState<FundRequest[]>([]);
  const [loading, setLoading] = useState(true);

  // Filter states - Initialize with today's date
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("");
  const [entriesPerPage, setEntriesPerPage] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const [startDate, setStartDate] = useState(getTodayDate());
  const [endDate, setEndDate] = useState(getTodayDate());
  const [statusFilter, setStatusFilter] = useState("");
  const [dateError, setDateError] = useState<string>("");
  const [isExporting, setIsExporting] = useState(false);
  const [totalRecords, setTotalRecords] = useState(0);

  // Debounce search term
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 500);

    return () => clearTimeout(timer);
  }, [searchTerm]);

  /* -------------------- TOKEN VALIDATION -------------------- */

  useEffect(() => {
    const checkAuth = () => {
      const token = localStorage.getItem("authToken");

      if (!token) {
        toast({
          title: "Authentication Required",
          description: "Please log in to access this page.",
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
            title: "Session Expired",
            description: "Your session has expired. Please log in again.",
            variant: "destructive",
          });
          navigate("/login");
          return;
        }

        // Check if user role is retailer
        setUserId(decoded.user_id);
      } catch (err) {
        console.error("Token decode error:", err);
        localStorage.removeItem("authToken");
        toast({
          title: "Authentication Error",
          description: "Invalid session. Please log in again.",
          variant: "destructive",
        });
        navigate("/login");
      }
    };

    checkAuth();
  }, [toast, navigate]);

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

  /* -------------------- FETCH FUND REQUESTS -------------------- */

  const fetchRequests = async () => {
    if (!userId) return;

    if (!validateDates()) return;

    const token = localStorage.getItem("authToken");
    if (!token) return;

    try {
      setLoading(true);

      // Pagination parameters
      const limit = entriesPerPage;
      const offset = (currentPage - 1) * entriesPerPage;

      // Build query parameters
      const params = new URLSearchParams();
      params.append("limit", limit.toString());
      params.append("offset", offset.toString());

      if (startDate) {
        params.append("start_date", startDate);
      }
      if (endDate) {
        params.append("end_date", endDate);
      }

      const finalUrl = `${import.meta.env.VITE_API_BASE_URL}/fund-request/requester/${userId}?${params.toString()}`;
      console.log("Fetching fund requests from URL:", finalUrl);

      const { data } = await axios.get(finalUrl, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      console.log("Fund requests list response:", data);

      if (data.status === "success" || data.fund_requests) {
        const raw: FundRequestRaw[] = data.fund_requests || data.data?.fund_requests || [];

        // Client-side filtering (Status and Search only)
        let processed = raw;

        if (statusFilter && statusFilter !== "") {
          processed = processed.filter(
            (req) => req.request_status.toUpperCase() === statusFilter.toUpperCase()
          );
        }

        if (debouncedSearchTerm && debouncedSearchTerm.trim()) {
          const searchLower = debouncedSearchTerm.toLowerCase().trim();
          processed = processed.filter((req) => 
            (req.utr_number && req.utr_number.toLowerCase().includes(searchLower)) ||
            (req.bank_name && req.bank_name.toLowerCase().includes(searchLower)) ||
            (req.remarks && req.remarks.toLowerCase().includes(searchLower)) ||
            (req.admin_remarks && req.admin_remarks.toLowerCase().includes(searchLower)) ||
            (req.request_status && req.request_status.toLowerCase().includes(searchLower)) ||
            req.amount.toString().includes(searchLower) ||
            (req.request_type && req.request_type.toLowerCase().includes(searchLower))
          );
        }

        const mapped: FundRequest[] = processed.map((req) => ({
          id: req.fund_request_id,
          requesterId: req.requester_id,
          requestToId: req.request_to_id,
          amount: req.amount,
          bankName: req.bank_name,
          requestDate: req.request_date,
          utrNumber: req.utr_number,
          requestType: req.request_type,
          status: req.request_status,
          remarks: req.remarks,
          adminRemarks: req.admin_remarks,
          rejectRemarks: req.reject_remarks,
          createdAt: req.created_at,
          updatedAt: req.updated_at,
        }));

        setFundRequests(mapped);

        // If backend returns total records, use it. Otherwise use the length for now.
        setTotalRecords(data.total_count || data.total || (mapped.length > 0 ? mapped.length + offset : 0));
      } else {
        setFundRequests([]);
        setTotalRecords(0);
      }
    } catch (err: any) {
      console.error("Fetch request error:", err);
      setFundRequests([]);
      setTotalRecords(0);
      toast({
        title: "Error",
        description:
          err.response?.data?.message || "Failed to fetch fund requests.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (userId && validateDates()) {
      fetchRequests();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, currentPage, entriesPerPage, startDate, endDate, statusFilter, debouncedSearchTerm]);

  /* -------------------- CLEAR FILTERS -------------------- */

  const clearFilters = () => {
    const today = getTodayDate();
    setStartDate(today);
    setEndDate(today);
    setStatusFilter("");
    setSearchTerm("");
    setDateError("");
    setCurrentPage(1);
  };

  const hasActiveFilters =
    searchTerm ||
    statusFilter ||
    startDate !== getTodayDate() ||
    endDate !== getTodayDate();

  /* -------------------- EXPORT TO EXCEL -------------------- */

  const exportToExcel = async () => {
    if (!userId) return;

    if (totalRecords === 0) {
      toast({
        title: "No Data",
        description: "No fund requests to export",
        variant: "destructive",
      });
      return;
    }

    if (!validateDates()) return;

    setIsExporting(true);

    try {
      toast({
        title: "Exporting",
        description: "Fetching all data for export...",
      });

      const token = localStorage.getItem("authToken");
      if (!token) return;

      // Build query parameters
      const params = new URLSearchParams();
      params.append("limit", "10000"); // Fetch a large batch for export
      params.append("offset", "0");

      if (startDate) {
        params.append("start_date", startDate);
      }
      if (endDate) {
        params.append("end_date", endDate);
      }

      const { data } = await axios.get(
        `${import.meta.env.VITE_API_BASE_URL}/fund-request/requester/${userId}?${params.toString()}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      let allData: FundRequestRaw[] = data.fund_requests || data.data?.fund_requests || [];

      // Apply search/status filtering if present
      if (statusFilter && statusFilter !== "") {
        allData = allData.filter(
          (req) => req.request_status.toUpperCase() === statusFilter.toUpperCase()
        );
      }

      if (debouncedSearchTerm && debouncedSearchTerm.trim()) {
        const searchLower = debouncedSearchTerm.toLowerCase().trim();
        allData = allData.filter((req) =>
          (req.utr_number && req.utr_number.toLowerCase().includes(searchLower)) ||
          (req.bank_name && req.bank_name.toLowerCase().includes(searchLower)) ||
          req.remarks.toLowerCase().includes(searchLower) ||
          (req.admin_remarks && req.admin_remarks.toLowerCase().includes(searchLower)) ||
          req.request_status.toLowerCase().includes(searchLower) ||
          req.amount.toString().includes(searchLower) ||
          req.request_type.toLowerCase().includes(searchLower)
        );
      }

      if (allData.length === 0) {
        toast({
          title: "No Data",
          description: "No fund requests to export",
          variant: "destructive",
        });
        return;
      }

      const exportData = allData.map((req, index) => ({
        "S.No": index + 1,
        "Date & Time": formatDateTime(req.created_at),
        "Request Date": formatDate(req.request_date),
        "Request Type": req.request_type || "-",
        "Amount (₹)": req.amount.toFixed(2),
        "Bank Name": req.bank_name || "-",
        "UTR Number": req.utr_number || "-",
        "User Remarks": req.remarks,
        "Admin Remarks": req.admin_remarks || "-",
        Status: req.request_status,
      }));

      const worksheet = XLSX.utils.json_to_sheet(exportData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Fund Requests");

      worksheet["!cols"] = [
        { wch: 8 },  // S.No
        { wch: 20 }, // Date & Time
        { wch: 15 }, // Request Date
        { wch: 12 }, // Request Type
        { wch: 15 }, // Amount
        { wch: 20 }, // Bank Name
        { wch: 20 }, // UTR Number
        { wch: 30 }, // User Remarks
        { wch: 30 }, // Admin Remarks
        { wch: 12 }, // Status
      ];

      const fileName = `Fund_Requests_${new Date().toISOString().split("T")[0]
        }.xlsx`;
      XLSX.writeFile(workbook, fileName);

      toast({
        title: "Success",
        description: `Exported ${allData.length} fund request${allData.length > 1 ? "s" : ""
          }`,
      });
    } catch (error) {
      console.error("Export error:", error);
      toast({
        title: "Export Failed",
        description: "Unable to export fund requests",
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
      return new Date(dateString).toLocaleString("en-IN", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      });
    } catch {
      return dateString;
    }
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return "-";
    try {
      return new Date(dateString).toLocaleDateString("en-IN", {
        year: "numeric",
        month: "short",
        day: "2-digit",
      });
    } catch {
      return dateString;
    }
  };

  const getStatusBadge = (status: string) => {
    const statusUpper = status.toUpperCase();
    switch (statusUpper) {
      case "APPROVED":
        return (
          <span className="px-3 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-700 border border-green-300">
            Approved
          </span>
        );
      case "REJECTED":
        return (
          <span className="px-3 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-700 border border-red-300">
            Rejected
          </span>
        );
      case "PENDING":
        return (
          <span className="px-3 py-1 rounded-full text-xs font-semibold bg-yellow-100 text-yellow-700 border border-yellow-300">
            Pending
          </span>
        );
      default:
        return (
          <span className="px-3 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-700 border border-gray-300">
            {status}
          </span>
        );
    }
  };

  const getRequestTypeBadge = (type: string) => {
    const label = getRequestTypeLabel(type);

    switch (type?.toUpperCase()) {
      case "NORMAL":
        return (
          <span className="px-3 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-700 border border-blue-300">
            {label}
          </span>
        );

      case "ADVANCE":
        return (
          <span className="px-3 py-1 rounded-full text-xs font-semibold bg-purple-100 text-purple-700 border border-purple-300">
            {label}
          </span>
        );

      default:
        return (
          <span className="px-3 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-700 border border-gray-300">
            {label}
          </span>
        );
    }
  };


  /* -------------------- PAGINATION -------------------- */

  const totalPages = Math.ceil(totalRecords / entriesPerPage);

  /* -------------------- LOADING STATE -------------------- */

  if (!userId) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  /* -------------------- RENDER -------------------- */

  return (
    <div className="flex min-h-screen bg-background w-full">
      <AppSidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Header />

        <motion.main 
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.4, ease: "easeOut" }}
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
                  <h1 className="text-2xl font-bold">My Fund Requests</h1>
                  <p className="text-white/80 text-sm mt-1">
                    View and export your fund request history
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Button
                  onClick={exportToExcel}
                  className="bg-white text-primary hover:bg-white/90"
                  disabled={loading || isExporting || fundRequests.length === 0}
                >
                  <FileSpreadsheet
                    className={`h-4 w-4 mr-2 ${isExporting ? "animate-pulse" : ""
                      }`}
                  />
                  {isExporting ? "Exporting..." : "Export to Excel"}
                </Button>
                <Button
                  onClick={fetchRequests}
                  className="bg-white text-primary hover:bg-white/90"
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

          {/* Filter Section */}
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
                      onClick={clearFilters}
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

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  {/* Start Date */}
                  <div className="space-y-2">
                    <Label className="text-sm font-medium flex items-center gap-2">
                      <Calendar className="h-4 w-4" />
                      Start Date
                    </Label>
                    <Input
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
                    <Label className="text-sm font-medium flex items-center gap-2">
                      <Calendar className="h-4 w-4" />
                      End Date
                    </Label>
                    <Input
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
                    <Label className="text-sm font-medium">Status</Label>
                    <Select
                      value={statusFilter || "ALL"}
                      onValueChange={(value) => {
                        setStatusFilter(value === "ALL" ? "" : value);
                        setCurrentPage(1);
                      }}
                    >
                      <SelectTrigger className="h-9">
                        <SelectValue placeholder="All Statuses" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ALL">All Statuses</SelectItem>
                        <SelectItem value="APPROVED">Approved</SelectItem>
                        <SelectItem value="PENDING">Pending</SelectItem>
                        <SelectItem value="REJECTED">Rejected</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Search */}
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Search</Label>
                    <Input
                      value={searchTerm}
                      onChange={(e) => {
                        setSearchTerm(e.target.value);
                        setCurrentPage(1);
                      }}
                      placeholder="Search UTR, bank, remarks..."
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
            </div>

            {/* Active Filter Status */}
            {hasActiveFilters && (
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
                      {statusFilter && (
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
            )}
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
                      <SelectItem value="10">10</SelectItem>
                      <SelectItem value="25">25</SelectItem>
                      <SelectItem value="50">50</SelectItem>
                      <SelectItem value="100">100</SelectItem>
                    </SelectContent>
                  </Select>
                  <span className="text-sm font-medium text-gray-700">entries</span>
                </div>
                <div className="text-sm text-gray-700">
                  Showing {totalRecords > 0 ? ((currentPage - 1) * entriesPerPage) + 1 : 0} to{" "}
                  {Math.min(currentPage * entriesPerPage, totalRecords)} of {totalRecords} entries
                </div>
              </div>

              {/* Table */}
              <div className="overflow-x-auto">
                {loading ? (
                  <div className="flex flex-col items-center justify-center py-20">
                    <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
                    <p className="text-sm text-muted-foreground">
                      Loading fund requests...
                    </p>
                  </div>
                ) : fundRequests.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-20">
                    <FileText className="h-12 w-12 text-muted-foreground mb-4" />
                    <p className="text-lg font-semibold text-gray-900">
                      No fund requests found
                    </p>
                    <p className="text-sm text-gray-600">
                      {hasActiveFilters
                        ? "Try adjusting your filters"
                        : "Your fund requests will appear here"}
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
                          Request Date
                        </TableHead>
                        <TableHead className="text-center text-xs font-semibold uppercase text-gray-700 whitespace-nowrap px-4">
                          Request Type
                        </TableHead>
                        <TableHead className="text-center text-xs font-semibold uppercase text-gray-700 whitespace-nowrap px-4">
                          Amount (₹)
                        </TableHead>
                        <TableHead className="text-center text-xs font-semibold uppercase text-gray-700 whitespace-nowrap px-4">
                          Bank Name
                        </TableHead>
                        <TableHead className="text-center text-xs font-semibold uppercase text-gray-700 whitespace-nowrap px-4">
                          UTR Number
                        </TableHead>
                        <TableHead className="text-center text-xs font-semibold uppercase text-gray-700 whitespace-nowrap px-4">
                          User Remarks
                        </TableHead>
                        <TableHead className="text-center text-xs font-semibold uppercase text-gray-700 whitespace-nowrap px-4">
                          Admin Remarks
                        </TableHead>
                        <TableHead className="text-center text-xs font-semibold uppercase text-gray-700 whitespace-nowrap px-4">
                          Status
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {fundRequests.map((request, idx) => (
                        <TableRow
                          key={request.id}
                          className={`border-b hover:bg-gray-50 ${idx % 2 === 0 ? "bg-white" : "bg-gray-50/60"
                            }`}
                        >
                          <TableCell className="py-3 px-4 text-center text-sm text-gray-900 whitespace-nowrap">
                            {(currentPage - 1) * entriesPerPage + idx + 1}
                          </TableCell>
                          <TableCell className="py-3 px-4 text-center text-sm text-gray-900 whitespace-nowrap">
                            {formatDateTime(request.createdAt)}
                          </TableCell>
                          <TableCell className="py-3 px-4 text-center text-sm text-gray-900 whitespace-nowrap">
                            {formatDate(request.requestDate)}
                          </TableCell>
                          <TableCell className="py-3 px-4 text-center whitespace-nowrap">
                            {getRequestTypeBadge(request.requestType)}
                          </TableCell>
                          <TableCell className="py-3 px-4 text-center font-semibold text-sm text-gray-900 whitespace-nowrap">
                            ₹{request.amount.toLocaleString("en-IN", {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}
                          </TableCell>
                          <TableCell className="py-3 px-4 text-center text-sm text-gray-900 whitespace-nowrap">
                            {request.bankName || "-"}
                          </TableCell>
                          <TableCell className="py-3 px-4 text-center font-mono text-sm text-gray-900 whitespace-nowrap">
                            {request.utrNumber || "-"}
                          </TableCell>
                          <TableCell className="py-3 px-4 text-center text-sm text-gray-600">
                            <div
                              className="max-w-[200px] mx-auto truncate"
                              title={request.remarks}
                            >
                              {request.remarks}
                            </div>
                          </TableCell>
                          <TableCell className="py-3 px-4 text-center text-sm text-gray-600">
                            <div
                              className="max-w-[200px] mx-auto truncate"
                              title={request.adminRemarks || request.rejectRemarks}
                            >
                              {request.adminRemarks || request.rejectRemarks || "-"}
                            </div>
                          </TableCell>
                          <TableCell className="py-3 px-4 text-center whitespace-nowrap">
                            {getStatusBadge(request.status)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </div>

              {/* Pagination */}
              {totalRecords > 0 && totalPages > 1 && (
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

export default GetFundRequests;