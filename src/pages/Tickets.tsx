import { useState, useEffect, useCallback } from "react";
import { jwtDecode } from "jwt-decode";
import axios from "axios";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  ArrowLeft, MessageSquare, Eye, Calendar, CheckCircle, Clock,
  Edit, Loader2, RefreshCw, Search, X, Trash2,
} from "lucide-react";
import { AppSidebar } from "@/components/layout/AppSidebar";
import { Header } from "@/components/layout/Header";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { motion } from "framer-motion";

interface DecodedToken {
  user_id: string;
  user_name: string;
  exp: number;
  iat: number;
}

interface Ticket {
  ticket_id: number;
  admin_id: string;
  user_id: string;
  ticket_title: string;
  ticket_description: string;
  is_ticket_cleared: boolean;
  created_at: string;
}

const API_BASE = import.meta.env.VITE_API_BASE_URL;

// Always read a fresh token — never stale from a closure
function getToken(): string | null {
  return localStorage.getItem("authToken");
}

const MyTickets = () => {
  const navigate = useNavigate();

  const [userId, setUserId] = useState<string>("");
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Delete confirmation dialog
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [ticketToDelete, setTicketToDelete] = useState<Ticket | null>(null);

  // Server-side pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [recordsPerPage, setRecordsPerPage] = useState(10);
  const [totalRecords, setTotalRecords] = useState(0);

  // Today's date in YYYY-MM-DD — used as default for both date filters
  const todayStr = new Date().toISOString().split("T")[0];

  // Filters — default both dates to today so first fetch is scoped to today
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [startDate, setStartDate] = useState(todayStr);
  const [endDate, setEndDate] = useState(todayStr);

  // Stats
  const [statsTotal, setStatsTotal] = useState(0);
  const [statsCleared, setStatsCleared] = useState(0);
  const [statsPending, setStatsPending] = useState(0);

  // Dialogs
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [editFormData, setEditFormData] = useState({
    ticket_title: "",
    ticket_description: "",
  });

  /* ── INIT: decode token once on mount ── */
  useEffect(() => {
    const token = getToken();
    if (!token) {
      navigate("/login");
      return;
    }
    try {
      const decoded = jwtDecode<DecodedToken>(token);
      if (decoded.exp * 1000 < Date.now()) {
        localStorage.removeItem("authToken");
        toast.error("Session expired. Please login again.");
        navigate("/login");
        return;
      }
      setUserId(decoded.user_id || "");
    } catch {
      toast.error("Invalid token. Please log in again.");
      navigate("/login");
    }
  }, [navigate]);

  /* ── FETCH: GET /ticket/user/{userId}?limit=&offset=&start_date=&end_date= ── */
  const fetchTickets = useCallback(
    async (page: number, limit: number) => {
      if (!userId) return;

      const token = getToken(); // fresh token every call
      if (!token) {
        toast.error("Session expired. Please login again.");
        navigate("/login");
        return;
      }

      setLoading(true);
      try {
        const offset = (page - 1) * limit;

        const params: Record<string, string | number> = { limit, offset };
        if (startDate) params.start_date = startDate;
        if (endDate) {
          // Backend end_date is exclusive — to include the selected day, send day+1
          const d = new Date(endDate);
          d.setDate(d.getDate() + 1);
          params.end_date = d.toISOString().split("T")[0];
        }

        console.log("📡 GET /ticket/user/" + userId, params);

        const res = await axios.get(`${API_BASE}/ticket/user/${userId}`, {
          headers: { Authorization: `Bearer ${token}` },
          params,
        });

        console.log("✅ Response:", res.status, res.data);

        // ── Robust response parsing — handle all possible shapes ──
        // Shape A: { status, data: Ticket[] }
        // Shape B: { status, data: { tickets: Ticket[], total: N } }
        // Shape C: { data: Ticket[] }          (no status field)
        // Shape D: Ticket[]                    (raw array)
        const body = res.data;
        let list: Ticket[] = [];
        let total = 0;

        if (Array.isArray(body)) {
          list = body;
          total = body.length;
        } else if (Array.isArray(body?.data)) {
          list = body.data;
          total = body.total ?? body.data.length;
        } else if (Array.isArray(body?.data?.tickets)) {
          list = body.data.tickets;
          total = body.data.total ?? list.length;
        } else if (Array.isArray(body?.tickets)) {
          list = body.tickets;
          total = body.total ?? list.length;
        } else {
          console.warn("⚠️ Unexpected response shape:", body);
        }

        setTotalRecords(total);

        // Stats from the full unfiltered page list
        setStatsTotal(total);
        setStatsCleared(list.filter((t) => t.is_ticket_cleared).length);
        setStatsPending(list.filter((t) => !t.is_ticket_cleared).length);

        // Client-side status filter (API has no status query param)
        const afterStatus =
          statusFilter === "all"
            ? list
            : list.filter((t) =>
              statusFilter === "cleared" ? t.is_ticket_cleared : !t.is_ticket_cleared
            );

        // Client-side keyword search within current page
        const afterSearch = searchTerm.trim()
          ? afterStatus.filter((t) => {
            const kw = searchTerm.toLowerCase();
            return (
              t.ticket_title?.toLowerCase().includes(kw) ||
              t.ticket_description?.toLowerCase().includes(kw)
            );
          })
          : afterStatus;

        setTickets(afterSearch);

        if (list.length > 0) {
          toast.success(`Loaded ${list.length} ticket${list.length > 1 ? "s" : ""}`);
        } else {
          toast.info("No tickets found");
        }
      } catch (err: any) {
        console.error("❌ Fetch error:", err?.response?.status, err?.response?.data);
        setTickets([]);
        setTotalRecords(0);
        setStatsTotal(0);
        setStatsCleared(0);
        setStatsPending(0);

        if (err.response?.status === 404) {
          toast.info("No tickets found");
        } else {
          toast.error(
            err.response?.data?.message ||
            err.response?.data?.error ||
            err.message ||
            "Failed to fetch tickets"
          );
        }
      } finally {
        setLoading(false);
      }
    },
    [userId, startDate, endDate, statusFilter, searchTerm, navigate]
  );

  // Initial fetch once userId resolves
  useEffect(() => {
    if (userId) fetchTickets(1, recordsPerPage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  // Re-fetch on page / page-size change
  useEffect(() => {
    if (userId) fetchTickets(currentPage, recordsPerPage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage, recordsPerPage]);

  /* ── FILTER ACTIONS ── */
  const handleApplyFilters = () => {
    setCurrentPage(1);
    fetchTickets(1, recordsPerPage);
  };

  const handleClearFilters = () => {
    const today = new Date().toISOString().split("T")[0];
    setSearchTerm("");
    setStatusFilter("all");
    setStartDate(today);
    setEndDate(today);
    setCurrentPage(1);
    fetchTickets(1, recordsPerPage);
  };

  /* ── PAGINATION HELPERS ── */
  const totalPages = Math.max(1, Math.ceil(totalRecords / recordsPerPage));
  const indexOfFirstRecord = totalRecords === 0 ? 0 : (currentPage - 1) * recordsPerPage + 1;
  const indexOfLastRecord = Math.min(currentPage * recordsPerPage, totalRecords);

  /* ── VIEW / EDIT ── */
  const handleViewTicket = (ticket: Ticket) => {
    setSelectedTicket(ticket);
    setViewDialogOpen(true);
  };

  const handleEditTicket = (ticket: Ticket) => {
    if (ticket.is_ticket_cleared) {
      toast.error("Cannot edit a cleared ticket");
      return;
    }
    setSelectedTicket(ticket);
    setEditFormData({
      ticket_title: ticket.ticket_title,
      ticket_description: ticket.ticket_description,
    });
    setEditDialogOpen(true);
  };

  /* ── DELETE: DELETE /ticket/delete/{id} ── */
  const handleDeleteTicket = (ticket: Ticket) => {
    if (ticket.is_ticket_cleared) {
      toast.error("Cannot delete a cleared ticket");
      return;
    }
    setTicketToDelete(ticket);
    setDeleteDialogOpen(true);
  };

  const confirmDeleteTicket = async () => {
    if (!ticketToDelete) return;

    const token = getToken();
    if (!token) { toast.error("Session expired"); navigate("/login"); return; }

    setDeleting(true);
    try {
      const res = await axios.delete(
        `${API_BASE}/ticket/delete/${ticketToDelete.ticket_id}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      console.log("✅ Delete response:", res.status, res.data);
      toast.success(res.data?.message || "Ticket deleted successfully");

      // Remove from local state
      setTickets((prev) => prev.filter((t) => t.ticket_id !== ticketToDelete.ticket_id));
      setTotalRecords((prev) => Math.max(0, prev - 1));
      setStatsTotal((prev) => Math.max(0, prev - 1));
      if (ticketToDelete.is_ticket_cleared) {
        setStatsCleared((prev) => Math.max(0, prev - 1));
      } else {
        setStatsPending((prev) => Math.max(0, prev - 1));
      }

      setDeleteDialogOpen(false);
      setTicketToDelete(null);
    } catch (err: any) {
      console.error("❌ Delete error:", err?.response?.status, err?.response?.data);
      toast.error(
        err.response?.data?.message ||
        err.response?.data?.error ||
        err.message ||
        "Failed to delete ticket"
      );
    } finally {
      setDeleting(false);
    }
  };

  /* ── UPDATE: PUT /ticket/update/{id} ── */
  const handleUpdateTicket = async () => {
    if (!selectedTicket) return;

    if (!editFormData.ticket_title.trim()) { toast.error("Please enter a ticket title"); return; }
    if (editFormData.ticket_title.length < 3 || editFormData.ticket_title.length > 200) {
      toast.error("Ticket title must be between 3 and 200 characters"); return;
    }
    if (!editFormData.ticket_description.trim()) { toast.error("Please enter a ticket description"); return; }
    if (editFormData.ticket_description.length < 5) {
      toast.error("Ticket description must be at least 5 characters"); return;
    }

    const payload: Record<string, string> = {};
    if (editFormData.ticket_title !== selectedTicket.ticket_title)
      payload.ticket_title = editFormData.ticket_title.trim();
    if (editFormData.ticket_description !== selectedTicket.ticket_description)
      payload.ticket_description = editFormData.ticket_description.trim();

    if (Object.keys(payload).length === 0) {
      toast.info("No changes made");
      setEditDialogOpen(false);
      return;
    }

    const token = getToken();
    if (!token) { toast.error("Session expired"); navigate("/login"); return; }

    setUpdating(true);
    try {
      const res = await axios.put(
        `${API_BASE}/ticket/update/${selectedTicket.ticket_id}`,
        payload,
        { headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" } }
      );

      console.log("✅ Update response:", res.status, res.data);
      toast.success(res.data?.message || "Ticket updated successfully");

      // Optimistic local update
      setTickets((prev) =>
        prev.map((t) =>
          t.ticket_id === selectedTicket.ticket_id ? { ...t, ...payload } : t
        )
      );
      setEditDialogOpen(false);
    } catch (err: any) {
      console.error("❌ Update error:", err?.response?.status, err?.response?.data);
      toast.error(
        err.response?.data?.message ||
        err.response?.data?.error ||
        err.message ||
        "Failed to update ticket"
      );
    } finally {
      setUpdating(false);
    }
  };

  /* ── HELPERS ── */
  const truncateText = (text: string, max = 60) =>
    !text ? "N/A" : text.length > max ? `${text.slice(0, max)}...` : text;

  const formatDate = (ds?: string) => {
    if (!ds) return "N/A";
    try {
      return new Date(ds).toLocaleString("en-IN", {
        day: "2-digit", month: "short", year: "numeric",
        hour: "2-digit", minute: "2-digit", hour12: true,
      });
    } catch { return ds; }
  };

  const getStatusBadge = (isCleared: boolean) =>
    isCleared ? (
      <Badge className="bg-green-50 text-green-700 border-green-200">
        <CheckCircle className="h-3 w-3 mr-1" /> Cleared
      </Badge>
    ) : (
      <Badge className="bg-yellow-50 text-yellow-700 border-yellow-200">
        <Clock className="h-3 w-3 mr-1" /> Pending
      </Badge>
    );

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.1 } },
  };
  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.5 } },
  };

  /* ── RENDER ── */
  return (
    <div className="flex min-h-screen w-full bg-background">
      <AppSidebar />

      <div className="flex-1 flex flex-col min-w-0">
        <Header />

        {/* PAGE HEADER */}
        <motion.header
          initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}
          className="paybazaar-gradient text-white p-6 border-b"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" onClick={() => navigate(-1)}
                className="text-white hover:bg-white/20">
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div>
                <h1 className="text-2xl font-bold">My Support Tickets</h1>
                <p className="text-sm text-white/80 mt-1">View and manage your support tickets</p>
              </div>
            </div>
            <Button onClick={() => fetchTickets(currentPage, recordsPerPage)}
              variant="ghost" size="sm" disabled={loading} className="text-white hover:bg-white/20">
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>
        </motion.header>

        {/* MAIN CONTENT */}
        <main className="flex-1 p-6 overflow-auto bg-muted/10">
          <div className="mx-auto max-w-7xl space-y-6">

            {/* Stats Cards */}
            <motion.div variants={containerVariants} initial="hidden" animate="visible"
              className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[
                { label: "Total Tickets", value: statsTotal, icon: MessageSquare, bg: "bg-blue-100", text: "text-blue-600" },
                { label: "Pending", value: statsPending, icon: Clock, bg: "bg-yellow-100", text: "text-yellow-600" },
                { label: "Cleared", value: statsCleared, icon: CheckCircle, bg: "bg-green-100", text: "text-green-600" },
              ].map(({ label, value, icon: Icon, bg, text }) => (
                <motion.div key={label} variants={itemVariants}>
                  <Card className="border-gray-200 shadow-md">
                    <CardContent className="p-6">
                      <div className="flex items-center gap-4">
                        <div className={`flex h-12 w-12 items-center justify-center rounded-full ${bg}`}>
                          <Icon className={`h-6 w-6 ${text}`} />
                        </div>
                        <div>
                          <p className="text-sm text-gray-600">{label}</p>
                          <p className="text-2xl font-bold text-gray-900">{value}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </motion.div>

            {/* Filters */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}>
              <Card className="border-gray-200 shadow-md">
                <CardContent className="p-6 space-y-4">
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
                    <div className="space-y-2">
                      <Label className="text-sm font-medium text-gray-700 flex items-center gap-1">
                        <Search className="h-4 w-4" /> Search
                      </Label>
                      <Input placeholder="Title or description..." value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && handleApplyFilters()}
                        className="bg-white h-11" />
                    </div>

                    <div className="space-y-2">
                      <Label className="text-sm font-medium text-gray-700">Status</Label>
                      <Select value={statusFilter} onValueChange={setStatusFilter}>
                        <SelectTrigger className="bg-white h-11"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Status</SelectItem>
                          <SelectItem value="pending">Pending</SelectItem>
                          <SelectItem value="cleared">Cleared</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-sm font-medium text-gray-700 flex items-center gap-1">
                        <Calendar className="h-4 w-4" /> Start Date
                      </Label>
                      <Input type="date" value={startDate}
                        onChange={(e) => setStartDate(e.target.value)} className="bg-white h-11" />
                    </div>

                    <div className="space-y-2">
                      <Label className="text-sm font-medium text-gray-700 flex items-center gap-1">
                        <Calendar className="h-4 w-4" /> End Date
                      </Label>
                      <Input type="date" value={endDate}
                        onChange={(e) => setEndDate(e.target.value)} className="bg-white h-11" />
                    </div>
                  </div>

                  <div className="flex items-center gap-3 pt-2">
                    <Button onClick={handleApplyFilters} disabled={loading}
                      className="paybazaar-gradient text-white h-10 hover:opacity-90">
                      {loading
                        ? <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        : <Search className="h-4 w-4 mr-2" />}
                      Apply Filters
                    </Button>
                    <Button variant="outline" onClick={handleClearFilters} className="h-10">
                      <X className="h-4 w-4 mr-2" /> Clear
                    </Button>
                    <div className="ml-auto flex items-center gap-2">
                      <Label className="text-sm font-medium text-gray-700 whitespace-nowrap">Per page:</Label>
                      <Select value={recordsPerPage.toString()}
                        onValueChange={(v) => { setRecordsPerPage(Number(v)); setCurrentPage(1); }}>
                        <SelectTrigger className="bg-white h-10 w-24"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="10">10</SelectItem>
                          <SelectItem value="25">25</SelectItem>
                          <SelectItem value="50">50</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            {/* Table */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.3 }}>
              <Card className="border-gray-200 shadow-md overflow-hidden">
                <CardContent className="p-0">
                  {totalRecords > 0 && (
                    <div className="flex items-center border-b bg-gray-50 px-6 py-4">
                      <span className="text-sm font-medium text-gray-700">
                        Showing {indexOfFirstRecord}–{indexOfLastRecord} of {totalRecords} tickets
                      </span>
                    </div>
                  )}

                  <div className="overflow-x-auto">
                    {loading ? (
                      <div className="flex flex-col items-center justify-center py-20">
                        <Loader2 className="h-12 w-12 animate-spin text-blue-600 mb-4" />
                        <p className="text-gray-600">Loading tickets...</p>
                      </div>
                    ) : tickets.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-20">
                        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-gray-100 mb-4">
                          <MessageSquare className="h-10 w-10 text-gray-400" />
                        </div>
                        <p className="text-lg font-semibold text-gray-900">No tickets found</p>
                        <p className="text-sm text-gray-600 mt-1">Try adjusting your filters or date range</p>
                      </div>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-gray-50 hover:bg-gray-50">
                            {["S.No", "Ticket ID", "Title", "Description Preview", "Status", "Created At", "Actions"].map((h) => (
                              <TableHead key={h}
                                className="text-center text-xs font-bold uppercase text-gray-700 whitespace-nowrap px-4">
                                {h}
                              </TableHead>
                            ))}
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {tickets.map((ticket, idx) => (
                            <TableRow key={ticket.ticket_id}
                              className={`border-b hover:bg-gray-50 transition-colors ${idx % 2 === 0 ? "bg-white" : "bg-gray-50/50"}`}>
                              <TableCell className="py-4 px-4 text-center text-sm font-medium text-gray-900">
                                {indexOfFirstRecord + idx}
                              </TableCell>
                              <TableCell className="py-4 px-4 text-center">
                                <Badge className="bg-blue-50 text-blue-700 border-blue-200 font-mono text-xs">
                                  #{ticket.ticket_id}
                                </Badge>
                              </TableCell>
                              <TableCell className="py-4 px-4 text-center">
                                <span className="font-semibold text-sm text-gray-900">
                                  {truncateText(ticket.ticket_title, 40)}
                                </span>
                              </TableCell>
                              <TableCell className="py-4 px-4 text-center max-w-md">
                                <p className="text-sm text-gray-600 line-clamp-2">
                                  {truncateText(ticket.ticket_description)}
                                </p>
                              </TableCell>
                              <TableCell className="py-4 px-4 text-center">
                                {getStatusBadge(ticket.is_ticket_cleared)}
                              </TableCell>
                              <TableCell className="py-4 px-4 text-center whitespace-nowrap">
                                <div className="flex items-center justify-center gap-2">
                                  <Calendar className="h-4 w-4 text-gray-400" />
                                  <span className="text-sm text-gray-700">{formatDate(ticket.created_at)}</span>
                                </div>
                              </TableCell>
                              <TableCell className="py-4 px-4 text-center whitespace-nowrap">
                                <div className="flex items-center justify-center gap-2">
                                  <Button size="sm" variant="outline" onClick={() => handleViewTicket(ticket)}>
                                    <Eye className="h-4 w-4 mr-1" /> View
                                  </Button>
                                  {!ticket.is_ticket_cleared && (
                                    <Button size="sm" className="paybazaar-gradient text-white hover:opacity-90"
                                      onClick={() => handleEditTicket(ticket)}>
                                      <Edit className="h-4 w-4 mr-1" /> Edit
                                    </Button>
                                  )}
                                  {!ticket.is_ticket_cleared && (
                                    <Button size="sm" variant="outline"
                                      className="text-red-600 border-red-200 hover:bg-red-50"
                                      onClick={() => handleDeleteTicket(ticket)}>
                                      <Trash2 className="h-4 w-4 mr-1" /> Delete
                                    </Button>
                                  )}
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    )}
                  </div>

                  {/* Pagination */}
                  {totalPages > 1 && (
                    <div className="flex flex-col sm:flex-row items-center justify-between border-t bg-gray-50 px-6 py-4 gap-3">
                      <span className="text-sm font-medium text-gray-700">
                        Page {currentPage} of {totalPages}
                      </span>
                      <div className="flex items-center gap-2">
                        <Button variant="outline" size="sm"
                          disabled={currentPage === 1 || loading}
                          onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}>
                          Previous
                        </Button>
                        <div className="flex items-center gap-1">
                          {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                            let p: number;
                            if (totalPages <= 5) p = i + 1;
                            else if (currentPage <= 3) p = i + 1;
                            else if (currentPage >= totalPages - 2) p = totalPages - 4 + i;
                            else p = currentPage - 2 + i;
                            return (
                              <Button key={p} size="sm" disabled={loading}
                                variant={currentPage === p ? "default" : "outline"}
                                onClick={() => setCurrentPage(p)}
                                className={currentPage === p ? "paybazaar-gradient text-white hover:opacity-90" : ""}>
                                {p}
                              </Button>
                            );
                          })}
                        </div>
                        <Button variant="outline" size="sm"
                          disabled={currentPage === totalPages || loading}
                          onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}>
                          Next
                        </Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>

            {/* Info Note */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.4 }}>
              <Card className="bg-gray-50 border-gray-200 shadow-md">
                <CardContent className="p-6">
                  <h3 className="text-sm font-semibold text-gray-900 mb-2">Important Notes:</h3>
                  <ul className="space-y-1 text-sm text-gray-600">
                    {[
                      "You can only edit tickets that are in pending status",
                      "Once a ticket is cleared by admin, it cannot be edited",
                      "Our support team typically responds within 24 hours",
                    ].map((note) => (
                      <li key={note} className="flex items-start gap-2">
                        <span className="text-blue-600 mt-1">•</span>
                        <span>{note}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            </motion.div>
          </div>
        </main>

        {/* View Dialog */}
        <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5" /> Ticket Details
              </DialogTitle>
            </DialogHeader>
            {selectedTicket && (
              <div className="space-y-4">
                <div>
                  <Label>Title</Label>
                  <p className="font-semibold mt-1">{selectedTicket.ticket_title}</p>
                </div>
                <div>
                  <Label>Description</Label>
                  <p className="whitespace-pre-wrap text-sm mt-1">{selectedTicket.ticket_description}</p>
                </div>
                <div className="flex justify-between items-center">
                  {getStatusBadge(selectedTicket.is_ticket_cleared)}
                  <span className="text-sm text-gray-500">{formatDate(selectedTicket.created_at)}</span>
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setViewDialogOpen(false)}>Close</Button>
                  {!selectedTicket.is_ticket_cleared && (
                    <Button className="paybazaar-gradient text-white hover:opacity-90"
                      onClick={() => { setViewDialogOpen(false); handleEditTicket(selectedTicket); }}>
                      <Edit className="h-4 w-4 mr-1" /> Edit
                    </Button>
                  )}
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-red-600">
                <Trash2 className="h-5 w-5" /> Delete Ticket
              </DialogTitle>
            </DialogHeader>
            {ticketToDelete && (
              <div className="space-y-4">
                <p className="text-sm text-gray-600">
                  Are you sure you want to delete this ticket? This action cannot be undone.
                </p>
                <div className="p-3 bg-gray-50 rounded-lg border">
                  <p className="text-sm font-semibold text-gray-900">{ticketToDelete.ticket_title}</p>
                  <p className="text-xs text-gray-500 mt-1 line-clamp-2">{ticketToDelete.ticket_description}</p>
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => { setDeleteDialogOpen(false); setTicketToDelete(null); }}
                    disabled={deleting}>
                    Cancel
                  </Button>
                  <Button onClick={confirmDeleteTicket} disabled={deleting}
                    className="bg-red-600 hover:bg-red-700 text-white">
                    {deleting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Trash2 className="h-4 w-4 mr-2" />}
                    {deleting ? "Deleting..." : "Delete"}
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Edit Dialog */}
        <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
          <DialogContent className="max-w-xl">
            <DialogHeader>
              <DialogTitle>Edit Ticket</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Title</Label>
                <Input className="mt-1" value={editFormData.ticket_title}
                  onChange={(e) => setEditFormData((p) => ({ ...p, ticket_title: e.target.value }))} />
              </div>
              <div>
                <Label>Description</Label>
                <Textarea className="mt-1" rows={4} value={editFormData.ticket_description}
                  onChange={(e) => setEditFormData((p) => ({ ...p, ticket_description: e.target.value }))} />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setEditDialogOpen(false)}>Cancel</Button>
                <Button onClick={handleUpdateTicket} disabled={updating}
                  className="paybazaar-gradient text-white hover:opacity-90">
                  {updating ? <Loader2 className="h-4 w-4 animate-spin" /> : "Update"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};

export default MyTickets;