import { useState, useEffect } from "react";
import { Header } from "@/components/layout/Header";
import { AppSidebar } from "@/components/layout/AppSidebar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  ArrowLeft,
  CheckCircle,
  Mail,
  Phone,
  MapPin,
  Calendar,
  CreditCard,
  FileText,
  Eye,
  Download,
  Upload,
  XCircle,
  Building2,
  Wallet,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { jwtDecode } from "jwt-decode";
import { useToast } from "@/hooks/use-toast";
import { motion } from "framer-motion";

interface DecodedToken {
  user_id: string;
  exp: number;
}

const CLOUDFRONT_BASE = "https://d1wq5jtrql22ms.cloudfront.net/";

/**
 * Convert an S3 key (stored in DB) to a full CloudFront URL.
 * Handles:
 *   - null / undefined → returns null
 *   - already a full URL (http...) → returns as-is
 *   - S3 key like "documents/R000001/R000001_aadhar_xxx.png" → prepends CloudFront base
 */
const toCdnUrl = (key: string | null | undefined): string | null => {
  if (!key) return null;
  if (key.startsWith("http")) return key;
  const clean = key.startsWith("/") ? key.substring(1) : key;
  return `${CLOUDFRONT_BASE}${clean}`;
};

interface RetailerProfile {
  retailer_id: string;
  distributor_id: string;
  retailer_name: string;
  retailer_phone: string;
  retailer_email: string;
  retailer_aadhar_number: string;
  retailer_pan_number: string;
  retailer_date_of_birth: string;
  retailer_gender: string;
  retailer_city: string;
  retailer_state: string;
  retailer_address: string;
  retailer_pincode: string;
  retailer_business_name: string;
  retailer_business_type: string;
  retailer_gst_number: string;
  retailer_kyc_status: boolean;
  retailer_wallet_balance: number;
  is_retailer_blocked: boolean;
  retailer_aadhar_image: string | null;  // S3 key e.g. "documents/R000001/R000001_aadhar_xxx.png"
  retailer_pan_image: string | null;     // S3 key e.g. "documents/R000001/R000001_pan_xxx.png"
  retailer_image: string | null;         // S3 key e.g. "documents/R000001/R000001_image_xxx.png"
  created_at: string;
  updated_at: string;
}

interface UserInfo {
  name: string;
  userId: string;
  kycStatus: string;
  avatar: string;
  businessName: string;
  businessType: string;
  gstNumber: string;
  mobileNo: string;
  email: string;
  dateOfBirth: string;
  gender: string;
  aadhaarNumber: string;
  panNumber: string;
  city: string;
  state: string;
  pinCode: string;
  address: string;
  walletBalance: number;
  isBlocked: boolean;
  adminId: string;
  distributorId: string;
}

interface KYCDocument {
  name: string;
  url: string | null;   // ✅ always a full CloudFront URL or null
  uploaded: boolean;
  icon: any;
}

export default function Profile() {
  const navigate = useNavigate();
  const { toast } = useToast();

  const [userInfo, setUserInfo] = useState<UserInfo>({
    name: "",
    userId: "",
    kycStatus: "NOT VERIFIED",
    avatar: "/lovable-uploads/c0876286-fbc5-4e25-b7e8-cb81e868b3fe.png",
    businessName: "",
    businessType: "",
    gstNumber: "",
    mobileNo: "",
    email: "",
    dateOfBirth: "",
    gender: "",
    aadhaarNumber: "",
    panNumber: "",
    city: "",
    state: "",
    pinCode: "",
    address: "",
    walletBalance: 0,
    isBlocked: false,
    adminId: "",
    distributorId: "",
  });

  const [kycDocuments, setKycDocuments] = useState<KYCDocument[]>([
    { name: "Aadhaar Card", url: null, uploaded: false, icon: FileText },
    { name: "PAN Card", url: null, uploaded: false, icon: CreditCard },
    { name: "Profile Photo", url: null, uploaded: false, icon: FileText },
  ]);

  const [loading, setLoading] = useState(true);
  const [selectedDocument, setSelectedDocument] = useState<{ name: string; url: string } | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const formatDateForDisplay = (dateString: string): string => {
    if (!dateString) return "";
    try {
      const date = new Date(dateString);
      return `${String(date.getDate()).padStart(2, "0")}/${String(date.getMonth() + 1).padStart(2, "0")}/${date.getFullYear()}`;
    } catch { return ""; }
  };

  useEffect(() => {
    const fetchRetailerProfile = async () => {
      const token = localStorage.getItem("authToken");
      if (!token) {
        toast({ title: "Authentication Required", description: "Please log in to view your profile.", variant: "destructive" });
        navigate("/login");
        return;
      }

      try {
        setLoading(true);
        const decoded: DecodedToken = jwtDecode(token);

        if (!decoded.user_id) {
          toast({ title: "Error", description: "User ID not found. Please log in again.", variant: "destructive" });
          navigate("/login");
          return;
        }
        if (decoded.exp * 1000 < Date.now()) {
          localStorage.removeItem("authToken");
          toast({ title: "Session Expired", description: "Your session has expired. Please log in again.", variant: "destructive" });
          navigate("/login");
          return;
        }

        // ── Fetch retailer profile ──
        // API returns: { message: "...", retailer: { retailer_aadhar_image: "documents/...", ... } }
        const response = await axios.get(
          `${import.meta.env.VITE_API_BASE_URL}/retailer/get/${decoded.user_id}`,
          { headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" } }
        );

        if (response.data?.retailer) {
          const r: RetailerProfile = response.data.retailer;

          // ── Fetch wallet balance separately ──
          let walletBalance = r.retailer_wallet_balance ?? 0;
          try {
            const walletRes = await axios.get(
              `${import.meta.env.VITE_API_BASE_URL}/retailer/get/${decoded.user_id}/wallet`,
              { headers: { Authorization: `Bearer ${token}` } }
            );
            if (walletRes.data?.balance !== undefined) walletBalance = walletRes.data.balance;
          } catch { /* use profile balance */ }

          // ── Convert S3 keys → CloudFront URLs ──
          const aadharUrl = toCdnUrl(r.retailer_aadhar_image);
          const panUrl = toCdnUrl(r.retailer_pan_image);
          const profileUrl = toCdnUrl(r.retailer_image);

          setUserInfo({
            name: r.retailer_name,
            userId: r.retailer_id,
            kycStatus: r.retailer_kyc_status ? "VERIFIED" : "NOT VERIFIED",
            // Profile image via CloudFront; fallback to placeholder if not uploaded
            avatar: profileUrl ?? "/lovable-uploads/c0876286-fbc5-4e25-b7e8-cb81e868b3fe.png",
            businessName: r.retailer_business_name,
            businessType: r.retailer_business_type,
            gstNumber: r.retailer_gst_number || "Not Provided",
            mobileNo: r.retailer_phone,
            email: r.retailer_email,
            dateOfBirth: formatDateForDisplay(r.retailer_date_of_birth),
            gender: r.retailer_gender,
            aadhaarNumber: r.retailer_aadhar_number,
            panNumber: r.retailer_pan_number,
            city: r.retailer_city,
            state: r.retailer_state,
            pinCode: r.retailer_pincode,
            address: r.retailer_address,
            walletBalance,
            isBlocked: r.is_retailer_blocked,
            adminId: "",
            distributorId: r.distributor_id,
          });

          // ✅ KYC documents — convert S3 keys to CloudFront URLs here
          setKycDocuments([
            {
              name: "Aadhaar Card",
              url: aadharUrl,            // full CloudFront URL or null
              uploaded: !!aadharUrl,
              icon: FileText,
            },
            {
              name: "PAN Card",
              url: panUrl,               // full CloudFront URL or null
              uploaded: !!panUrl,
              icon: CreditCard,
            },
            {
              name: "Profile Photo",
              url: profileUrl,           // full CloudFront URL or null
              uploaded: !!profileUrl,
              icon: FileText,
            },
          ]);
        } else {
          toast({ title: "Error", description: "Failed to load profile data.", variant: "destructive" });
        }
      } catch (error: any) {
        console.error("Error fetching profile:", error);
        let errorMessage = "Failed to load profile data.";
        if (error.response?.status === 401) {
          errorMessage = "Session expired. Please log in again.";
          localStorage.removeItem("authToken");
          setTimeout(() => navigate("/login"), 2000);
        } else if (error.response?.status === 404) {
          errorMessage = "Profile not found.";
        } else if (error.response?.data?.message) {
          errorMessage = error.response.data.message;
        }
        toast({ title: "Error", description: errorMessage, variant: "destructive" });
      } finally {
        setLoading(false);
      }
    };

    fetchRetailerProfile();
  }, [navigate, toast]);

  const handleViewDocument = (doc: KYCDocument) => {
    if (doc.url) {
      setSelectedDocument({ name: doc.name, url: doc.url });
      setIsModalOpen(true);
    }
  };

  const handleDownloadDocument = (url: string, filename: string) => {
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const infoSections = [
    {
      title: "Contact Information",
      icon: Phone,
      items: [
        { label: "Mobile No", value: userInfo.mobileNo, icon: Phone },
        { label: "Email", value: userInfo.email, icon: Mail },
      ],
    },
    {
      title: "Business Details",
      icon: Building2,
      items: [
        { label: "Business Name", value: userInfo.businessName, icon: Building2 },
        { label: "Business Type", value: userInfo.businessType },
        { label: "GST Number", value: userInfo.gstNumber },
      ],
    },
    {
      title: "Personal Details",
      icon: Calendar,
      items: [
        { label: "Date of Birth", value: userInfo.dateOfBirth, icon: Calendar },
        { label: "Gender", value: userInfo.gender },
      ],
    },
    {
      title: "Verification Details",
      icon: CreditCard,
      items: [
        { label: "Aadhaar Number", value: userInfo.aadhaarNumber, icon: CreditCard },
        { label: "PAN Number", value: userInfo.panNumber, icon: CreditCard },
        { label: "KYC Status", value: userInfo.kycStatus, isStatus: true },
      ],
    },
    {
      title: "Address Information",
      icon: MapPin,
      items: [
        { label: "City", value: userInfo.city, icon: MapPin },
        { label: "State", value: userInfo.state },
        { label: "Pin Code", value: userInfo.pinCode },
        { label: "Address", value: userInfo.address, fullWidth: true },
      ],
    },
    {
      title: "Account Information",
      icon: Wallet,
      items: [
        { label: "Distributor ID", value: userInfo.distributorId },
        {
          label: "Wallet Balance",
          value: `₹${userInfo.walletBalance.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
          icon: Wallet,
        },
        {
          label: "Account Status",
          value: userInfo.isBlocked ? "BLOCKED" : "ACTIVE",
          isStatus: true,
        },
      ],
    },
  ];

  return (
    <div className="min-h-screen bg-background flex w-full">
      <AppSidebar />

      <div className="flex-1 flex flex-col min-w-0">
        <Header />

        <main className="flex-1 p-6 space-y-6 overflow-auto">
          {/* Page header */}
          <div className="flex items-center gap-4 mb-6">
            <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")} className="hover:bg-accent">
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h1 className="text-2xl font-bold text-foreground">Profile Overview</h1>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="flex flex-col items-center gap-4">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
                <p className="text-muted-foreground">Loading profile data...</p>
              </div>
            </div>
          ) : (
            <>
              {/* Profile Hero */}
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
                <Card className="paybazaar-gradient border-0">
                  <CardContent className="p-8">
                    <div className="flex flex-col md:flex-row items-start md:items-center gap-6">
                      <Avatar className="h-24 w-24 ring-4 ring-white/20">
                        {/* ✅ Avatar src is now a proper CloudFront URL */}
                        <AvatarImage src={userInfo.avatar} alt={userInfo.name} />
                        <AvatarFallback className="text-2xl bg-white/10 text-white">
                          {userInfo.name.split(" ").map((n) => n[0]).join("")}
                        </AvatarFallback>
                      </Avatar>

                      <div className="flex-1 space-y-3">
                        <div>
                          <h2 className="text-3xl font-bold text-white mb-2">{userInfo.name}</h2>
                          <div className="flex items-center gap-3 flex-wrap">
                            <span className="text-white/90 text-lg">{userInfo.userId}</span>
                            <Badge
                              variant="secondary"
                              className={userInfo.kycStatus === "VERIFIED"
                                ? "bg-green-500/20 text-green-100 border-green-400/30"
                                : "bg-yellow-500/20 text-yellow-100 border-yellow-400/30"
                              }
                            >
                              <CheckCircle className="h-3 w-3 mr-1" />
                              {userInfo.kycStatus}
                            </Badge>
                            {userInfo.isBlocked && (
                              <Badge variant="secondary" className="bg-red-500/20 text-red-100 border-red-400/30">
                                <XCircle className="h-3 w-3 mr-1" />BLOCKED
                              </Badge>
                            )}
                          </div>
                          {userInfo.businessName && (
                            <p className="text-white/80 text-sm mt-2">{userInfo.businessName}</p>
                          )}
                        </div>

                        <div className="flex items-center gap-4">
                          <div className="bg-white/10 px-4 py-2 rounded-lg">
                            <p className="text-white/70 text-xs">Wallet Balance</p>
                            <p className="text-white font-bold text-lg">
                              ₹{userInfo.walletBalance.toLocaleString("en-IN")}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>

              {/* KYC Documents */}
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.1 }}>
                <Card className="overflow-hidden rounded-2xl border border-border/60 shadow-xl">
                  <CardHeader className="paybazaar-gradient rounded-none border-b border-border/40 text-white">
                    <CardTitle className="flex items-center gap-2 text-xl font-semibold">
                      <FileText className="h-5 w-5" />
                      KYC Documents
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {kycDocuments.map((doc, index) => (
                        <motion.div
                          key={index}
                          initial={{ opacity: 0, scale: 0.9 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ duration: 0.3, delay: index * 0.1 }}
                        >
                          <Card className={`overflow-hidden transition-all duration-200 ${doc.uploaded
                              ? "hover:shadow-lg border-green-200 bg-green-50/30"
                              : "border-slate-200 bg-slate-50"
                            }`}>
                            <CardContent className="p-4">
                              <div className="flex items-start justify-between mb-3">
                                <div className="flex items-center gap-2">
                                  <div className={`p-2 rounded-lg ${doc.uploaded ? "bg-green-100" : "bg-slate-100"}`}>
                                    <doc.icon className={`h-5 w-5 ${doc.uploaded ? "text-green-600" : "text-slate-400"}`} />
                                  </div>
                                  <h3 className="text-sm font-semibold text-slate-700">{doc.name}</h3>
                                </div>
                                {doc.uploaded
                                  ? <CheckCircle className="h-5 w-5 text-green-600" />
                                  : <XCircle className="h-5 w-5 text-slate-400" />
                                }
                              </div>

                              {/* ✅ Thumbnail preview when document is uploaded */}
                              {doc.uploaded && doc.url && (
                                <div className="mb-3 rounded-lg overflow-hidden border border-gray-200 bg-gray-50">
                                  <img
                                    src={doc.url}
                                    alt={doc.name}
                                    className="w-full h-24 object-contain"
                                    onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                                  />
                                </div>
                              )}

                              <div className="space-y-2">
                                {doc.uploaded ? (
                                  <>
                                    <Badge className="w-full justify-center bg-green-100 text-green-700 hover:bg-green-200">
                                      Uploaded
                                    </Badge>
                                    <div className="flex gap-2">
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        className="flex-1 text-xs"
                                        onClick={() => handleViewDocument(doc)}
                                      >
                                        <Eye className="h-3 w-3 mr-1" />View
                                      </Button>
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        className="flex-1 text-xs"
                                        onClick={() => handleDownloadDocument(doc.url!, `${doc.name}.jpg`)}
                                      >
                                        <Download className="h-3 w-3 mr-1" />Download
                                      </Button>
                                    </div>
                                  </>
                                ) : (
                                  <>
                                    <Badge className="w-full justify-center bg-slate-100 text-slate-600 hover:bg-slate-200">
                                      Not Uploaded
                                    </Badge>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="w-full text-xs"
                                      onClick={() => navigate("/documents")}
                                    >
                                      <Upload className="h-3 w-3 mr-1" />Upload Now
                                    </Button>
                                  </>
                                )}
                              </div>
                            </CardContent>
                          </Card>
                        </motion.div>
                      ))}
                    </div>

                    {kycDocuments.some((doc) => !doc.uploaded) && (
                      <div className="mt-6 flex justify-center">
                        <Button onClick={() => navigate("/documents")} className="paybazaar-gradient text-white">
                          <Upload className="h-4 w-4 mr-2" />Upload Missing Documents
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </motion.div>

              {/* Info Sections */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.2 }}
                className="grid grid-cols-1 lg:grid-cols-2 gap-6"
              >
                {infoSections.map((section, sectionIndex) => (
                  <Card key={sectionIndex} className="hover:shadow-lg transition-shadow duration-200">
                    <CardHeader className="pb-4">
                      <CardTitle className="flex items-center gap-2 text-lg">
                        <section.icon className="h-5 w-5 text-primary" />
                        {section.title}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {section.items.map((item, itemIndex) => (
                        <div key={itemIndex} className={item.fullWidth ? "col-span-full" : ""}>
                          <div className="flex items-start gap-3">
                            {item.icon && <item.icon className="h-4 w-4 text-muted-foreground mt-1 flex-shrink-0" />}
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-muted-foreground mb-1">{item.label}</p>
                              {item.isStatus ? (
                                <Badge
                                  variant="secondary"
                                  className={
                                    item.value === "VERIFIED" || item.value === "ACTIVE"
                                      ? "bg-green-50 text-green-700 border-green-200"
                                      : item.value === "BLOCKED"
                                        ? "bg-red-50 text-red-700 border-red-200"
                                        : "bg-yellow-50 text-yellow-700 border-yellow-200"
                                  }
                                >
                                  <CheckCircle className="h-3 w-3 mr-1" />
                                  {item.value}
                                </Badge>
                              ) : (
                                <p className="text-sm text-foreground font-medium break-words">
                                  {item.value || "Not Provided"}
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                ))}
              </motion.div>

              {/* Account Actions */}
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.3 }}>
                <Card>
                  <CardHeader><CardTitle>Account Actions</CardTitle></CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <Button variant="outline" className="justify-start" onClick={() => navigate("/documents")}>
                        <Upload className="h-4 w-4 mr-2" />Upload Documents
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            </>
          )}
        </main>
      </div>

      {/* Document View Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              {selectedDocument?.name}
            </DialogTitle>
          </DialogHeader>
          {selectedDocument && (
            <div className="space-y-4">
              <div className="relative rounded-lg overflow-hidden border border-border bg-slate-50">
                {/* ✅ Image src is already a full CloudFront URL */}
                <img
                  src={selectedDocument.url}
                  alt={selectedDocument.name}
                  className="w-full h-auto object-contain"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = "/placeholder.png";
                  }}
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => handleDownloadDocument(selectedDocument.url, `${selectedDocument.name}.jpg`)}>
                  <Download className="h-4 w-4 mr-2" />Download
                </Button>
                <Button onClick={() => setIsModalOpen(false)}>Close</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}