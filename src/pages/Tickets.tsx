import { useState, useEffect } from "react";
import { jwtDecode } from "jwt-decode";
import axios from "axios";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ArrowLeft,
  MessageSquare,
  Eye,
  Calendar,
  CheckCircle,
  Clock,
  Edit,
  Loader2,
  RefreshCw,
  Search,
} from "lucide-react";
import { AppSidebar } from "@/components/layout/AppSidebar";
import { Header } from "@/components/layout/Header";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { motion } from "framer-motion";

interface DecodedToken {
  admin_id?: string;
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

const MyTickets = () => {
  const navigate = useNavigate();
  const token = localStorage.getItem("authToken");
  const [adminId, setAdminId] = useState<string>("");
  const [userId, setUserId] = useState<string>("");
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [filteredTickets, setFilteredTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  
  // Dialog states
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  
  // Filter states
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [recordsPerPage, setRecordsPerPage] = useState(10);
  
  // Edit form state
  const [editFormData, setEditFormData] = useState({
    ticket_title: "",
    ticket_description: "",
  });

  useEffect(() => {
    if (token) {
      try {
        const decoded = jwtDecode<DecodedToken>(token);
        if (decoded.exp * 1000 < Date.now()) {
          localStorage.removeItem("authToken");
          toast.error("Session expired. Please login again.");
          navigate("/login");
          return;
        }
        setAdminId(decoded.admin_id || "");
        setUserId(decoded.user_id || "");
      } catch (error) {
        console.error("Error decoding token:", error);
        toast.error("Invalid token. Please log in again.");
      }
    }
  }, [token, navigate]);

  useEffect(() => {
    if (userId) {
      fetchTickets();
    }
  }, [userId]);

  const fetchTickets = async () => {
    if (!userId) {
      return;
    }

    if (!token) {
      toast.error("Authentication required");
      return;
    }

    setLoading(true);
    setSearched(true);

    try {
      const response = await axios.get(
        `${import.meta.env.VITE_API_BASE_URL}/ticket/user/${userId}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }
      );


      if (response.data && response.data.status === "success") {
        const ticketsList = response.data.data || [];
        
        // Sort by created_at (most recent first)
        const sortedTickets = [...ticketsList].sort((a, b) => {
          try {
            const dateA = new Date(a.created_at);
            const dateB = new Date(b.created_at);
            return dateB.getTime() - dateA.getTime();
          } catch {
            return 0;
          }
        });
        
        setTickets(sortedTickets);
        setFilteredTickets(sortedTickets);
        
        if (sortedTickets.length > 0) {
          toast.success(`Loaded ${sortedTickets.length} ticket${sortedTickets.length > 1 ? 's' : ''}`);
        } else {
          toast.info("No tickets found");
        }
      } else {
        setTickets([]);
        setFilteredTickets([]);
        toast.info("No tickets found");
      }
    } catch (error: any) {
      console.error("Fetch error:", error);
      setTickets([]);
      setFilteredTickets([]);
      
      if (error.response?.status === 404) {
        toast.info("No tickets found");
      } else {
        toast.error(
          error.response?.data?.message || "Failed to fetch tickets"
        );
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let filtered = [...tickets];

    // Status filter
    if (statusFilter !== "all") {
      if (statusFilter === "cleared") {
        filtered = filtered.filter(ticket => ticket.is_ticket_cleared === true);
      } else if (statusFilter === "pending") {
        filtered = filtered.filter(ticket => ticket.is_ticket_cleared === false);
      }
    }

    // Search filter
    if (searchTerm.trim()) {
      const searchLower = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (ticket) =>
          ticket.ticket_title?.toLowerCase().includes(searchLower) ||
          ticket.ticket_description?.toLowerCase().includes(searchLower)
      );
    }

    setFilteredTickets(filtered);
    setCurrentPage(1);
  }, [searchTerm, statusFilter, tickets]);

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

  const handleUpdateTicket = async () => {
    if (!selectedTicket) return;

    if (!editFormData.ticket_title.trim()) {
      toast.error("Please enter a ticket title");
      return;
    }

    if (editFormData.ticket_title.length < 3 || editFormData.ticket_title.length > 200) {
      toast.error("Ticket title must be between 3 and 200 characters");
      return;
    }

    if (!editFormData.ticket_description.trim()) {
      toast.error("Please enter a ticket description");
      return;
    }

    if (editFormData.ticket_description.length < 5) {
      toast.error("Ticket description must be at least 5 characters");
      return;
    }

    try {
      setLoading(true);

      const payload: any = {};
      
      if (editFormData.ticket_title !== selectedTicket.ticket_title) {
        payload.ticket_title = editFormData.ticket_title.trim();
      }
      
      if (editFormData.ticket_description !== selectedTicket.ticket_description) {
        payload.ticket_description = editFormData.ticket_description.trim();
      }

      if (Object.keys(payload).length === 0) {
        toast.info("No changes made");
        setEditDialogOpen(false);
        return;
      }

      const response = await axios.put(
        `${import.meta.env.VITE_API_BASE_URL}/ticket/update/${selectedTicket.ticket_id}`,
        payload,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }
      );

      if (response.data && response.data.status === "success") {
        toast.success("Ticket updated successfully");
        
        // Update local state
        setTickets(prevTickets =>
          prevTickets.map(ticket =>
            ticket.ticket_id === selectedTicket.ticket_id
              ? { ...ticket, ...payload }
              : ticket
          )
        );
        
        setFilteredTickets(prevFiltered =>
          prevFiltered.map(ticket =>
            ticket.ticket_id === selectedTicket.ticket_id
              ? { ...ticket, ...payload }
              : ticket
          )
        );

        setEditDialogOpen(false);
      }
    } catch (error: any) {
      console.error("Update error:", error);
      toast.error(
        error.response?.data?.message || "Failed to update ticket"
      );
    } finally {
      setLoading(false);
    }
  };

  const truncateText = (text: string, maxLength: number = 60) => {
    if (!text) return "N/A";
    return text.length > maxLength ? `${text.slice(0, maxLength)}...` : text;
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return "N/A";
    try {
      return new Date(dateString).toLocaleString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      });
    } catch {
      return dateString;
    }
  };

  const getStatusBadge = (isCleared: boolean) => {
    if (isCleared) {
      return (
        <Badge className="bg-green-50 text-green-700 border-green-200">
          <CheckCircle className="h-3 w-3 mr-1" />
          Cleared
        </Badge>
      );
    }
    return (
      <Badge className="bg-yellow-50 text-yellow-700 border-yellow-200">
        <Clock className="h-3 w-3 mr-1" />
        Pending
      </Badge>
    );
  };

  const totalTickets = tickets.length;
  const clearedTickets = tickets.filter(t => t.is_ticket_cleared).length;
  const pendingTickets = tickets.filter(t => !t.is_ticket_cleared).length;

  const totalPages = Math.ceil(filteredTickets.length / recordsPerPage);
  const indexOfLastRecord = currentPage * recordsPerPage;
  const indexOfFirstRecord = indexOfLastRecord - recordsPerPage;
  const paginatedTickets = filteredTickets.slice(indexOfFirstRecord, indexOfLastRecord);

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.1 },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.5 },
    },
  };

  return (
    <div className="flex min-h-screen w-full bg-background">

      <AppSidebar />

      <div className="flex-1 flex flex-col min-w-0">
        <Header />

        {/* PAGE HEADER */}
        <motion.header
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="paybazaar-gradient text-white p-6 border-b"
        >
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
                <h1 className="text-2xl font-bold">My Support Tickets</h1>
                <p className="text-sm text-white/80 mt-1">
                  View and manage your support tickets
                </p>
              </div>
            </div>
            <Button
              onClick={fetchTickets}
              variant="ghost"
              size="sm"
              disabled={loading}
              className="text-white hover:bg-white/20"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </motion.header>

        {/* MAIN CONTENT */}
        <main className="flex-1 p-6 overflow-auto bg-muted/10">
          <div className="mx-auto max-w-7xl space-y-6">
            {/* Stats Cards */}
            {searched && (
              <motion.div
                variants={containerVariants}
                initial="hidden"
                animate="visible"
                className="grid grid-cols-1 md:grid-cols-3 gap-4"
              >
                <motion.div variants={itemVariants}>
                  <Card className="border-gray-200 shadow-md">
                    <CardContent className="p-6">
                      <div className="flex items-center gap-4">
                        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-100">
                          <MessageSquare className="h-6 w-6 text-blue-600" />
                        </div>
                        <div>
                          <p className="text-sm text-gray-600">Total Tickets</p>
                          <p className="text-2xl font-bold text-gray-900">{totalTickets}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>

                <motion.div variants={itemVariants}>
                  <Card className="border-gray-200 shadow-md">
                    <CardContent className="p-6">
                      <div className="flex items-center gap-4">
                        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-yellow-100">
                          <Clock className="h-6 w-6 text-yellow-600" />
                        </div>
                        <div>
                          <p className="text-sm text-gray-600">Pending</p>
                          <p className="text-2xl font-bold text-gray-900">{pendingTickets}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>

                <motion.div variants={itemVariants}>
                  <Card className="border-gray-200 shadow-md">
                    <CardContent className="p-6">
                      <div className="flex items-center gap-4">
                        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
                          <CheckCircle className="h-6 w-6 text-green-600" />
                        </div>
                        <div>
                          <p className="text-sm text-gray-600">Cleared</p>
                          <p className="text-2xl font-bold text-gray-900">{clearedTickets}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              </motion.div>
            )}

            {/* Filters Section */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
            >
              <Card className="border-gray-200 shadow-md">
                <CardContent className="p-6">
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                    <div className="space-y-2">
                      <Label className="text-sm font-medium text-gray-700 flex items-center gap-1">
                        <Search className="h-4 w-4" />
                        Search Tickets
                      </Label>
                      <Input
                        placeholder="Search by title or description..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="bg-white h-11"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label className="text-sm font-medium text-gray-700">Status</Label>
                      <Select value={statusFilter} onValueChange={setStatusFilter}>
                        <SelectTrigger className="bg-white h-11">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Status</SelectItem>
                          <SelectItem value="pending">Pending</SelectItem>
                          <SelectItem value="cleared">Cleared</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-sm font-medium text-gray-700">
                        Records Per Page
                      </Label>
                      <Select
                        value={recordsPerPage.toString()}
                        onValueChange={(value) => {
                          setRecordsPerPage(Number(value));
                          setCurrentPage(1);
                        }}
                      >
                        <SelectTrigger className="bg-white h-11">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="10">10 per page</SelectItem>
                          <SelectItem value="25">25 per page</SelectItem>
                          <SelectItem value="50">50 per page</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            {/* Tickets Table */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.3 }}
            >
              <Card className="border-gray-200 shadow-md overflow-hidden">
                <CardContent className="p-0">
                  {filteredTickets.length > 0 && (
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between border-b bg-gray-50 px-4 md:px-6 py-4 gap-3">
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-medium text-gray-700">
                          Showing {indexOfFirstRecord + 1} to{" "}
                          {Math.min(indexOfLastRecord, filteredTickets.length)} of{" "}
                          {filteredTickets.length} tickets
                        </span>
                      </div>
                    </div>
                  )}

                  <div className="overflow-x-auto">
                    {loading ? (
                      <div className="flex flex-col items-center justify-center py-20">
                        <Loader2 className="h-12 w-12 animate-spin text-blue-600 mb-4" />
                        <p className="text-gray-600">Loading tickets...</p>
                      </div>
                    ) : paginatedTickets.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-20">
                        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-gray-100 mb-4">
                          <MessageSquare className="h-10 w-10 text-gray-400" />
                        </div>
                        <p className="text-lg font-semibold text-gray-900">No tickets found</p>
                        <p className="text-sm text-gray-600 mt-1">
                          {searched
                            ? "Try adjusting your search terms or filters"
                            : "Click 'Refresh' to load tickets"}
                        </p>
                      </div>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-gray-50 hover:bg-gray-50">
                            <TableHead className="text-center text-xs font-bold uppercase text-gray-700 whitespace-nowrap px-4">
                              S.No
                            </TableHead>
                            <TableHead className="text-center text-xs font-bold uppercase text-gray-700 whitespace-nowrap px-4">
                              Ticket ID
                            </TableHead>
                            <TableHead className="text-center text-xs font-bold uppercase text-gray-700 whitespace-nowrap px-4">
                              Title
                            </TableHead>
                            <TableHead className="text-center text-xs font-bold uppercase text-gray-700 whitespace-nowrap px-4">
                              Description Preview
                            </TableHead>
                            <TableHead className="text-center text-xs font-bold uppercase text-gray-700 whitespace-nowrap px-4">
                              Status
                            </TableHead>
                            <TableHead className="text-center text-xs font-bold uppercase text-gray-700 whitespace-nowrap px-4">
                              Created At
                            </TableHead>
                            <TableHead className="text-center text-xs font-bold uppercase text-gray-700 whitespace-nowrap px-4">
                              Actions
                            </TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {paginatedTickets.map((ticket, idx) => (
                            <TableRow
                              key={ticket.ticket_id}
                              className={`border-b hover:bg-gray-50 transition-colors ${
                                idx % 2 === 0 ? "bg-white" : "bg-gray-50/50"
                              }`}
                            >
                              <TableCell className="py-4 px-4 text-center text-sm font-medium text-gray-900">
                                {indexOfFirstRecord + idx + 1}
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
                                  <span className="text-sm text-gray-700">
                                    {formatDate(ticket.created_at)}
                                  </span>
                                </div>
                              </TableCell>

                              <TableCell className="py-4 px-4 text-center whitespace-nowrap">
                                <div className="flex items-center justify-center gap-2">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handleViewTicket(ticket)}
                                  >
                                    <Eye className="h-4 w-4 mr-1" />
                                    View
                                  </Button>

                                  {!ticket.is_ticket_cleared && (
                                    <Button
                                      size="sm"
                                      variant="default"
                                      className="bg-blue-600 hover:bg-blue-700 text-white"
                                      onClick={() => handleEditTicket(ticket)}
                                    >
                                      <Edit className="h-4 w-4 mr-1" />
                                      Edit
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
                  {filteredTickets.length > 0 && totalPages > 1 && (
                    <div className="flex flex-col sm:flex-row items-center justify-between border-t bg-gray-50 px-4 md:px-6 py-4 gap-3">
                      <div className="text-sm font-medium text-gray-700">
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
                                className={
                                  currentPage === pageNum
                                    ? "bg-blue-600 hover:bg-blue-700 text-white"
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
                </CardContent>
              </Card>
            </motion.div>

            {/* Info Note */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.4 }}
            >
              <Card className="bg-gray-50 border-gray-200 shadow-md">
                <CardContent className="p-6">
                  <h3 className="text-sm font-semibold text-gray-900 mb-2">
                    Important Notes:
                  </h3>
                  <ul className="space-y-1 text-sm text-gray-600">
                    <li className="flex items-start gap-2">
                      <span className="text-blue-600 mt-1">•</span>
                      <span>You can only edit tickets that are in pending status</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-blue-600 mt-1">•</span>
                      <span>Once a ticket is cleared by admin, it cannot be edited</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-blue-600 mt-1">•</span>
                      <span>Our support team typically responds within 24 hours</span>
                    </li>
                  </ul>
                </CardContent>
              </Card>
            </motion.div>
          </div>
        </main>
        {/* View Ticket Dialog */}
<Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
  <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
    <DialogHeader>
      <DialogTitle className="flex items-center gap-2">
        <MessageSquare className="h-5 w-5" />
        Ticket Details
      </DialogTitle>
    </DialogHeader>

    {selectedTicket && (
      <div className="space-y-4">
        <div>
          <Label>Title</Label>
          <p className="font-semibold">{selectedTicket.ticket_title}</p>
        </div>

        <div>
          <Label>Description</Label>
          <p className="whitespace-pre-wrap text-sm">
            {selectedTicket.ticket_description}
          </p>
        </div>

        <div className="flex justify-between items-center">
          {getStatusBadge(selectedTicket.is_ticket_cleared)}
          <span className="text-sm text-gray-500">
            {formatDate(selectedTicket.created_at)}
          </span>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => setViewDialogOpen(false)}>
            Close
          </Button>

          {!selectedTicket.is_ticket_cleared && (
            <Button
              className="bg-blue-600 hover:bg-blue-700 text-white"
              onClick={() => {
                setViewDialogOpen(false);
                handleEditTicket(selectedTicket);
              }}
            >
              <Edit className="h-4 w-4 mr-1" />
              Edit
            </Button>
          )}
        </div>
      </div>
    )}
  </DialogContent>
</Dialog>


{/* Edit Ticket Dialog */}
<Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
  <DialogContent className="max-w-xl">
    <DialogHeader>
      <DialogTitle>Edit Ticket</DialogTitle>
    </DialogHeader>

    <div className="space-y-4">
      <div>
        <Label>Title</Label>
        <Input
          value={editFormData.ticket_title}
          onChange={(e) =>
            setEditFormData((p) => ({
              ...p,
              ticket_title: e.target.value,
            }))
          }
        />
      </div>

      <div>
        <Label>Description</Label>
        <Textarea
          rows={4}
          value={editFormData.ticket_description}
          onChange={(e) =>
            setEditFormData((p) => ({
              ...p,
              ticket_description: e.target.value,
            }))
          }
        />
      </div>

      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
          Cancel
        </Button>
        <Button
          onClick={handleUpdateTicket}
          disabled={loading}
          className="bg-blue-600 hover:bg-blue-700 text-white"
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            "Update"
          )}
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
    

   