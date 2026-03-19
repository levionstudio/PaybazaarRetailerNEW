import { useEffect, useState } from "react";
import { AppSidebar } from "@/components/layout/AppSidebar";
import { Header } from "@/components/layout/Header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Eye, EyeOff, Shield } from "lucide-react";
import axios from "axios";
import { jwtDecode } from "jwt-decode";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

// Get auth headers
const getAuthHeaders = () => {
  const token = localStorage.getItem("authToken");
  return {
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  };
};

const ChangePasswordMpin = () => {
  const { toast } = useToast();
  const [retailerId, setRetailerId] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  // MPIN form state — API only needs the new MPIN
  const [mpinForm, setMpinForm] = useState({
    newMpin: "",
    confirmMpin: "",
  });
  const [showNewMpin, setShowNewMpin] = useState(false);
  const [showConfirmMpin, setShowConfirmMpin] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem("authToken");
    if (!token) {
      toast({
        title: "Authentication Error",
        description: "Please login again",
        variant: "destructive",
      });
      return;
    }

    try {
      const decoded = jwtDecode<{ user_id: string; exp: number }>(token);
      const userId = decoded.user_id;
      
      if (!userId) {
        toast({
          title: "Error",
          description: "Unable to identify user. Please login again.",
          variant: "destructive",
        });
        return;
      }
      
      setRetailerId(userId);
    } catch (error) {
      console.error("Error decoding JWT:", error);
      toast({
        title: "Error",
        description: "Session expired. Please login again.",
        variant: "destructive",
      });
    }
  }, [toast]);

  // Handle MPIN Change
  const handleMpinChange = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!retailerId) {
      toast({
        title: "Error",
        description: "User ID not found. Please login again.",
        variant: "destructive",
      });
      return;
    }

    if (mpinForm.newMpin !== mpinForm.confirmMpin) {
      toast({ title: "Error", description: "New MPIN and confirm MPIN do not match", variant: "destructive" });
      return;
    }

    if (mpinForm.newMpin.length !== 4 || !/^\d+$/.test(mpinForm.newMpin)) {
      toast({ title: "Error", description: "MPIN must be exactly 4 digits", variant: "destructive" });
      return;
    }

    setIsLoading(true);

    try {
      const newMpinInt = parseInt(mpinForm.newMpin, 10);

      // PATCH /retailer/update/{retailer_id}/mpin  →  { retailer_mpin: number }
      const response = await axios.patch(
        `${API_BASE_URL}/retailer/update/${retailerId}/mpin`,
        { retailer_mpin: newMpinInt },
        getAuthHeaders()
      );

      if (response.status === 200 || response.data?.message) {
        toast({ title: "Success", description: "MPIN changed successfully" });
        setMpinForm({ newMpin: "", confirmMpin: "" });
      }
    } catch (error: any) {
      let errorMessage = "Failed to change MPIN. Please try again.";
      if (error.response?.status === 400) errorMessage = error.response?.data?.message || "Invalid MPIN provided";
      else if (error.response?.status === 401) errorMessage = "Unauthorized. Please login again.";
      else if (error.response?.status === 404) errorMessage = "Retailer not found.";
      else if (error.response?.data?.message) errorMessage = error.response.data.message;
      toast({ title: "Error", description: errorMessage, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen w-full bg-background">
      <AppSidebar />

      <div className="flex-1 flex flex-col min-w-0">
        <Header />

        <div className="flex-1 p-6 overflow-y-auto">
          <div className="max-w-2xl mx-auto space-y-8">
            {/* MPIN Change Card */}
            <Card className="shadow-lg border-border/50">
              <CardHeader className="paybazaar-gradient text-white rounded-t-xl space-y-1 pb-6">
                <CardTitle className="flex items-center gap-2 text-xl">
                  <Shield className="w-5 h-5" />
                  Change MPIN
                </CardTitle>
                <p className="text-sm text-white/90">
                  Enter your current MPIN and create a new 4-digit MPIN
                </p>
              </CardHeader>

              <CardContent className="pt-6 pb-8 px-6">
                <form onSubmit={handleMpinChange} className="space-y-6">

                  {/* New MPIN */}
                  <div className="space-y-2">
                    <Label htmlFor="newMpin" className="text-sm font-medium text-foreground">
                      New MPIN <span className="text-red-500">*</span>
                    </Label>
                    <div className="relative">
                      <Input
                        id="newMpin"
                        type={showNewMpin ? "text" : "password"}
                        placeholder="••••"
                        value={mpinForm.newMpin}
                        onChange={(e) => {
                          const value = e.target.value.replace(/\D/g, "");
                          if (value.length <= 4) setMpinForm({ ...mpinForm, newMpin: value });
                        }}
                        maxLength={4}
                        inputMode="numeric"
                        required
                        disabled={isLoading}
                        className="h-12 text-center tracking-[0.5em] text-lg font-semibold pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowNewMpin(!showNewMpin)}
                        disabled={isLoading}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
                      >
                        {showNewMpin ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                    {mpinForm.newMpin.length > 0 && mpinForm.newMpin.length < 4 && (
                      <p className="text-xs text-amber-600">MPIN must be 4 digits ({mpinForm.newMpin.length}/4)</p>
                    )}
                  </div>

                  {/* Confirm MPIN */}
                  <div className="space-y-2">
                    <Label
                      htmlFor="confirmMpin"
                      className="text-sm font-medium text-foreground"
                    >
                      Confirm New MPIN <span className="text-red-500">*</span>
                    </Label>
                    <div className="relative">
                      <Input
                        id="confirmMpin"
                        type={showConfirmMpin ? "text" : "password"}
                        placeholder="••••"
                        value={mpinForm.confirmMpin}
                        onChange={(e) => {
                          const value = e.target.value.replace(/\D/g, "");
                          if (value.length <= 4) {
                            setMpinForm({
                              ...mpinForm,
                              confirmMpin: value,
                            });
                          }
                        }}
                        maxLength={4}
                        inputMode="numeric"
                        required
                        disabled={isLoading}
                        className="h-12 text-center tracking-[0.5em] text-lg font-semibold pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmMpin(!showConfirmMpin)}
                        disabled={isLoading}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
                      >
                        {showConfirmMpin ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                    {mpinForm.confirmMpin.length > 0 && (
                      <>
                        {mpinForm.confirmMpin.length < 4 && (
                          <p className="text-xs text-amber-600">
                            MPIN must be 4 digits ({mpinForm.confirmMpin.length}/4)
                          </p>
                        )}
                        {mpinForm.confirmMpin.length === 4 && mpinForm.newMpin !== mpinForm.confirmMpin && (
                          <p className="text-xs text-red-600">
                            MPINs do not match
                          </p>
                        )}
                        {mpinForm.confirmMpin.length === 4 && mpinForm.newMpin === mpinForm.confirmMpin && (
                          <p className="text-xs text-green-600">
                            MPINs match ✓
                          </p>
                        )}
                      </>
                    )}
                  </div>

                  {/* Security Tips */}
                  <div className="bg-muted/50 rounded-lg p-4 space-y-2">
                    <p className="text-sm font-medium text-foreground">
                      Security Tips:
                    </p>
                    <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                      <li>Use a unique 4-digit combination</li>
                      <li>Avoid using sequential numbers (e.g., 1234)</li>
                      <li>Avoid using repeated digits (e.g., 1111)</li>
                      <li>Don't share your MPIN with anyone</li>
                      <li>Change your MPIN regularly for security</li>
                    </ul>
                  </div>

                  {/* Submit Button */}
                  <Button
                    type="submit"
                    size="lg"
                    disabled={
                      isLoading ||
                      mpinForm.newMpin.length !== 4 ||
                      mpinForm.confirmMpin.length !== 4 ||
                      mpinForm.newMpin !== mpinForm.confirmMpin
                    }
                    className="w-full paybazaar-gradient text-white hover:opacity-90 transition-opacity h-12 text-base font-medium disabled:opacity-50"
                  >
                    {isLoading ? (
                      <span className="flex items-center gap-2">
                        <svg
                          className="animate-spin h-4 w-4"
                          xmlns="http://www.w3.org/2000/svg"
                          fill="none"
                          viewBox="0 0 24 24"
                        >
                          <circle
                            className="opacity-25"
                            cx="12"
                            cy="12"
                            r="10"
                            stroke="currentColor"
                            strokeWidth="4"
                          ></circle>
                          <path
                            className="opacity-75"
                            fill="currentColor"
                            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                          ></path>
                        </svg>
                        Updating MPIN...
                      </span>
                    ) : (
                      "Update MPIN"
                    )}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChangePasswordMpin;