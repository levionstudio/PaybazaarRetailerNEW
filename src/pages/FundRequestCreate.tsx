import { useState, useEffect } from "react";
import axios from "axios";
import { jwtDecode } from "jwt-decode";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Building2, Copy, CheckCircle2, Loader2, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import { AppSidebar } from "@/components/layout/AppSidebar";
import { Header } from "@/components/layout/Header";

/* -------------------- INTERFACES -------------------- */

interface DecodedToken {
  user_id: string;
  user_name: string;
  exp: number;
  iat: number;
}

interface AdminBank {
  admin_bank_id: number;
  admin_id: string;
  admin_bank_name: string;
  admin_bank_account_number: string;
  admin_bank_ifsc_code: string;
}

/* -------------------- COMPONENT -------------------- */

const RequestFunds = () => {
  const { toast } = useToast();
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    request_type: "NORMAL", // Default to NORMAL
    bank_name: "",
    utr_number: "",
    amount: "",
    request_date: "",
    remarks: "",
  });

  const [loading, setLoading] = useState(false);
  const [tokenData, setTokenData] = useState<DecodedToken | null>(null);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [banks, setBanks] = useState<AdminBank[]>([]);
  const [adminId, setAdminId] = useState<string>("");

  /* -------------------- COPY TO CLIPBOARD -------------------- */

  const copyToClipboard = (text: string, field: string, bankIndex: number) => {
    navigator.clipboard.writeText(text);
    setCopiedField(`${field}-${bankIndex}`);
    toast({
      title: "Copied!",
      description: `${field} copied to clipboard`,
    });
    setTimeout(() => setCopiedField(null), 2000);
  };

  /* -------------------- FETCH ADMIN BANKS -------------------- */

  useEffect(() => {
    const fetchAdminBanks = async () => {
      try {
        const token = localStorage.getItem("authToken");

        const res = await axios.get(
          `${import.meta.env.VITE_API_BASE_URL}/admin-bank/all`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        if (res.data?.admin_banks && Array.isArray(res.data.admin_banks)) {
          console.log(`Loaded ${res.data.admin_banks.length} admin banks:`, res.data.admin_banks);
          setBanks(res.data.admin_banks);
          // Set a fallback adminId from the first bank in the list if profile hasn't provided one yet
          if (res.data.admin_banks.length > 0 && !adminId) {
            setAdminId(res.data.admin_banks[0].admin_id);
          }
        } else {
          console.warn("No admin banks found in response:", res.data);
          setBanks([]);
        }
      } catch (err) {
        console.error("Failed to fetch admin banks:", err);
        setBanks([]);
      }
    };

    const fetchRetailerProfile = async () => {
      if (!tokenData?.user_id) return;
      try {
        const token = localStorage.getItem("authToken");
        const res = await axios.get(
          `${import.meta.env.VITE_API_BASE_URL}/retailer/get/${tokenData.user_id}`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );
        // Check common field names for admin_id
        const foundAdminId = res.data.retailer?.admin_id || res.data.retailer?.admin || res.data.retailer?.assigned_admin;
        
        if (foundAdminId) {
          console.log(`Fetched admin_id: ${foundAdminId} for user: ${tokenData.user_id}`);
          setAdminId(foundAdminId);
        } else {
          console.warn("Retailer profile fetched but admin identity field not found in:", res.data.retailer);
        }
      } catch (err) {
        console.error("Failed to fetch retailer profile details:", err);
      }
    };

    fetchAdminBanks();
    fetchRetailerProfile();
  }, [tokenData?.user_id]);

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
        setTokenData(decoded);
      } catch (err) {
        console.error("Token decode error:", err);
        localStorage.removeItem("authToken");
        toast({
          title: "Authentication Error",
          description: "Invalid session. Please log in again.",
          variant: "destructive",
        });
        navigate("/login");
      } finally {
        setIsCheckingAuth(false);
      }
    };

    checkAuth();
  }, [toast, navigate]);

  /* -------------------- FORM HANDLERS -------------------- */

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { id, value } = e.target;
    setFormData((prev) => ({ ...prev, [id]: value }));
  };

  const handleRequestTypeChange = (value: string) => {
    setFormData((prev) => ({
      ...prev,
      request_type: value,
      // Clear bank and UTR fields when switching to ADVANCE
      bank_name: value === "ADVANCE" ? "" : prev.bank_name,
      utr_number: value === "ADVANCE" ? "" : prev.utr_number,
    }));
  };

  const validateForm = () => {
    const errors: Record<string, string> = {};

    // Request type is always required
    if (!formData.request_type) {
      errors.request_type = "Please select a request type";
    }

    // For NORMAL requests, bank_name and utr_number are required
    if (formData.request_type === "NORMAL") {
      if (!formData.bank_name) {
        errors.bank_name = "Please select a bank";
      }
      if (!formData.utr_number || formData.utr_number.trim() === "") {
        errors.utr_number = "UTR number is required for normal requests";
      }
    }

    // Common validations for both types
    if (!formData.request_date) {
      errors.request_date = "Request date is required";
    }
    if (!formData.amount) {
      errors.amount = "Amount is required";
    } else if (parseFloat(formData.amount) <= 0) {
      errors.amount = "Amount must be greater than 0";
    }

    if (Object.keys(errors).length > 0) {
      const firstError = Object.values(errors)[0];
      toast({
        title: "Validation Error",
        description: firstError,
        variant: "destructive",
      });
      return false;
    }

    return true;
  };

  /* -------------------- FORM SUBMISSION -------------------- */

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!tokenData) {
      toast({
        title: "Authentication Error",
        description: "User session not found. Please log in again.",
        variant: "destructive",
      });
      navigate("/login");
      return;
    }

    // Validate form before submission
    if (!validateForm()) {
      return;
    }

    const token = localStorage.getItem("authToken");
    if (!token) {
      toast({
        title: "Authentication Required",
        description: "Please log in to submit the request.",
        variant: "destructive",
      });
      navigate("/login");
      return;
    }

    // Verify token data has required fields
    if (!tokenData.user_id) {
      toast({
        title: "Configuration Error",
        description:
          "Required user information is missing. Please log in again.",
        variant: "destructive",
      });
      navigate("/login");
      return;
    }

    // Build payload according to backend model
    const payload: any = {
      requester_id: tokenData.user_id,
      request_to_id: adminId || "A000006", // Use fetched adminId, fallback to A000006 as seen in snippet
      amount: parseFloat(formData.amount),
      request_date: new Date(formData.request_date).toISOString(),
      request_type: formData.request_type,
      remarks: formData.remarks.trim() || "Admin, please approve",
    };

    // Add bank_name and utr_number only for NORMAL requests
    if (formData.request_type === "NORMAL") {
      payload.bank_name = formData.bank_name;
      payload.utr_number = formData.utr_number.trim();
    } else {
      // For ADVANCE requests, set these as empty or omit them
      payload.bank_name = "";
      payload.utr_number = "";
    }

    try {
      setLoading(true);
      toast({
        title: "Submitting Request",
        description: "Please wait while we process your fund request...",
      });

      console.log("Submitting fund request with payload:", payload);

      const { data } = await axios.post(
        `${import.meta.env.VITE_API_BASE_URL}/fund-request/retailer-to-admin`,
        payload,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }
      );

      console.log("Fund request response:", data);

      // Look for indicators of success: status field, existence of fund_request object, or success message
      const isSuccess = data.status === "success" || data.fund_request || data.message?.toLowerCase().includes("successful");

      if (isSuccess) {
        toast({
          title: "Success",
          description:
            data.message ||
            "Fund request submitted successfully. We will process it shortly.",
        });

        // Reset form
        setFormData({
          request_type: "NORMAL",
          bank_name: "",
          utr_number: "",
          amount: "",
          request_date: "",
          remarks: "",
        });

        setTimeout(() => {
          navigate("/dashboard");
        }, 1500);
      } else {
        toast({
          title: "Request Failed",
          description:
            data.message || "Failed to submit fund request. Please try again.",
          variant: "destructive",
        });
      }
    } catch (err: any) {
      console.error("Fund request error:", err);

      let errorMessage = "Something went wrong. Please try again.";

      if (err.response) {
        if (err.response.status === 400) {
          errorMessage =
            err.response.data?.message ||
            err.response.data?.error ||
            "Invalid request data. Please check all fields.";
        } else if (err.response.status === 401) {
          errorMessage = "Session expired. Please log in again.";
          setTimeout(() => navigate("/login"), 2000);
        } else if (err.response.status === 403) {
          errorMessage = "You don't have permission to perform this action.";
        } else if (err.response.status === 500) {
          errorMessage = "Server error. Please try again later.";
        } else {
          errorMessage = err.response.data?.message || errorMessage;
        }
      } else if (err.request) {
        errorMessage = "Network error. Please check your internet connection.";
      }

      toast({
        title: "Request Failed",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  /* -------------------- LOADING STATE -------------------- */

  if (isCheckingAuth) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">
            Checking authentication...
          </p>
        </div>
      </div>
    );
  }

  /* -------------------- RENDER -------------------- */

  const isNormalRequest = formData.request_type === "NORMAL";
  const isAdvanceRequest = formData.request_type === "ADVANCE";

  return (
    <div className="flex min-h-screen w-full bg-background">
      <AppSidebar />

      <div className="flex-1 flex flex-col min-w-0">
        <Header />
        <div className="flex-1 overflow-y-auto">
          <motion.main 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
            className="p-6 flex flex-col items-center"
          >
            {/* Fund Request Form */}
            <div className="flex flex-col max-w-3xl w-full">
              <Card className="shadow-lg border border-border rounded-xl overflow-hidden">
                <CardHeader className="paybazaar-gradient text-white rounded-t-xl">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-1 bg-white/30 rounded-full"></div>
                    <div>
                      <CardTitle className="text-2xl font-bold">
                        Request E-Value
                      </CardTitle>
                      <CardDescription className="text-white/90 mt-1">
                        Submit your fund request with transaction details
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-8 bg-gradient-to-br from-background to-muted/30">
                  <form onSubmit={handleSubmit} className="space-y-6">
                    {/* Request Type Selection - Always First */}
                    <div className="space-y-2">
                      <Label
                        htmlFor="request_type"
                        className="text-sm font-semibold text-foreground flex items-center gap-1"
                      >
                        Request Type <span className="text-destructive">*</span>
                      </Label>
                      <Select
                        value={formData.request_type}
                        onValueChange={handleRequestTypeChange}
                        required
                      >
                        <SelectTrigger className="h-12 border-2 border-border focus:border-primary transition-colors bg-background">
                          <SelectValue placeholder="Select Request Type" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="NORMAL">
                            <div className="flex items-center gap-2">
                              <Building2 className="h-4 w-4" />
                              <div className="flex flex-col">
                                <span className="font-medium">Bank Transfer</span>
                               
                              </div>
                            </div>
                          </SelectItem>
                          <SelectItem value="ADVANCE">
                            <div className="flex items-center gap-2">
                              <AlertCircle className="h-4 w-4" />
                              <div className="flex flex-col">
                                <span className="font-medium">Advance Credit Request</span>
                               
                              </div>
                            </div>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                      
                      {/* Info message based on request type */}
                      {isNormalRequest && (
                        <div className="flex items-start gap-2 p-3 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg mt-2">
                          <AlertCircle className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
                          <p className="text-sm text-blue-900 dark:text-blue-100">
                            For normal requests, please transfer funds to the selected bank account and provide the UTR number.
                          </p>
                        </div>
                      )}
                      
                      {isAdvanceRequest && (
                        <div className="flex items-start gap-2 p-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg mt-2">
                          <AlertCircle className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
                          <p className="text-sm text-amber-900 dark:text-amber-100">
                            Advance requests do not require bank transfer details. Funds will be credited based on admin approval.
                          </p>
                        </div>
                      )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {/* Bank Name Dropdown - Only for NORMAL */}
                      {isNormalRequest && (
                        <div className="space-y-2">
                          <Label
                            htmlFor="bank_name"
                            className="text-sm font-semibold text-foreground flex items-center gap-1"
                          >
                            Bank Name <span className="text-destructive">*</span>
                          </Label>
                          <Select
                            value={formData.bank_name}
                            onValueChange={(value) =>
                              setFormData((prev) => ({
                                ...prev,
                                bank_name: value,
                              }))
                            }
                            required={isNormalRequest}
                          >
                            <SelectTrigger className="h-12 border-2 border-border focus:border-primary transition-colors bg-background">
                              <SelectValue placeholder="Select Bank" />
                            </SelectTrigger>
                            <SelectContent>
                              {banks.map((bank) => (
                                <SelectItem
                                  key={bank.admin_bank_id}
                                  value={bank.admin_bank_name}
                                >
                                  <div className="flex flex-col text-left">
                                    <div className="flex items-center gap-2">
                                      <Building2 className="h-4 w-4" />
                                      <span className="font-medium">
                                        {bank.admin_bank_name}
                                      </span>
                                    </div>
                                    <span className="text-xs text-muted-foreground">
                                      {bank.admin_bank_account_number} | IFSC:{" "}
                                      {bank.admin_bank_ifsc_code}
                                    </span>
                                  </div>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      )}

                      {/* Request Date */}
                      <div className="space-y-2">
                        <Label
                          htmlFor="request_date"
                          className="text-sm font-semibold text-foreground flex items-center gap-1"
                        >
                          Request Date{" "}
                          <span className="text-destructive">*</span>
                        </Label>
                        <Input
                          id="request_date"
                          type="date"
                          value={formData.request_date}
                          onChange={handleChange}
                          max={new Date().toISOString().split("T")[0]}
                          className="h-12 border-2 border-border focus:border-primary transition-colors bg-background"
                          required
                        />
                      </div>

                      {/* UTR Number - Only for NORMAL */}
                      {isNormalRequest && (
                        <div className="space-y-2">
                          <Label
                            htmlFor="utr_number"
                            className="text-sm font-semibold text-foreground flex items-center gap-1"
                          >
                            UTR Number <span className="text-destructive">*</span>
                          </Label>
                          <Input
                            id="utr_number"
                            type="text"
                            value={formData.utr_number}
                            onChange={handleChange}
                            className="h-12 border-2 border-border focus:border-primary transition-colors bg-background"
                            placeholder="Enter UTR Number"
                            required={isNormalRequest}
                          />
                        </div>
                      )}

                      {/* Amount */}
                      <div className="space-y-2">
                        <Label
                          htmlFor="amount"
                          className="text-sm font-semibold text-foreground flex items-center gap-1"
                        >
                          Amount <span className="text-destructive">*</span>
                        </Label>
                        <Input
                          id="amount"
                          type="number"
                          value={formData.amount}
                          onChange={handleChange}
                          className="h-12 border-2 border-border focus:border-primary transition-colors bg-background"
                          placeholder="Enter Amount"
                          min="1"
                          step="0.01"
                          required
                        />
                      </div>
                    </div>

                    {/* Remarks - Optional */}
                    <div className="space-y-2">
                      <Label
                        htmlFor="remarks"
                        className="text-sm font-semibold text-foreground flex items-center gap-1"
                      >
                        Remarks{" "}
                        <span className="text-muted-foreground text-xs font-normal">
                          (Optional)
                        </span>
                      </Label>
                      <Textarea
                        id="remarks"
                        value={formData.remarks}
                        onChange={handleChange}
                        className="min-h-[100px] border-2 border-border focus:border-primary transition-colors bg-background resize-none"
                        placeholder="Enter any additional notes or remarks (optional)"
                      />
                      <p className="text-xs text-muted-foreground">
                        If left empty, the default message "Admin, please
                        approve" will be sent
                      </p>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex gap-4 pt-6">
                      <Button
                        type="button"
                        variant="outline"
                        className="flex-1 h-12 border-2 hover:bg-muted"
                        disabled={loading}
                        onClick={() => navigate("/dashboard")}
                      >
                        Cancel
                      </Button>

                      <Button
                        type="submit"
                        className="flex-1 h-12 paybazaar-gradient text-white hover:opacity-90 shadow-lg font-semibold"
                        disabled={loading}
                      >
                        {loading ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Submitting...
                          </>
                        ) : (
                          "Submit Request"
                        )}
                      </Button>
                    </div>
                  </form>
                </CardContent>
              </Card>
            </div>
          </motion.main>
        </div>
      </div>
    </div>
  );
};

export default RequestFunds;