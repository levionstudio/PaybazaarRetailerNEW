import { useState, useEffect, useRef, useMemo } from "react";
import axios from "axios";
import { jwtDecode } from "jwt-decode";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { ChevronDown, Loader2 } from "lucide-react";

interface AddBeneficiaryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdd?: () => void;
  mobileNumber?: string;
}

interface Bank {
  bank_name: string;
  ifsc_code: string;
}

interface DecodedToken {
  admin_id: string;
  user_id: string;
  user_name: string;
  user_role: string;
  exp: number;
  iat: number;
}

// Suppress internal backend error messages from reaching the UI
const sanitizeErrorMessage = (
  raw: string | undefined,
  fallback: string
): string => {
  if (!raw) return fallback;
  const hidden = ["invalid status from recharge kit", "recharge kit"];
  const isHidden = hidden.some((m) => raw.toLowerCase().includes(m.toLowerCase()));
  return isHidden ? fallback : raw;
};

export function AddBeneficiaryDialog({
  open,
  onOpenChange,
  onAdd,
  mobileNumber = "",
}: AddBeneficiaryDialogProps) {
  const { toast } = useToast();
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [formData, setFormData] = useState({
    bank: "",
    ifsc: "",
    accountNumber: "",
    beneficiaryName: "",
    branchName: "",
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [banks, setBanks] = useState<Bank[]>([]);
  const [loading, setLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isVerified, setIsVerified] = useState(false);
  const [showVerifyConfirm, setShowVerifyConfirm] = useState(false);
  const [bankSearchTerm, setBankSearchTerm] = useState("");
  const [isSelectOpen, setIsSelectOpen] = useState(false);

  // Fetch banks on dialog open
  useEffect(() => {
    const fetchBanks = async () => {
      try {
        setLoading(true);
        const token = localStorage.getItem("authToken");
        const response = await axios.get(
          `${import.meta.env.VITE_API_BASE_URL}/bank/get/all`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
          }
        );

        if (response.data.status === "success" && response.data.data?.banks) {
          // Deduplicate banks by bank_name to avoid React key conflicts and duplicate entries
          const rawBanks: Bank[] = response.data.data.banks;
          const seen = new Set<string>();
          const uniqueBanks = rawBanks.filter((bank) => {
            const key = bank.bank_name.trim().toLowerCase();
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
          });
          setBanks(uniqueBanks);
        }
      } catch (error: any) {
        toast({
          title: "Error",
          description: "Failed to fetch banks. Please try again.",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

    if (open) {
      fetchBanks();
    }
  }, [open, toast]);

  // Reset form when dialog closes
  useEffect(() => {
    if (!open) {
      setFormData({
        bank: "",
        ifsc: "",
        accountNumber: "",
        beneficiaryName: "",
        branchName: "",
      });
      setErrors({});
      setBankSearchTerm("");
      setIsVerified(false);
      setShowVerifyConfirm(false);
      setIsSelectOpen(false);
    }
  }, [open]);

  // Auto-focus search input when dropdown opens
  useEffect(() => {
    if (isSelectOpen) {
      const timer = setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [isSelectOpen]);

  // useMemo ensures re-computation on every bankSearchTerm or banks change
  const filteredBanks = useMemo(() => {
    const term = bankSearchTerm.toLowerCase().trim();
    if (!term) return banks;
    return banks.filter((bank) =>
      bank.bank_name.toLowerCase().trim().includes(term)
    );
  }, [banks, bankSearchTerm]);

  // Verify Account Handler
  const handleVerifyAccount = async () => {
    if (!formData.accountNumber) {
      setErrors({ ...errors, accountNumber: "Account number is required" });
      return;
    }

    if (!formData.ifsc) {
      setErrors({ ...errors, ifsc: "IFSC code is required" });
      return;
    }

    if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(formData.ifsc)) {
      setErrors({ ...errors, ifsc: "Invalid IFSC code format" });
      return;
    }

    if (!mobileNumber) {
      toast({
        title: "Error",
        description: "Mobile number not found. Please login again.",
        variant: "destructive",
      });
      return;
    }

    setIsVerifying(true);
    setShowVerifyConfirm(false);
    const token = localStorage.getItem("authToken");

    try {
      const decoded = jwtDecode<DecodedToken>(token || "");
      const retailerId = decoded.user_id;

      if (!retailerId) {
        throw new Error("Retailer ID not found. Please login again.");
      }

      const payload = {
        retailer_id: retailerId,
        mobile_number: mobileNumber,
        account_number: formData.accountNumber,
        ifsc_code: formData.ifsc,
      };

      const response = await axios.post(
        `${import.meta.env.VITE_API_BASE_URL}/bene/verify/beneficiaries`,
        payload,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }
      );

      if (response.data?.status === "success") {
        const verifyResponse = response.data?.data?.response;
        const verificationData = verifyResponse?.data;

        if (verificationData && verificationData.c_name) {
          setFormData((prev) => ({
            ...prev,
            beneficiaryName: verificationData.c_name || "",
            bank: verificationData.bank_name || prev.bank,
            branchName: verificationData.branch_name || "",
          }));

          setIsVerified(true);

          toast({
            title: "Verification Successful",
            description: `Account verified for ${verificationData.c_name}`,
          });
        } else {
          setIsVerified(true);
          toast({
            title: "Verified",
            description:
              "Account details verified. Please enter beneficiary name manually.",
          });
        }
      } else {
        toast({
          title: "Verification Failed",
          description:
            response.data?.message ||
            "Unable to verify account. Please enter details manually.",
          variant: "destructive",
        });
      }
    } catch (error: any) {
      toast({
        title: "Verification Error",
        description: sanitizeErrorMessage(
          error.response?.data?.message,
          "Failed to verify account"
        ),
        variant: "destructive",
      });
    } finally {
      setIsVerifying(false);
    }
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.bank) newErrors.bank = "Please select a bank";

    if (!formData.ifsc) {
      newErrors.ifsc = "IFSC code is required";
    } else if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(formData.ifsc)) {
      newErrors.ifsc = "Invalid IFSC code format";
    }

    if (!formData.accountNumber) {
      newErrors.accountNumber = "Account number is required";
    } else if (formData.accountNumber.length < 9) {
      newErrors.accountNumber = "Account number must be at least 9 digits";
    }

    if (!formData.beneficiaryName) {
      newErrors.beneficiaryName = "Beneficiary name is required";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) return;

    if (!mobileNumber) {
      toast({
        title: "Missing Phone Number",
        description: "Mobile number not found. Please login again.",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsSubmitting(true);
      const token = localStorage.getItem("authToken");

      const payload = {
        mobile_number: mobileNumber,
        bank_name: formData.bank,
        beneficiary_name: formData.beneficiaryName,
        account_number: formData.accountNumber,
        ifsc_code: formData.ifsc,
      };

      const response = await axios.post(
        `${import.meta.env.VITE_API_BASE_URL}/bene/add/beneficiary`,
        payload,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }
      );

      if (response.data.status === "success") {
        toast({
          title: "Success",
          description: "Beneficiary added successfully",
        });

        if (onAdd) {
          onAdd();
        }

        setFormData({
          bank: "",
          ifsc: "",
          accountNumber: "",
          beneficiaryName: "",
          branchName: "",
        });

        setErrors({});
        setBankSearchTerm("");
        setIsVerified(false);
        onOpenChange(false);
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: sanitizeErrorMessage(
          error.response?.data?.message,
          "Failed to add beneficiary"
        ),
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    setFormData({
      bank: "",
      ifsc: "",
      accountNumber: "",
      beneficiaryName: "",
      branchName: "",
    });
    setErrors({});
    setBankSearchTerm("");
    setIsVerified(false);
    setIsSelectOpen(false);
    onOpenChange(false);
  };

  const handleBankChange = (bankName: string) => {
    const selectedBank = banks.find((b) => b.bank_name === bankName);
    if (selectedBank) {
      setFormData({
        ...formData,
        bank: bankName,
        ifsc: selectedBank.ifsc_code,
      });
      setErrors((prev) => ({ ...prev, bank: "" }));
      setIsVerified(false);
    }
  };

  const handleIFSCChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "");

    if (value.length > 11) {
      value = value.substring(0, 11);
    }

    setFormData({ ...formData, ifsc: value });
    setIsVerified(false);
  };

  const handleAccountNumberChange = (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    setFormData({ ...formData, accountNumber: e.target.value });
    setIsVerified(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] bg-background border-border">
        <DialogHeader className="text-center">
          <DialogTitle className="text-lg font-semibold tracking-wider">
            ADD BENEFICIARY
          </DialogTitle>
          <DialogDescription>
            Add a new beneficiary for payout transactions
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6 mt-6">
          {/* Bank Selection */}
          <div className="space-y-2">
            <Label htmlFor="bank" className="text-sm font-medium">
              Select Bank <span className="text-destructive">*</span>
            </Label>
            <div className="relative">
              <Button
                type="button"
                variant="outline"
                className="w-full justify-between text-left font-normal"
                onClick={() => setIsSelectOpen((prev) => !prev)}
              >
                <span className={formData.bank ? "" : "text-muted-foreground"}>
                  {formData.bank || "--Select Bank--"}
                </span>
                <ChevronDown
                  className={`h-4 w-4 opacity-50 transition-transform duration-200 ${
                    isSelectOpen ? "rotate-180" : ""
                  }`}
                />
              </Button>

              {isSelectOpen && (
                <>
                  {/* Invisible overlay to close dropdown on outside click */}
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => {
                      setIsSelectOpen(false);
                      setBankSearchTerm("");
                    }}
                  />

                  <div
                    className="absolute top-full left-0 right-0 mt-2 bg-background border border-border rounded-lg shadow-lg z-50 max-h-[300px] flex flex-col"
                    onKeyDown={(e) => e.stopPropagation()}
                    onKeyUp={(e) => e.stopPropagation()}
                    onKeyDownCapture={(e) => e.stopPropagation()}
                  >
                    {/* Search Input - using native input to bypass Dialog event capture */}
                    <div className="p-2 border-b border-border bg-background rounded-t-lg">
                      <input
                        ref={searchInputRef}
                        placeholder="Search bank..."
                        type="text"
                        autoComplete="off"
                        autoCorrect="off"
                        autoCapitalize="off"
                        spellCheck={false}
                        value={bankSearchTerm}
                        style={{
                          fontSize: "16px",
                          width: "100%",
                          height: "36px",
                          padding: "0 12px",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: "6px",
                          background: "hsl(var(--background))",
                          color: "hsl(var(--foreground))",
                          outline: "none",
                          boxSizing: "border-box",
                        }}
                        onChange={(e) => {
                          setBankSearchTerm(e.target.value);
                        }}
                        onKeyDown={(e) => {
                          e.stopPropagation();
                          if (e.key === "Escape") {
                            setIsSelectOpen(false);
                            setBankSearchTerm("");
                          }
                          if (e.key === "Enter") {
                            e.preventDefault();
                            if (filteredBanks.length > 0) {
                              handleBankChange(filteredBanks[0].bank_name);
                              setIsSelectOpen(false);
                              setBankSearchTerm("");
                            }
                          }
                        }}
                        onKeyUp={(e) => e.stopPropagation()}
                        onClick={(e) => e.stopPropagation()}
                        onFocus={(e) => e.stopPropagation()}
                      />
                    </div>

                    {/* Bank List */}
                    <div className="overflow-y-auto max-h-[250px]">
                      {loading ? (
                        <div className="p-4 text-center text-sm text-muted-foreground flex items-center justify-center gap-2">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Loading banks...
                        </div>
                      ) : filteredBanks.length > 0 ? (
                        filteredBanks.map((bank, index) => (
                          <button
                            key={`${bank.bank_name}-${index}`}
                            type="button"
                            className={`w-full text-left px-4 py-3 hover:bg-muted transition-colors text-sm border-b border-border last:border-b-0 ${
                              formData.bank === bank.bank_name
                                ? "bg-muted font-medium"
                                : ""
                            }`}
                            onClick={() => {
                              handleBankChange(bank.bank_name);
                              setIsSelectOpen(false);
                              setBankSearchTerm("");
                            }}
                          >
                            {bank.bank_name}
                          </button>
                        ))
                      ) : (
                        <div className="p-4 text-center text-sm text-muted-foreground">
                          {bankSearchTerm
                            ? `No banks found for "${bankSearchTerm}"`
                            : "No banks available"}
                        </div>
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>
            {errors.bank && (
              <p className="text-red-500 text-xs">{errors.bank}</p>
            )}
          </div>

          {/* IFSC */}
          <div className="space-y-2">
            <Label htmlFor="ifsc" className="text-sm font-medium">
              IFSC Code <span className="text-destructive">*</span>
            </Label>
            <Input
              id="ifsc"
              type="text"
              value={formData.ifsc}
              onChange={handleIFSCChange}
              placeholder="Enter or edit IFSC"
              className="uppercase"
              maxLength={11}
            />
            {errors.ifsc && (
              <p className="text-red-500 text-xs">{errors.ifsc}</p>
            )}
          </div>

          {/* Account Number with Verify Button */}
          <div className="space-y-2">
            <Label htmlFor="accountNumber" className="text-sm font-medium">
              Account Number <span className="text-destructive">*</span>
            </Label>
            <div className="flex gap-2">
              <Input
                id="accountNumber"
                type="text"
                inputMode="numeric"
                value={formData.accountNumber}
                onChange={handleAccountNumberChange}
                placeholder="Enter Account Number"
                className="flex-1"
              />
              <Button
                type="button"
                onClick={() => {
                  if (!formData.accountNumber || !formData.ifsc) {
                    toast({
                      title: "Missing Information",
                      description:
                        "Please enter account number and IFSC code first",
                      variant: "destructive",
                    });
                    return;
                  }
                  if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(formData.ifsc)) {
                    toast({
                      title: "Invalid IFSC",
                      description: "Please enter a valid IFSC code",
                      variant: "destructive",
                    });
                    return;
                  }
                  setShowVerifyConfirm(true);
                }}
                disabled={
                  isVerifying || !formData.accountNumber || !formData.ifsc
                }
                variant={isVerified ? "default" : "outline"}
                className={isVerified ? "bg-green-600 hover:bg-green-700" : ""}
              >
                {isVerifying ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Verifying
                  </>
                ) : isVerified ? (
                  "Verified ✓"
                ) : (
                  "Verify"
                )}
              </Button>
            </div>
            {errors.accountNumber && (
              <p className="text-red-500 text-xs">{errors.accountNumber}</p>
            )}
          </div>

          {/* Beneficiary Name */}
          <div className="space-y-2">
            <Label htmlFor="beneficiaryName" className="text-sm font-medium">
              Beneficiary Name <span className="text-destructive">*</span>
              {isVerified && (
                <span className="text-xs text-green-600 ml-2">(Verified)</span>
              )}
            </Label>
            <Input
              id="beneficiaryName"
              type="text"
              value={formData.beneficiaryName}
              onChange={(e) =>
                setFormData({ ...formData, beneficiaryName: e.target.value })
              }
              placeholder={
                isVerified
                  ? "Auto-filled from verification (editable)"
                  : "Enter beneficiary name"
              }
              className={isVerified ? "bg-green-50 border-green-300" : ""}
            />
            {errors.beneficiaryName && (
              <p className="text-red-500 text-xs">{errors.beneficiaryName}</p>
            )}
            {!isVerified && (
              <p className="text-xs text-muted-foreground">
                Verify account to auto-fill, or enter manually
              </p>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-3 pt-4">
            <Button
              type="button"
              onClick={handleCancel}
              variant="outline"
              className="flex-1"
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="flex-1 paybazaar-gradient text-white"
              disabled={isSubmitting || loading}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Submitting...
                </>
              ) : (
                "Submit"
              )}
            </Button>
          </div>
        </form>
      </DialogContent>

      {/* Verification Confirmation Modal */}
      <AlertDialog open={showVerifyConfirm} onOpenChange={setShowVerifyConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Account Verification</AlertDialogTitle>
            <AlertDialogDescription className="space-y-3">
              <p className="text-base">
                Account verification will cost{" "}
                <span className="font-bold text-red-600">₹3.00</span> and will
                be deducted from your wallet balance.
              </p>
              <div className="bg-muted p-4 rounded-lg border mt-4">
                <p className="text-sm font-semibold mb-2">
                  Verification Details:
                </p>
                <div className="space-y-1 text-sm">
                  <p>
                    <span className="text-muted-foreground">
                      Account Number:
                    </span>{" "}
                    <span className="font-mono font-medium">
                      {formData.accountNumber}
                    </span>
                  </p>
                  <p>
                    <span className="text-muted-foreground">IFSC Code:</span>{" "}
                    <span className="font-mono font-medium">{formData.ifsc}</span>
                  </p>
                </div>
              </div>
              <p className="text-sm text-muted-foreground mt-3">
                Do you want to proceed with the verification?
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isVerifying}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleVerifyAccount}
              disabled={isVerifying}
              className="bg-primary hover:bg-primary/90"
            >
              {isVerifying ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Verifying...
                </>
              ) : (
                "Yes, Verify (₹3)"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
}