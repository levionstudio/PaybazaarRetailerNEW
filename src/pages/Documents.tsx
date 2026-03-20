import { useState, useEffect } from "react";
import { AppSidebar } from "@/components/layout/AppSidebar";
import { Header } from "@/components/layout/Header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowLeft,
  Upload,
  FileText,
  CheckCircle2,
  X,
  Loader2,
  Eye,
  CreditCard,
  User,
  Info,
  AlertCircle,
  CheckCircle,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { jwtDecode } from "jwt-decode";

const CLOUDFRONT_BASE = import.meta.env.VITE_CLOUDFRONT_URL;

interface DocumentState {
  file: File | null;
  preview: string | null;
  uploading: boolean;
  uploaded: boolean;
  existingUrl: string | null;
}

interface LogEntry {
  msg: string;
  type: "info" | "success" | "error";
  time: string;
}

const initDoc = (): DocumentState => ({
  file: null,
  preview: null,
  uploading: false,
  uploaded: false,
  existingUrl: null,
});

// Convert S3 path stored in DB → CloudFront URL
const toCloudFrontUrl = (key: string | null | undefined): string | null => {
  if (!key) return null;
  if (key.startsWith("http")) return key; // already a full URL
  const clean = key.startsWith("/") ? key.substring(1) : key;
  return `${CLOUDFRONT_BASE}${clean}`;
};

const MyDocuments = () => {
  const navigate = useNavigate();
  const { toast } = useToast();

  const [retailerId, setRetailerId] = useState("");
  const [token, setToken] = useState("");
  const [loadingProfile, setLoadingProfile] = useState(true);

  const [aadhar, setAadhar] = useState<DocumentState>(initDoc());
  const [pan, setPan] = useState<DocumentState>(initDoc());
  const [profileImg, setProfileImg] = useState<DocumentState>(initDoc());

  // Process log state — shown below the cards
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [activeDoc, setActiveDoc] = useState<string | null>(null); // which doc is being uploaded

  const addLog = (msg: string, type: "info" | "success" | "error" = "info") => {
    const time = new Date().toLocaleTimeString("en-IN", { hour12: false });
    setLogs((prev) => [...prev, { msg, type, time }]);
  };

  // ── Decode token & fetch existing images ──
  useEffect(() => {
    const t = localStorage.getItem("authToken");
    if (!t) { navigate("/login"); return; }
    setToken(t);

    try {
      const decoded = jwtDecode<{ user_id: string; exp: number }>(t);
      if (!decoded.user_id || decoded.exp * 1000 < Date.now()) {
        localStorage.removeItem("authToken");
        navigate("/login");
        return;
      }
      setRetailerId(decoded.user_id);

      // Fetch existing document URLs from retailer profile
      axios
        .get(`${import.meta.env.VITE_API_BASE_URL}/retailer/get/${decoded.user_id}`, {
          headers: { Authorization: `Bearer ${t}` },
        })
        .then((res) => {
          const r = res.data?.retailer;
          if (r) {
            setAadhar((p) => ({ ...p, existingUrl: toCloudFrontUrl(r.retailer_aadhar_image) }));
            setPan((p) => ({ ...p, existingUrl: toCloudFrontUrl(r.retailer_pan_image) }));
            setProfileImg((p) => ({ ...p, existingUrl: toCloudFrontUrl(r.retailer_image) }));
          }
        })
        .catch(console.error)
        .finally(() => setLoadingProfile(false));
    } catch {
      localStorage.removeItem("authToken");
      navigate("/login");
    }
  }, [navigate]);

  // ── File selection & validation ──
  const handleFileSelect = (
    e: React.ChangeEvent<HTMLInputElement>,
    setter: React.Dispatch<React.SetStateAction<DocumentState>>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validTypes = ["image/jpeg", "image/jpg", "image/png"];
    if (!validTypes.includes(file.type)) {
      toast({ title: "Invalid File Type", description: "Please upload JPG or PNG only.", variant: "destructive" });
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: "File Too Large", description: "Max file size is 5MB.", variant: "destructive" });
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      setter((p) => ({ ...p, file, preview: reader.result as string, uploaded: false }));
    };
    reader.readAsDataURL(file);
    e.target.value = ""; // allow re-selection of same file
  };

  // ── Main upload function ──
  // Flow:
  //   1. PATCH /retailer/update/{id}/{endpoint}  → backend generates presigned URL & saves path to DB
  //   2. PUT to presigned S3 URL with file binary
  //   3. Build CloudFront URL from the S3 key in the presigned URL
  const uploadDocument = async (
    docLabel: string,           // e.g. "Aadhaar Card"
    endpoint: string,           // e.g. "aadhar" | "pan" | "image"
    docState: DocumentState,
    setter: React.Dispatch<React.SetStateAction<DocumentState>>
  ) => {
    if (!docState.file) {
      toast({ title: "No file selected", description: "Please choose a file first.", variant: "destructive" });
      return;
    }
    if (!retailerId) {
      toast({ title: "Error", description: "User ID not found. Please login again.", variant: "destructive" });
      return;
    }

    // Clear logs and mark which doc is uploading
    setLogs([]);
    setActiveDoc(docLabel);
    setter((p) => ({ ...p, uploading: true }));

    try {
      // ── STEP 1: Get presigned URL from backend ──
      // Backend: saves path "documents/{id}/{id}_aadhar_{ts}.png" to DB
      //          returns { url: "https://s3.amazonaws.com/...?X-Amz-..." }
      addLog(`[1/3] Requesting presigned upload URL for ${docLabel}...`, "info");

      const presignRes = await axios.patch(
        `${import.meta.env.VITE_API_BASE_URL}/retailer/update/${retailerId}/${endpoint}`,
        {},  // empty body — backend only needs the retailer ID from the URL
        { headers: { Authorization: `Bearer ${token}` } }
      );

      const presignedUrl: string = presignRes.data?.url;
      if (!presignedUrl) {
        throw new Error("Backend did not return a presigned URL. Check the endpoint.");
      }

      addLog(`[1/3] ✓ Presigned URL received from server.`, "success");

      // ── STEP 2: Upload file directly to S3 using presigned URL ──
      // Must use PUT (not POST), Content-Type must match file type
      // No Authorization header — the presigned URL already encodes auth
      addLog(`[2/3] Uploading ${docState.file.name} (${(docState.file.size / 1024).toFixed(1)} KB) to S3...`, "info");

      await axios.put(presignedUrl, docState.file, {
        headers: {
          "Content-Type": docState.file.type,
          // ⚠ Do NOT send Authorization here — S3 presigned URLs don't want it
        },
        onUploadProgress: (progressEvent) => {
          const pct = Math.round((progressEvent.loaded * 100) / (progressEvent.total ?? 1));
          if (pct === 25 || pct === 50 || pct === 75 || pct === 100) {
            addLog(`[2/3] Upload progress: ${pct}%`, "info");
          }
        },
      });

      addLog(`[2/3] ✓ File uploaded to S3 successfully.`, "success");

      // ── STEP 3: Build CloudFront URL ──
      // The S3 presigned URL format:
      //   https://{bucket}.s3.{region}.amazonaws.com/{key}?X-Amz-...
      // We extract the path after the bucket host to get the key,
      // then serve it via CloudFront.
      addLog(`[3/3] Building CloudFront URL for the uploaded document...`, "info");

      // Extract S3 key from presigned URL
      // e.g. "https://bucket.s3.ap-south-1.amazonaws.com/documents/R001/R001_aadhar_1234567890.png?..."
      const urlWithoutParams = presignedUrl.split("?")[0]; // strip query params
      const s3UrlObj = new URL(urlWithoutParams);
      // pathname = "/documents/R001/R001_aadhar_1234567890.png"
      const s3Key = s3UrlObj.pathname.startsWith("/")
        ? s3UrlObj.pathname.substring(1)   // remove leading slash
        : s3UrlObj.pathname;               // "documents/R001/R001_aadhar_1234567890.png"

      const cloudFrontUrl = `${CLOUDFRONT_BASE}${s3Key}`;
      addLog(`[3/3] ✓ Document available at CloudFront CDN.`, "success");
      addLog(`Done! ${docLabel} has been updated successfully.`, "success");

      // Update state — show new image immediately
      setter((p) => ({
        ...p,
        uploaded: true,
        uploading: false,
        existingUrl: cloudFrontUrl,
        file: null,
        preview: null,
      }));

      toast({ title: "Upload Successful", description: `${docLabel} has been updated.` });

    } catch (error: any) {
      setter((p) => ({ ...p, uploading: false }));

      const errMsg =
        error.response?.data?.message ||
        error.message ||
        "Unknown error occurred";

      addLog(`✗ Upload failed: ${errMsg}`, "error");
      toast({ title: "Upload Failed", description: errMsg, variant: "destructive" });
    } finally {
      // Keep activeDoc set so logs remain visible
    }
  };

  // ── Reusable Document Card ──
  const DocumentCard = ({
    title,
    icon: Icon,
    doc,
    setter,
    inputId,
    endpoint,
    colSpan,
  }: {
    title: string;
    icon: React.ElementType;
    doc: DocumentState;
    setter: React.Dispatch<React.SetStateAction<DocumentState>>;
    inputId: string;
    endpoint: string;
    colSpan?: boolean;
  }) => {
    const displayUrl = doc.preview ?? doc.existingUrl;
    const isUploaded = !!doc.existingUrl;

    return (
      <div className={colSpan ? "lg:col-span-2" : ""}>
        <Card className="overflow-hidden h-full border-gray-200">
          {/* Card Header */}
          <CardHeader className="bg-gray-50 border-b px-6 py-4">
            <CardTitle className="flex items-center justify-between">
              <span className="flex items-center gap-2 text-sm font-bold text-gray-900">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100">
                  <Icon className="h-4 w-4 text-blue-600" />
                </div>
                {title}
              </span>
              {isUploaded && !doc.file ? (
                <Badge className="bg-green-50 text-green-700 border-green-200 text-xs">
                  <CheckCircle2 className="h-3 w-3 mr-1" /> Uploaded
                </Badge>
              ) : !isUploaded && !doc.file ? (
                <Badge className="bg-yellow-50 text-yellow-700 border-yellow-200 text-xs">
                  Not Uploaded
                </Badge>
              ) : null}
            </CardTitle>
          </CardHeader>

          <CardContent className="p-6 space-y-4">
            {/* Image preview or drop zone */}
            {displayUrl ? (
              <div className="relative rounded-xl overflow-hidden border border-gray-200 bg-gray-50">
                <img
                  src={displayUrl}
                  alt={title}
                  className="w-full h-48 object-contain"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = "none";
                  }}
                />
                {doc.file && (
                  <div className="absolute top-2 right-2">
                    <Badge className="bg-blue-600 text-white text-xs">New — Not saved yet</Badge>
                  </div>
                )}
                {doc.existingUrl && !doc.file && (
                  <a href={doc.existingUrl} target="_blank" rel="noopener noreferrer" className="absolute bottom-2 right-2">
                    <Button size="sm" variant="secondary" className="text-xs gap-1">
                      <Eye className="h-3 w-3" /> View Full
                    </Button>
                  </a>
                )}
              </div>
            ) : (
              !doc.file && (
                <label
                  htmlFor={inputId}
                  className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-gray-300 bg-gray-50 p-8 transition-all hover:border-blue-400 hover:bg-blue-50/30"
                >
                  <Upload className="mb-3 h-10 w-10 text-gray-400" />
                  <span className="mb-1 text-sm font-semibold text-gray-700">Click to select file</span>
                  <span className="text-xs text-gray-500">JPG or PNG — max 5MB</span>
                </label>
              )
            )}

            {/* Hidden file input */}
            <Input
              id={inputId}
              type="file"
              accept="image/jpeg,image/jpg,image/png"
              onChange={(e) => handleFileSelect(e, setter)}
              className="hidden"
            />

            {/* Action row */}
            <div className="flex items-center gap-3 flex-wrap">
              <Label
                htmlFor={inputId}
                className="cursor-pointer inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 text-sm font-medium transition-colors"
              >
                <Upload className="h-4 w-4" />
                {doc.existingUrl ? "Replace" : "Choose File"}
              </Label>

              {doc.file && (
                <>
                  <span className="text-sm text-gray-500 truncate max-w-[140px]">{doc.file.name}</span>
                  <Button
                    size="sm"
                    onClick={() => uploadDocument(title, endpoint, doc, setter)}
                    disabled={doc.uploading}
                    className="bg-blue-600 hover:bg-blue-700 text-white gap-2"
                  >
                    {doc.uploading ? (
                      <><Loader2 className="h-4 w-4 animate-spin" />Uploading...</>
                    ) : (
                      <><Upload className="h-4 w-4" />Upload</>
                    )}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-red-600 hover:bg-red-50"
                    onClick={() => setter((p) => ({ ...p, file: null, preview: null }))}
                    disabled={doc.uploading}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  };

  return (
    <div className="flex min-h-screen w-full bg-background">
      <AppSidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Header />
        <main className="flex-1 p-6 space-y-6 overflow-auto">

          {/* Page header */}
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="hover:bg-accent">
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold">My Documents</h1>
              <p className="text-sm text-muted-foreground mt-0.5">Upload your KYC and profile documents</p>
            </div>
          </div>

          {loadingProfile ? (
            <div className="flex items-center justify-center py-20">
              <div className="flex flex-col items-center gap-4">
                <Loader2 className="h-10 w-10 animate-spin text-primary" />
                <p className="text-muted-foreground">Loading existing documents...</p>
              </div>
            </div>
          ) : (
            <>
              {/* Document Cards */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <DocumentCard
                  title="Aadhaar Card"
                  icon={FileText}
                  doc={aadhar}
                  setter={setAadhar}
                  inputId="aadhar-upload"
                  endpoint="aadhar"
                />
                <DocumentCard
                  title="PAN Card"
                  icon={CreditCard}
                  doc={pan}
                  setter={setPan}
                  inputId="pan-upload"
                  endpoint="pan"
                />
                <DocumentCard
                  title="Profile Photo"
                  icon={User}
                  doc={profileImg}
                  setter={setProfileImg}
                  inputId="profile-upload"
                  endpoint="image"
                  colSpan
                />
              </div>

              {/* Upload Process Log — shown when uploading or after upload */}
              {logs.length > 0 && (
                <Card className="border-gray-200">
                  <CardHeader className="bg-gray-50 border-b px-6 py-4">
                    <CardTitle className="flex items-center gap-2 text-sm font-bold text-gray-900">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100">
                        <Info className="h-4 w-4 text-blue-600" />
                      </div>
                      Upload Process Log
                      {activeDoc && <span className="text-gray-500 font-normal ml-1">— {activeDoc}</span>}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    <div className="divide-y divide-gray-100">
                      {logs.map((log, i) => (
                        <div key={i} className={`flex items-start gap-3 px-6 py-3 text-sm ${log.type === "success" ? "bg-green-50/40" :
                            log.type === "error" ? "bg-red-50/40" :
                              "bg-white"
                          }`}>
                          <span className="text-xs text-gray-400 font-mono whitespace-nowrap mt-0.5 min-w-[60px]">
                            {log.time}
                          </span>
                          {log.type === "success" ? (
                            <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                          ) : log.type === "error" ? (
                            <AlertCircle className="h-4 w-4 text-red-600 mt-0.5 flex-shrink-0" />
                          ) : (
                            <Info className="h-4 w-4 text-blue-500 mt-0.5 flex-shrink-0" />
                          )}
                          <span className={
                            log.type === "success" ? "text-green-800" :
                              log.type === "error" ? "text-red-800" :
                                "text-gray-700"
                          }>
                            {log.msg}
                          </span>
                        </div>
                      ))}
                    </div>

                    {/* Clear logs button */}
                    <div className="px-6 py-3 border-t bg-gray-50">
                      <Button variant="ghost" size="sm" className="text-xs text-gray-500" onClick={() => { setLogs([]); setActiveDoc(null); }}>
                        Clear Log
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Document Requirements */}
              <Card className="border-gray-200">
                <CardContent className="p-6">
                  <h3 className="text-sm font-bold text-gray-900 mb-3">Document Requirements</h3>
                  <ul className="space-y-2 text-sm text-muted-foreground">
                    {[
                      "Upload clear, front-facing images of your documents.",
                      "Accepted formats: JPG, PNG — maximum 5MB per file.",
                      "All text and numbers must be clearly visible.",
                      "KYC documents will be verified within 24–48 hours.",
                      "Profile photo should show your face clearly.",
                    ].map((tip, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <CheckCircle2 className="h-4 w-4 mt-0.5 text-green-600 flex-shrink-0" />
                        <span>{tip}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            </>
          )}
        </main>
      </div>
    </div>
  );
};

export default MyDocuments;