import { useState, useEffect } from "react";
import { Header } from "@/components/layout/Header";
import { AppSidebar } from "@/components/layout/AppSidebar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ArrowLeft,
  Save,
  User,
  Mail,
  Phone,
  MapPin,
  Building2,
  Lock,
  Eye,
  EyeOff,
  KeyRound,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import axios from "axios";
import { jwtDecode } from "jwt-decode";
import { motion } from "framer-motion";

interface DecodedToken {
  user_id: string;
  exp: number;
}

const CLOUDFRONT_BASE = "https://d1wq5jtrql22ms.cloudfront.net/";
const toCdnUrl = (key: string | null | undefined): string =>
  key ? `${CLOUDFRONT_BASE}${key}` : "";

export default function ProfileUpdate() {
  const navigate = useNavigate();
  const { toast } = useToast();

  // ─── Profile form data (matches PUT /retailer/update/{id} payload) ───
  const [formData, setFormData] = useState({
    retailer_name: "",
    retailer_phone: "",
    retailer_email: "",
    retailer_city: "",
    retailer_state: "",
    retailer_address: "",
    retailer_pincode: "",
    retailer_business_name: "",
    retailer_business_type: "",
    retailer_gst_number: "",
  });

  // ─── Password form ───
  const [passwordData, setPasswordData] = useState({
    retailer_password: "",
    confirm_password: "",
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loadingPassword, setLoadingPassword] = useState(false);

  // ─── MPIN form ───
  const [mpinData, setMpinData] = useState({ retailer_mpin: "" });
  const [loadingMpin, setLoadingMpin] = useState(false);

  const [userId, setUserId] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [fetchingProfile, setFetchingProfile] = useState(true);
  const [profileImage, setProfileImage] = useState<string>("");

  // ─── Fetch profile on mount ───
  useEffect(() => {
    const token = localStorage.getItem("authToken");
    if (!token) {
      toast({ title: "Authentication Required", description: "Please log in.", variant: "destructive" });
      navigate("/login");
      return;
    }

    let decoded: DecodedToken;
    try {
      decoded = jwtDecode<DecodedToken>(token);
    } catch {
      toast({ title: "Error", description: "Invalid session. Please log in again.", variant: "destructive" });
      navigate("/login");
      return;
    }

    if (!decoded.user_id || decoded.exp * 1000 < Date.now()) {
      localStorage.removeItem("authToken");
      toast({ title: "Session Expired", description: "Please log in again.", variant: "destructive" });
      navigate("/login");
      return;
    }

    setUserId(decoded.user_id);

    const fetchProfile = async () => {
      try {
        setFetchingProfile(true);
        // GET /retailer/get/{retailer_id}
        const response = await axios.get(
          `${import.meta.env.VITE_API_BASE_URL}/retailer/get/${decoded.user_id}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );

        const retailer = response.data?.retailer;
        if (retailer) {
          setFormData({
            retailer_name: retailer.retailer_name || "",
            retailer_phone: retailer.retailer_phone || "",
            retailer_email: retailer.retailer_email || "",
            retailer_city: retailer.retailer_city || "",
            retailer_state: retailer.retailer_state || "",
            retailer_address: retailer.retailer_address || "",
            retailer_pincode: retailer.retailer_pincode || "",
            retailer_business_name: retailer.retailer_business_name || "",
            retailer_business_type: retailer.retailer_business_type || "",
            retailer_gst_number: retailer.retailer_gst_number || "",
          });
          // Set profile image from CloudFront
          if (retailer.retailer_image) {
            setProfileImage(toCdnUrl(retailer.retailer_image));
          }
        }
      } catch (error: any) {
        let msg = "Failed to load profile data.";
        if (error.response?.status === 401) {
          msg = "Session expired. Please log in again.";
          setTimeout(() => navigate("/login"), 2000);
        } else if (error.response?.data?.message) {
          msg = error.response.data.message;
        }
        toast({ title: "Warning", description: msg, variant: "destructive" });
      } finally {
        setFetchingProfile(false);
      }
    };

    fetchProfile();
  }, [navigate, toast]);

  const handleInputChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  // ─── Submit profile update: PUT /retailer/update/{retailer_id} ───
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId) {
      toast({ title: "Error", description: "User ID not found. Please log in again.", variant: "destructive" });
      navigate("/login");
      return;
    }

    const token = localStorage.getItem("authToken");
    if (!token) {
      toast({ title: "Authentication Required", description: "Please log in.", variant: "destructive" });
      navigate("/login");
      return;
    }

    try {
      setLoading(true);
      // PUT /retailer/update/{retailer_id}
      const response = await axios.put(
        `${import.meta.env.VITE_API_BASE_URL}/retailer/update/${userId}`,
        {
          retailer_name: formData.retailer_name,
          retailer_phone: formData.retailer_phone,
          retailer_email: formData.retailer_email,
          retailer_city: formData.retailer_city,
          retailer_state: formData.retailer_state,
          retailer_address: formData.retailer_address,
          retailer_pincode: formData.retailer_pincode,
          retailer_business_name: formData.retailer_business_name,
          retailer_business_type: formData.retailer_business_type,
          retailer_gst_number: formData.retailer_gst_number,
        },
        { headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" } }
      );

      if (response.data.status === "success" || response.status === 200) {
        toast({ title: "Success", description: response.data.message || "Profile updated successfully!" });
        setTimeout(() => navigate("/profile"), 1500);
      } else {
        toast({ title: "Update Failed", description: response.data.message || "Failed to update profile.", variant: "destructive" });
      }
    } catch (error: any) {
      let msg = "Failed to update profile. Please try again.";
      if (error.response?.status === 400) msg = error.response.data?.message || "Invalid data.";
      else if (error.response?.status === 401) { msg = "Session expired."; setTimeout(() => navigate("/login"), 2000); }
      else if (error.response?.data?.message) msg = error.response.data.message;
      toast({ title: "Update Failed", description: msg, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  // ─── Change password: PATCH /retailer/update/{retailer_id}/password ───
  const handlePasswordUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passwordData.retailer_password) {
      toast({ title: "Required", description: "Please enter a new password.", variant: "destructive" });
      return;
    }
    if (passwordData.retailer_password !== passwordData.confirm_password) {
      toast({ title: "Mismatch", description: "Passwords do not match.", variant: "destructive" });
      return;
    }
    if (passwordData.retailer_password.length < 8) {
      toast({ title: "Too Short", description: "Password must be at least 8 characters.", variant: "destructive" });
      return;
    }

    const token = localStorage.getItem("authToken");
    try {
      setLoadingPassword(true);
      // PATCH /retailer/update/{retailer_id}/password
      const response = await axios.patch(
        `${import.meta.env.VITE_API_BASE_URL}/retailer/update/${userId}/password`,
        { retailer_password: passwordData.retailer_password },
        { headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" } }
      );

      if (response.data.status === "success" || response.status === 200) {
        toast({ title: "Password Updated", description: "Your password has been changed successfully." });
        setPasswordData({ retailer_password: "", confirm_password: "" });
      } else {
        toast({ title: "Failed", description: response.data.message || "Failed to update password.", variant: "destructive" });
      }
    } catch (error: any) {
      toast({
        title: "Failed",
        description: error.response?.data?.message || "Failed to update password.",
        variant: "destructive",
      });
    } finally {
      setLoadingPassword(false);
    }
  };

  // ─── Change MPIN: PATCH /retailer/update/{retailer_id}/mpin ───
  const handleMpinUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mpinData.retailer_mpin || mpinData.retailer_mpin.length !== 4) {
      toast({ title: "Invalid MPIN", description: "MPIN must be exactly 4 digits.", variant: "destructive" });
      return;
    }

    const token = localStorage.getItem("authToken");
    try {
      setLoadingMpin(true);
      // PATCH /retailer/update/{retailer_id}/mpin
      const response = await axios.patch(
        `${import.meta.env.VITE_API_BASE_URL}/retailer/update/${userId}/mpin`,
        { retailer_mpin: parseInt(mpinData.retailer_mpin) },
        { headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" } }
      );

      if (response.data.status === "success" || response.status === 200) {
        toast({ title: "MPIN Updated", description: "Your MPIN has been changed successfully." });
        setMpinData({ retailer_mpin: "" });
      } else {
        toast({ title: "Failed", description: response.data.message || "Failed to update MPIN.", variant: "destructive" });
      }
    } catch (error: any) {
      toast({
        title: "Failed",
        description: error.response?.data?.message || "Failed to update MPIN.",
        variant: "destructive",
      });
    } finally {
      setLoadingMpin(false);
    }
  };

  if (fetchingProfile) {
    return (
      <div className="min-h-screen bg-background flex w-full">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <Header />
          <div className="flex items-center justify-center py-20">
            <div className="flex flex-col items-center gap-4">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
              <p className="text-muted-foreground">Loading profile data...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex w-full">
      <AppSidebar />

      <div className="flex-1 flex flex-col min-w-0">
        <Header />

        <main className="flex-1 p-6 space-y-6 overflow-auto">
          {/* Page Header */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="flex items-center gap-4 mb-2"
          >
            <Button variant="ghost" size="icon" onClick={() => navigate("/profile")} className="hover:bg-accent">
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-foreground">Update Profile</h1>
              <p className="text-sm text-muted-foreground mt-1">Manage your account details, password and MPIN</p>
            </div>
          </motion.div>

          {/* ── Profile Details Form ── */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.05 }}>
            <form onSubmit={handleSubmit}>
              <Card className="overflow-hidden rounded-2xl border border-border/60 shadow-xl mb-6">
                <CardHeader className="paybazaar-gradient rounded-none border-b border-white/20 text-white">
                  <CardTitle className="flex items-center gap-2 text-xl">
                    <User className="h-5 w-5" />
                    Profile Details
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-6 space-y-6">
                  {/* Avatar row */}
                  <div className="flex items-center gap-6">
                    <Avatar className="h-20 w-20 ring-4 ring-primary/20">
                      <AvatarImage src={profileImage} alt="Profile" />
                      <AvatarFallback className="text-xl bg-primary/10 text-primary">
                        {formData.retailer_name.split(" ").map((n) => n[0]).join("").toUpperCase() || "R"}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-semibold text-lg">{formData.retailer_name || "Retailer"}</p>
                      <p className="text-sm text-muted-foreground">{userId}</p>
                    </div>
                  </div>

                  {/* Personal */}
                  <div>
                    <h3 className="text-base font-semibold mb-3 flex items-center gap-2">
                      <User className="h-4 w-4 text-primary" /> Personal Info
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="retailer_name">Full Name *</Label>
                        <Input
                          id="retailer_name"
                          value={formData.retailer_name}
                          onChange={(e) => handleInputChange("retailer_name", e.target.value)}
                          className="mt-1"
                          required
                          placeholder="Enter your full name"
                        />
                      </div>
                      <div>
                        <Label htmlFor="retailer_email">Email Address *</Label>
                        <Input
                          id="retailer_email"
                          type="email"
                          value={formData.retailer_email}
                          onChange={(e) => handleInputChange("retailer_email", e.target.value)}
                          className="mt-1"
                          required
                          placeholder="Enter your email"
                        />
                      </div>
                      <div>
                        <Label htmlFor="retailer_phone">Mobile Number *</Label>
                        <Input
                          id="retailer_phone"
                          value={formData.retailer_phone}
                          onChange={(e) => handleInputChange("retailer_phone", e.target.value.replace(/\D/g, "").slice(0, 10))}
                          className="mt-1"
                          required
                          maxLength={10}
                          placeholder="10-digit mobile number"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Business */}
                  <div>
                    <h3 className="text-base font-semibold mb-3 flex items-center gap-2">
                      <Building2 className="h-4 w-4 text-primary" /> Business Info
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="retailer_business_name">Business Name</Label>
                        <Input
                          id="retailer_business_name"
                          value={formData.retailer_business_name}
                          onChange={(e) => handleInputChange("retailer_business_name", e.target.value)}
                          className="mt-1"
                          placeholder="Business name"
                        />
                      </div>
                      <div>
                        <Label htmlFor="retailer_business_type">Business Type</Label>
                        <Select
                          value={formData.retailer_business_type}
                          onValueChange={(v) => handleInputChange("retailer_business_type", v)}
                        >
                          <SelectTrigger className="mt-1">
                            <SelectValue placeholder="Select type" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Proprietorship">Proprietorship</SelectItem>
                            <SelectItem value="Partnership">Partnership</SelectItem>
                            <SelectItem value="Private Limited">Private Limited</SelectItem>
                            <SelectItem value="Public Limited">Public Limited</SelectItem>
                            <SelectItem value="LLP">LLP</SelectItem>
                            <SelectItem value="Other">Other</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label htmlFor="retailer_gst_number">GST Number</Label>
                        <Input
                          id="retailer_gst_number"
                          value={formData.retailer_gst_number}
                          onChange={(e) => handleInputChange("retailer_gst_number", e.target.value.toUpperCase())}
                          className="mt-1"
                          placeholder="GST number"
                          maxLength={15}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Address */}
                  <div>
                    <h3 className="text-base font-semibold mb-3 flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-primary" /> Address
                    </h3>
                    <div className="space-y-4">
                      <div>
                        <Label htmlFor="retailer_address">Complete Address</Label>
                        <Textarea
                          id="retailer_address"
                          value={formData.retailer_address}
                          onChange={(e) => handleInputChange("retailer_address", e.target.value)}
                          className="mt-1"
                          rows={3}
                          placeholder="Enter your complete address"
                        />
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                          <Label htmlFor="retailer_city">City</Label>
                          <Input
                            id="retailer_city"
                            value={formData.retailer_city}
                            onChange={(e) => handleInputChange("retailer_city", e.target.value)}
                            className="mt-1"
                            placeholder="City"
                          />
                        </div>
                        <div>
                          <Label htmlFor="retailer_state">State</Label>
                          <Input
                            id="retailer_state"
                            value={formData.retailer_state}
                            onChange={(e) => handleInputChange("retailer_state", e.target.value)}
                            className="mt-1"
                            placeholder="State"
                          />
                        </div>
                        <div>
                          <Label htmlFor="retailer_pincode">Pincode</Label>
                          <Input
                            id="retailer_pincode"
                            value={formData.retailer_pincode}
                            onChange={(e) => handleInputChange("retailer_pincode", e.target.value.replace(/\D/g, "").slice(0, 6))}
                            className="mt-1"
                            placeholder="Pincode"
                            maxLength={6}
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Submit */}
                  <div className="flex justify-end gap-3 pt-2">
                    <Button type="button" variant="outline" onClick={() => navigate("/profile")}>Cancel</Button>
                    <Button type="submit" className="paybazaar-gradient text-white" disabled={loading}>
                      <Save className="h-4 w-4 mr-2" />
                      {loading ? "Saving..." : "Save Changes"}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </form>
          </motion.div>

          {/* ── Change Password ── */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.1 }}>
            <form onSubmit={handlePasswordUpdate}>
              <Card className="overflow-hidden rounded-2xl border border-border/60 shadow-xl mb-6">
                <CardHeader className="paybazaar-gradient rounded-none border-b border-white/20 text-white">
                  <CardTitle className="flex items-center gap-2 text-xl">
                    <Lock className="h-5 w-5" />
                    Change Password
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="new_password">New Password *</Label>
                      <div className="relative mt-1">
                        <Input
                          id="new_password"
                          type={showPassword ? "text" : "password"}
                          value={passwordData.retailer_password}
                          onChange={(e) => setPasswordData((p) => ({ ...p, retailer_password: e.target.value }))}
                          placeholder="Enter new password"
                          required
                        />
                        <button
                          type="button"
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                          onClick={() => setShowPassword((v) => !v)}
                        >
                          {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                    </div>
                    <div>
                      <Label htmlFor="confirm_password">Confirm Password *</Label>
                      <div className="relative mt-1">
                        <Input
                          id="confirm_password"
                          type={showConfirm ? "text" : "password"}
                          value={passwordData.confirm_password}
                          onChange={(e) => setPasswordData((p) => ({ ...p, confirm_password: e.target.value }))}
                          placeholder="Confirm new password"
                          required
                        />
                        <button
                          type="button"
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                          onClick={() => setShowConfirm((v) => !v)}
                        >
                          {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">Minimum 8 characters. Include uppercase, lowercase, numbers and special characters.</p>
                  <div className="flex justify-end mt-4">
                    <Button type="submit" className="paybazaar-gradient text-white" disabled={loadingPassword}>
                      <Lock className="h-4 w-4 mr-2" />
                      {loadingPassword ? "Updating..." : "Update Password"}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </form>
          </motion.div>

          {/* ── Change MPIN ── */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.15 }}>
            <form onSubmit={handleMpinUpdate}>
              <Card className="overflow-hidden rounded-2xl border border-border/60 shadow-xl">
                <CardHeader className="paybazaar-gradient rounded-none border-b border-white/20 text-white">
                  <CardTitle className="flex items-center gap-2 text-xl">
                    <KeyRound className="h-5 w-5" />
                    Change MPIN
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-6">
                  <div className="max-w-xs">
                    <Label htmlFor="retailer_mpin">New MPIN (4 digits) *</Label>
                    <Input
                      id="retailer_mpin"
                      type="password"
                      inputMode="numeric"
                      value={mpinData.retailer_mpin}
                      onChange={(e) => setMpinData({ retailer_mpin: e.target.value.replace(/\D/g, "").slice(0, 4) })}
                      placeholder="Enter 4-digit MPIN"
                      maxLength={4}
                      className="mt-1 tracking-widest text-center text-xl"
                      required
                    />
                    <p className="text-xs text-muted-foreground mt-2">Your MPIN is used to authorize payout transactions.</p>
                  </div>
                  <div className="flex justify-end mt-4">
                    <Button type="submit" className="paybazaar-gradient text-white" disabled={loadingMpin || mpinData.retailer_mpin.length !== 4}>
                      <KeyRound className="h-4 w-4 mr-2" />
                      {loadingMpin ? "Updating..." : "Update MPIN"}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </form>
          </motion.div>
        </main>
      </div>
    </div>
  );
}