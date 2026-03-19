import { Moon, Sun, Wallet, User, LogOut, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/components/ui/theme-provider";
import { SidebarTrigger } from "@/components/ui/sidebar";
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
import { useToast } from "@/hooks/use-toast";
import { jwtDecode } from "jwt-decode";
import { useEffect, useState, useRef } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";

/* ---------------- TOKEN ---------------- */

interface DecodedToken {
  user_id: string;
  exp: number;
}

/* ---------------- AUTH HELPER ---------------- */

function getUserIdFromToken(): string | null {
  const token = localStorage.getItem("authToken");
  if (!token) return null;

  try {
    const decoded = jwtDecode<DecodedToken>(token);

    if (decoded.exp * 1000 < Date.now()) {
      localStorage.removeItem("authToken");
      return null;
    }

    return decoded.user_id;
  } catch {
    localStorage.removeItem("authToken");
    return null;
  }
}

export function Header() {
  const { theme, setTheme } = useTheme();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [walletBalance, setWalletBalance] = useState<number>(0);
  const [showLogoutDialog, setShowLogoutDialog] = useState(false);
  const [openMenu, setOpenMenu] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  const menuRef = useRef<HTMLDivElement>(null);

  /* ---------------- AUTH ---------------- */

  useEffect(() => {
    const id = getUserIdFromToken();

    if (!id) {
      toast({
        title: "Session expired",
        description: "Please login again.",
        variant: "destructive",
      });
      navigate("/login");
      return;
    }

    setUserId(id);
  }, [navigate, toast]);

  /* ---------------- WALLET BALANCE ---------------- */

  useEffect(() => {
    if (!userId) return;

    const fetchWalletBalance = async () => {
      try {
        const token = localStorage.getItem("authToken");

      // GET /retailer/get/{retailer_id}/wallet → { balance, message }
      const res = await axios.get(
        `${import.meta.env.VITE_API_BASE_URL}/retailer/get/${userId}/wallet`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      const balance = res.data?.balance;

        if (typeof balance === "number") {
          setWalletBalance(balance);
        }
      } catch (error) {
        console.error("Wallet balance fetch error:", error);
      }
    };

    fetchWalletBalance();

    const interval = setInterval(fetchWalletBalance, 30000);
    return () => clearInterval(interval);
  }, [userId]);

  /* ---------------- CLOSE MENU ON OUTSIDE CLICK ---------------- */

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpenMenu(false);
      }
    };

    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleLogout = () => {
    localStorage.removeItem("authToken");
    navigate("/login");
  };

  return (
    <header className="bg-card border-b border-border  w-full sticky top-0  h-16">
      <div className="flex h-full items-center justify-between px-4 lg:px-6">
        {/* LEFT */}
        <div className="flex items-center gap-4">
          <SidebarTrigger />
          <h1 className="text-xl font-semibold">PayBazaar Portal</h1>
        </div>

        {/* RIGHT */}
        <div className="flex items-center gap-4 relative" ref={menuRef}>
          {/* Theme Toggle */}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setTheme(theme === "light" ? "dark" : "light")}
          >
            <Sun className="h-5 w-5 dark:hidden" />
            <Moon className="h-5 w-5 hidden dark:block" />
          </Button>

          {/* Wallet */}
          <div className="hidden md:flex items-center gap-2 px-4 py-2 rounded-xl bg-wallet-bg border">
            <Wallet className="h-4 w-4" />
            <span className="font-semibold text-sm">
              ₹{walletBalance.toLocaleString("en-IN")}
            </span>
          </div>

          {/* Profile Button */}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setOpenMenu((p) => !p)}
          >
            <User className="h-5 w-5" />
          </Button>

          {/* Dropdown */}
          <AnimatePresence>
            {openMenu && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: -8 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: -8 }}
                transition={{ duration: 0.15 }}
                className="absolute right-0 top-14 w-44 rounded-xl border bg-card shadow-lg overflow-hidden"
              >
                <button
                  onClick={() => {
                    navigate("/profile");
                    setOpenMenu(false);
                  }}
                  className="flex w-full items-center gap-3 px-4 py-3 text-sm hover:bg-muted"
                >
                  <User className="h-4 w-4" />
                  Profile
                </button>

                <button
                  onClick={() => {
                    navigate("/documents");
                    setOpenMenu(false);
                  }}
                  className="flex w-full items-center gap-3 px-4 py-3 text-sm hover:bg-muted"
                >
                  <FileText className="h-4 w-4" />
                  Documents
                </button>

                <button
                  onClick={() => {
                    setShowLogoutDialog(true);
                    setOpenMenu(false);
                  }}
                  className="flex w-full items-center gap-3 px-4 py-3 text-sm text-destructive hover:bg-destructive/10"
                >
                  <LogOut className="h-4 w-4" />
                  Logout
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Logout Confirmation */}
      <AlertDialog open={showLogoutDialog} onOpenChange={setShowLogoutDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Logout</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to logout?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleLogout}
              className="bg-destructive text-destructive-foreground"
            >
              Logout
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </header>
  );
}
