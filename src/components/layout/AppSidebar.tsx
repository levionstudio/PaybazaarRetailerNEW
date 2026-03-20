"use client";

import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  Home,
  ChevronDown,
  ChevronRight,
  Calendar,
  History,
  Receipt,
  FileText,
  Settings,
  HelpCircle,
  LogOut,
  CreditCard,
  DollarSign,
  IndianRupee,
  File,
} from "lucide-react";

import { jwtDecode } from "jwt-decode";
import axios from "axios";

const CLOUDFRONT_BASE = import.meta.env.VITE_CLOUDFRONT_URL;
const toCdnUrl = (key: string | null | undefined): string =>
  key ? `${CLOUDFRONT_BASE}${key}` : "";

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  useSidebar,
} from "@/components/ui/sidebar";

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { title } from "process";

// -------------------
// TOKEN INTERFACE
// -------------------
interface DecodedToken {
  user_id: string;
  user_name: string;
  exp: number;
  iat: number;
}

// -------------------
// MENU DATA
// -------------------
const mainMenu = [
  { title: "Dashboard", href: "/dashboard", icon: Home },
  { title: "Services", href: "/services", icon: Calendar },
];

const historyMenu = [
  { title: "Account History", href: "/transactions", icon: History },
  { title: "Service Report", href: "/service/report", icon: Receipt },
];

const bottomMenu = [
  { title: "Tickets", href: "/tickets", icon: HelpCircle },
  { title: "Contact Us", href: "/contact-us", icon: HelpCircle },
  { title: "Settings", href: "/settings", icon: Settings },
];

// -------------------
// COMPONENT
// -------------------
export function AppSidebar() {
  const { state } = useSidebar();
  const location = useLocation();
  const navigate = useNavigate();
  const isCollapsed = state === "collapsed";

  const pathname = location.pathname;

  const [userName, setUserName] = useState("User");
  const [userId, setUserId] = useState("");
  const [profileImageUrl, setProfileImageUrl] = useState("");
  const [fundOpen, setFundOpen] = useState(false);
  const [tdsOpen, setTdsOpen] = useState(false);

  const iconClass = "h-5 w-5";

  // Token validation and user info extraction
  useEffect(() => {
    const token = localStorage.getItem("authToken");

    if (!token) {
      navigate("/login");
      return;
    }

    try {
      const decoded = jwtDecode<DecodedToken>(token);

      // Check if token is expired
      if (decoded.exp * 1000 < Date.now()) {
        localStorage.removeItem("authToken");
        navigate("/login");
        return;
      }

      // Set user info from token
      if (decoded.user_name) setUserName(decoded.user_name);
      if (decoded.user_id) {
        setUserId(decoded.user_id);
        // Fetch profile image from API
        axios
          .get(
            `${import.meta.env.VITE_API_BASE_URL}/retailer/get/${decoded.user_id}`,
            { headers: { Authorization: `Bearer ${token}` } }
          )
          .then((res) => {
            const imgKey = res.data?.retailer?.retailer_image;
            if (imgKey) setProfileImageUrl(toCdnUrl(imgKey));
          })
          .catch(() => { }); // silently ignore
      }
    } catch (error) {
      console.error("Token decode error:", error);
      localStorage.removeItem("authToken");
      navigate("/login");
    }
  }, [navigate]);

  // Automatically open Fund collapse when inside /fund*
  useEffect(() => {
    if (pathname.startsWith("/fund")) setFundOpen(true);
  }, [pathname]);

  // Automatically open TDS collapse when inside /tds*
  useEffect(() => {
    if (pathname.startsWith("/tds")) setTdsOpen(true);
  }, [pathname]);

  const initials = userName?.[0]?.toUpperCase() || "U";

  const handleLogout = () => {
    localStorage.removeItem("authToken");
    navigate("/login");
  };

  return (
    <Sidebar
      collapsible="icon"
      className="border-r border-sidebar-border bg-sidebar"
    >
      <SidebarContent className="flex flex-col h-screen">
        {/* LOGO */}
        <div
          className={`flex h-16 items-center justify-center border-b border-sidebar-border ${isCollapsed ? "px-2" : "px-4"
            }`}
        >
          {!isCollapsed ? (
            <div className="flex items-center gap-2">
              <img
                src="/paybazaar-logo.png"
                alt="PayBazaar"
                className="h-8 w-auto"
              />
              <span className="text-lg font-bold text-sidebar-foreground">
                PayBazaar
              </span>
            </div>
          ) : (
            <img
              src="/paybazaar-logo.png"
              alt="PayBazaar"
              className="h-8 w-8 mx-auto object-contain"
            />
          )}
        </div>

        {/* SCROLL AREA */}
        <div
          className={`flex-1 overflow-y-auto ${isCollapsed ? "py-4" : "px-3 py-4"
            } space-y-1`}
        >
          {/* MAIN MENU */}
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu>
                {mainMenu.map((item) => {
                  const active = pathname === item.href;
                  const Icon = item.icon;
                  return (
                    <SidebarMenuItem key={item.href}>
                      <SidebarMenuButton asChild isActive={active}>
                        <a
                          href={item.href}
                          className={`flex items-center rounded-lg transition-all ${isCollapsed
                              ? "justify-center px-2 py-2"
                              : "gap-3 px-3 py-2"
                            }`}
                        >
                          <Icon className={iconClass} />
                          {!isCollapsed && <span>{item.title}</span>}
                        </a>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>

          {/* HISTORY */}
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu>
                {historyMenu.map((item) => {
                  const active = pathname === item.href;
                  const Icon = item.icon;
                  return (
                    <SidebarMenuItem key={item.href}>
                      <SidebarMenuButton asChild isActive={active}>
                        <a
                          href={item.href}
                          className={`flex items-center rounded-lg transition-all ${isCollapsed
                              ? "justify-center px-2 py-2"
                              : "gap-3 px-3 py-2"
                            }`}
                        >
                          <Icon className={iconClass} />
                          {!isCollapsed && <span>{item.title}</span>}
                        </a>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>

          {/* FUND COLLAPSIBLE */}
          <SidebarGroup>
            <SidebarGroupContent>
              {isCollapsed ? (
                // COLLAPSED MODE (just icon)
                <SidebarMenu>
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      asChild
                      isActive={pathname.startsWith("/fund")}
                    >
                      <a
                        href="/funds-request"
                        className="flex items-center rounded-lg px-2 py-2 justify-center"
                      >
                        <CreditCard className={iconClass} />
                      </a>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                </SidebarMenu>
              ) : (
                // EXPANDED MODE
                <Collapsible open={fundOpen} onOpenChange={setFundOpen}>
                  <CollapsibleTrigger
                    className={`flex w-full items-center justify-between px-3 py-2 rounded-lg transition-all ${pathname.startsWith("/fund")
                        ? "bg-sidebar-accent text-sidebar-primary-foreground"
                        : "text-sidebar-foreground hover:bg-sidebar-accent"
                      }`}
                  >
                    <div className="flex items-center gap-3">
                      <CreditCard className={iconClass} />
                      <span>Fund</span>
                    </div>
                    {fundOpen ? (
                      <ChevronDown className="h-4 w-4" />
                    ) : (
                      <ChevronRight className="h-4 w-4" />
                    )}
                  </CollapsibleTrigger>

                  <CollapsibleContent className="mt-1 space-y-1">
                    {/* Add Fund */}
                    <a
                      href="/funds-request"
                      className={`flex items-center px-3 py-2 pl-11 rounded-lg text-sm transition-all ${pathname === "/funds-request"
                          ? "bg-sidebar-accent text-sidebar-foreground border border-white"
                          : "text-sidebar-foreground/80 hover:bg-sidebar-accent/50"
                        }`}
                    >
                      Add Fund
                    </a>

                    {/* Fund Requests */}
                    <a
                      href="/funds"
                      className={`flex items-center px-3 py-2 pl-11 rounded-lg text-sm transition-all ${pathname === "/funds"
                          ? "bg-sidebar-accent text-sidebar-foreground border border-white"
                          : "text-sidebar-foreground/80 hover:bg-sidebar-accent/50"
                        }`}
                    >
                      Fund Requests
                    </a>
                  </CollapsibleContent>
                </Collapsible>
              )}
            </SidebarGroupContent>
          </SidebarGroup>

          {/* LEDGER */}
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={pathname === "/reports"}>
                    <a
                      href="/reports"
                      className={`flex items-center rounded-lg transition-all ${isCollapsed
                          ? "justify-center px-2 py-2"
                          : "gap-3 px-3 py-2"
                        }`}
                    >
                      <FileText className={iconClass} />
                      {!isCollapsed && <span>Ledger</span>}
                    </a>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>

          {/* TDS HISTORY COLLAPSIBLE */}
          {/* <SidebarGroup>
            <SidebarGroupContent>
              {isCollapsed ? (

                <SidebarMenu>
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      asChild
                      isActive={pathname.startsWith("/tds")}
                    >
                      <a
                        href="/tds-commissions"
                        className="flex items-center rounded-lg px-2 py-2 justify-center"
                      >
                        <IndianRupee className={iconClass} />
                      </a>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                </SidebarMenu>
              ) : (
      
                <Collapsible open={tdsOpen} onOpenChange={setTdsOpen}>
                  <CollapsibleTrigger
                    className={`flex w-full items-center justify-between px-3 py-2 rounded-lg transition-all ${
                      pathname.startsWith("/tds")
                        ? "bg-sidebar-accent text-sidebar-primary-foreground"
                        : "text-sidebar-foreground hover:bg-sidebar-accent"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <File className={iconClass} />
                      <span>TDS History</span>
                    </div>
                    {tdsOpen ? (
                      <ChevronDown className="h-4 w-4" />
                    ) : (
                      <ChevronRight className="h-4 w-4" />
                    )}
                  </CollapsibleTrigger>

                  <CollapsibleContent className="mt-1 space-y-1">

                    <a
                      href="/tds-commissions"
                      className={`flex items-center px-3 py-2 pl-11 rounded-lg text-sm transition-all ${
                        pathname === "/tds-commissions"
                          ? "bg-sidebar-accent text-sidebar-foreground border border-white"
                          : "text-sidebar-foreground/80 hover:bg-sidebar-accent/50"
                      }`}
                    >
                      TDS Commissions
                    </a>
                  </CollapsibleContent>
                </Collapsible>
              )}
            </SidebarGroupContent>
          </SidebarGroup> */}

          {/* BOTTOM MENU */}
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu>
                {bottomMenu.map((item) => {
                  const active = pathname === item.href;
                  const Icon = item.icon;
                  return (
                    <SidebarMenuItem key={item.href}>
                      <SidebarMenuButton asChild isActive={active}>
                        <a
                          href={item.href}
                          className={`flex items-center rounded-lg transition-all ${isCollapsed
                              ? "justify-center px-2 py-2"
                              : "gap-3 px-3 py-2"
                            }`}
                        >
                          <Icon className={iconClass} />
                          {!isCollapsed && <span>{item.title}</span>}
                        </a>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>

          {/* LOGOUT */}
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild>
                    <button
                      onClick={handleLogout}
                      className={`flex w-full items-center rounded-lg text-sidebar-foreground hover:bg-sidebar-accent transition-all ${isCollapsed
                          ? "justify-center px-2 py-2"
                          : "gap-3 px-3 py-2"
                        }`}
                    >
                      <LogOut className={iconClass} />
                      {!isCollapsed && <span>Logout</span>}
                    </button>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </div>

        {/* USER PROFILE */}
        {!isCollapsed && (
          <div className="border-t border-sidebar-border p-4">
            <div className="flex items-center gap-3">
              {/* Avatar: real image or initials fallback */}
              {profileImageUrl ? (
                <img
                  src={profileImageUrl}
                  alt={userName}
                  className="h-10 w-10 rounded-full object-cover ring-2 ring-sidebar-border flex-shrink-0"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = "none";
                  }}
                />
              ) : (
                <div className="h-10 w-10 rounded-full bg-sidebar-accent text-sidebar-primary-foreground flex items-center justify-center font-bold text-lg flex-shrink-0">
                  {initials}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold truncate text-sidebar-foreground">
                  {userName}
                </p>
                <p className="text-xs text-sidebar-foreground/70">{userId}</p>
              </div>
            </div>
          </div>
        )}
      </SidebarContent>
    </Sidebar>
  );
}