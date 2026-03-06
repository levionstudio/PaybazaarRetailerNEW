import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  FileText,
  TrendingUp,
  Wallet,
  ArrowLeftRight,
  Search,
  BarChart3,
  Receipt,
  Landmark,
  Fingerprint,
  Smartphone,
  BusIcon,
  IndianRupee,
} from "lucide-react";
import { useState } from "react";
import { Header } from "@/components/layout/Header";
import { AppSidebar } from "@/components/layout/AppSidebar";
import { useNavigate } from "react-router-dom";

export default function ServiceReport() {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");

  const reports = [
   {
      id: "payout",
      title: "SETTLEMENT",
      subtitle: "Instant Settlement",
      icon: Landmark,
      status: "active",
      description: "Send settlement instantly to bank",
      color: "bg-gradient-to-r from-purple-600 to-purple-400",
      category: "Settlement",
      route: "/service/settlement/report",
    },
    {
      id: "dmt-1",
      title: "DMT",
      subtitle: "Domestic Money Transfer",
      icon: ArrowLeftRight,
        status: "coming-soon",
      description: "Send money across India instantly",
      color: "bg-gradient-to-r from-indigo-600 to-indigo-400",
      category: "Transfer",
      route: "/service/report",
    },

      {
      
      id: "aeps1",
      title: "AEPS",
      subtitle: "Aadhaar Enabled Payment",
      icon: Fingerprint,
         status: "coming-soon",
      description: "Withdraw cash using Aadhaar authentication",
      color: "bg-gradient-to-r from-blue-600 to-blue-400",
      category: "Banking",
      route: "/aeps",
    },
    {
      id: "utilities-bill",
      title: "BBPS",
      subtitle: "Bill Payment Services",
      icon: FileText,
         status: "active",
      description: "Pay electricity, water, gas bills",
      color: "bg-gradient-to-r from-emerald-600 to-emerald-400",
      category: "Bills",
      route: "/service/bbps/all",
    },
    {
      id: "mobile-recharge",
      title: "RECHARGE",
      subtitle: "Mobile & DTH Recharge",
      icon: Smartphone,
         status: "active",
      description: "Recharge prepaid and DTH connections",
      color: "bg-gradient-to-r from-orange-500 to-orange-400",
      category: "Recharge",
      route: "/service/recharge/all",
    },
       {
      id: "ticket-booking",
      title: "TICKET BOOKING",
      subtitle: "Flight and Bus Ticket Booking",
      icon: BusIcon,
         status: "coming-soon",
      description: "Book flight and bus tickets",
      color: "bg-gradient-to-r from-indigo-600 to-indigo-400",
      category: "Ticket Booking",
      route: "/service",
     },
//          {
//   id: "upi",
//   title: "UPI",
//   subtitle: "Universal Payment Interface",
//   icon: IndianRupee,
//          status: "coming-soon",
//   description: "Pay for your purchases using UPI",
//   color: "bg-gradient-to-r from-purple-600 to-purple-400",
//   category: "Upi",
//   route: "/service",
// },
  ];

  const categories = [
    "All",
    ...Array.from(new Set(reports.map((r) => r.category))),
  ];

  const filteredReports = reports.filter((report) => {
    const matchesSearch =
      (report.title?.toLowerCase() || "").includes(searchTerm.toLowerCase()) ||
      (report.subtitle?.toLowerCase() || "").includes(
        searchTerm.toLowerCase()
      ) ||
      (report.description?.toLowerCase() || "").includes(
        searchTerm.toLowerCase()
      );

    const matchesCategory =
      selectedCategory === "All" || selectedCategory === report.category;

    return matchesSearch && matchesCategory;
  });

  const handleReportClick = (report: typeof reports[0]) => {
    if (report.status === "coming-soon") {
      return;
    }
    navigate(report.route);
  };

  return (
    <div className="min-h-screen bg-gray-50 flex w-full font-sans antialiased">
      <AppSidebar />

      <div className="flex-1 flex flex-col">
        <Header />

        <main className="flex-1 overflow-auto">
          {/* HERO SECTION */}
          <div className="paybazaar-gradient p-6 sm:p-8 text-white shadow">
            <div className="max-w-7xl mx-auto">
              <h1 className="text-2xl sm:text-3xl font-bold">Reports</h1>
              <p className="text-white/80 mt-2 text-sm sm:text-lg">
                Access detailed reports and analytics for your business
              </p>

              {/* SEARCH */}
              <div className="mt-6 w-full">
                <div className="relative w-full sm:w-96">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-white/70 h-5 w-5" />
                  <Input
                    placeholder="Search reports..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="
                      pl-10 h-11 rounded-xl
                      bg-white/10
                      text-white
                      placeholder:text-white/60
                      border border-white/20
                      focus:bg-white/15
                      focus:border-white/40
                      focus:ring-0
                    "
                  />
                </div>
              </div>

              {/* CATEGORY FILTERS */}
              <div className="mt-4 flex flex-wrap gap-2">
                {categories.map((category) => (
                  <Button
                    key={category}
                    variant={
                      selectedCategory === category ? "secondary" : "ghost"
                    }
                    size="sm"
                    onClick={() => setSelectedCategory(category)}
                    className={
                      selectedCategory === category
                        ? "bg-white hover:bg-white text-primary rounded-full px-4 py-2 h-auto"
                        : "text-white rounded-full px-4 py-2 h-auto"
                    }
                  >
                    {category}
                  </Button>
                ))}
              </div>
            </div>
          </div>

          {/* REPORTS GRID */}
          <div className="p-4 sm:p-6">
            <div className="max-w-7xl mx-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
              {filteredReports.map((report) => (
                <Card
                  key={report.id}
                  onClick={() => handleReportClick(report)}
                  className={`${
                    report.status === "coming-soon"
                      ? "opacity-60 cursor-not-allowed"
                      : "cursor-pointer hover:shadow-xl"
                  } transition-all duration-300 rounded-2xl relative overflow-hidden`}
                >
                  {report.status === "coming-soon" && (
                    <div className="absolute top-4 right-4 bg-yellow-500 text-white text-xs font-bold px-3 py-1 rounded-full z-10">
                      Coming Soon
                    </div>
                  )}
                  <CardContent className="p-6 flex flex-col justify-between h-full">
                    {/* Icon */}
                    <div
                      className={`p-4 rounded-xl ${report.color} w-fit shadow-md`}
                    >
                      <report.icon className="h-6 w-6 text-white" />
                    </div>

                    {/* Title */}
                    <h3 className="text-xl font-semibold mt-4">
                      {report.title}
                    </h3>
                    <p className="text-sm text-gray-500">{report.subtitle}</p>

                    {/* Description */}
                    <p className="text-sm text-gray-700 mt-2 line-clamp-2">
                      {report.description}
                    </p>

                    <Button
                      className={`w-full mt-4 rounded-full ${
                        report.status === "coming-soon"
                          ? "opacity-50 cursor-not-allowed"
                          : ""
                      }`}
                      disabled={report.status === "coming-soon"}
                    >
                      {report.status === "coming-soon"
                        ? "Coming Soon"
                        : "View Report"}
                    </Button>
                  </CardContent>
                </Card>
              ))}

              {filteredReports.length === 0 && (
                <div className="text-center py-12 col-span-full">
                  <div className="text-6xl mb-2">🔍</div>
                  <p className="text-gray-500">No reports found</p>
                </div>
              )}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}