import { useState, useEffect } from "react";
import axios from "axios";
import { jwtDecode } from "jwt-decode";
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
import {
  Phone,
  Mail,
  MapPin,
  Clock,
  ArrowLeft,
  Headphones,
  Send,
  MessageSquare,
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

const ContactUs = () => {
  const navigate = useNavigate();
  const token = localStorage.getItem("authToken");
  const [adminId, setAdminId] = useState<string>("");
  const [userId, setUserId] = useState<string>("");
  const [loading, setLoading] = useState(false);

  const [formData, setFormData] = useState({
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

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!userId) {
      toast.error("Authentication required. Please login again.");
      return;
    }

    if (!formData.ticket_title.trim()) {
      toast.error("Please enter a ticket title");
      return;
    }

    if (formData.ticket_title.length < 3 || formData.ticket_title.length > 200) {
      toast.error("Ticket title must be between 3 and 200 characters");
      return;
    }

    if (!formData.ticket_description.trim()) {
      toast.error("Please enter a ticket description");
      return;
    }

    if (formData.ticket_description.length < 5) {
      toast.error("Ticket description must be at least 5 characters");
      return;
    }

    try {
      setLoading(true);

      const payload = {
        admin_id: adminId,
        user_id: userId,
        ticket_title: formData.ticket_title.trim(),
        ticket_description: formData.ticket_description.trim(),
      };


      const response = await axios.post(
        `${import.meta.env.VITE_API_BASE_URL}/ticket/create`,
        payload,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }
      );

      if (response.data.status === "success") {
        toast.success(response.data.message || "Ticket created successfully");

        // Reset form
        setFormData({
          ticket_title: "",
          ticket_description: "",
        });
      }
    } catch (error: any) {
      console.error("Submit error:", error);
      toast.error(
        error.response?.data?.message || "Failed to create ticket. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  const contactInfo = [
    {
      icon: Phone,
      title: "Phone Number",
      value: "+91 9311367701",
      color: "bg-blue-50 text-blue-600",
    },
    {
      icon: Headphones,
      title: "Helpline Number",
      value: "0124-28089495",
      color: "bg-purple-50 text-purple-600",
    },
    {
      icon: Mail,
      title: "Email Address",
      value: "helpdeskpaybazaar@gmail.com",
      color: "bg-green-50 text-green-600",
    },
    {
      icon: MapPin,
      title: "Office Location",
      value:
        "Unit 902, Tower B4 on 9th Spaze I-Tech Park, Sector-49, Sohna Road, Gurugram, Haryana, 122018.",
      color: "bg-orange-50 text-orange-600",
    },
    {
      icon: Clock,
      title: "Working Hours",
      value: "Monday to Saturday\n9:00 AM - 7:00 PM",
      color: "bg-indigo-50 text-indigo-600",
    },
  ];

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
      },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.5,
      },
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
                <h1 className="text-2xl font-bold">Contact Us</h1>
                <p className="text-sm text-white/80 mt-1">
                  Get in touch with our support team - We're here to help!
                </p>
              </div>
            </div>
          </div>
        </motion.header>

        {/* MAIN CONTENT */}
        <main className="flex-1 p-6 overflow-auto bg-muted/10">
          <div className="mx-auto max-w-7xl">
            <motion.div
              variants={containerVariants}
              initial="hidden"
              animate="visible"
              className="grid gap-6 lg:grid-cols-2"
            >
              {/* CONTACT INFORMATION CARD */}
              <motion.div variants={itemVariants}>
                <Card className="h-full overflow-hidden rounded-2xl border border-border/60 shadow-xl">
                  <CardHeader className="paybazaar-gradient text-white rounded-none border-b border-white/20">
                    <CardTitle className="flex items-center gap-2 text-xl">
                      <MessageSquare className="h-5 w-5" />
                      Get in Touch
                    </CardTitle>
                    <CardDescription className="text-white/90 text-sm">
                      Reach out to us through any of the following channels
                    </CardDescription>
                  </CardHeader>

                  <CardContent className="p-6">
                    <div className="space-y-6">
                      {contactInfo.map((item, index) => (
                        <motion.div
                          key={index}
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ duration: 0.5, delay: index * 0.1 }}
                          className="flex items-start gap-4 group"
                        >
                          <div
                            className={`flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl ${item.color} transition-transform duration-200 group-hover:scale-110`}
                          >
                            <item.icon className="h-5 w-5" />
                          </div>
                          <div className="flex-1">
                            <h3 className="text-sm font-semibold text-slate-700 mb-1">
                              {item.title}
                            </h3>
                            <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-line">
                              {item.value}
                            </p>
                          </div>
                        </motion.div>
                      ))}
                    </div>

                    {/* Info Note */}
                    <div className="mt-8 p-4 bg-blue-50 rounded-lg border border-blue-100">
                      <p className="text-sm text-blue-800">
                        <strong>Note:</strong> Our support team typically responds
                        within 24 hours during working days.
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>

              {/* SUPPORT FORM CARD */}
              <motion.div variants={itemVariants}>
                <Card className="h-full overflow-hidden rounded-2xl border border-border/60 shadow-xl">
                  <CardHeader className="paybazaar-gradient text-white rounded-none border-b border-white/20">
                    <CardTitle className="text-xl">Raise a Support Ticket</CardTitle>
                    <CardDescription className="text-white/90 text-sm">
                      Fill out the form below and we'll get back to you shortly
                    </CardDescription>
                  </CardHeader>

                  <CardContent className="p-6">
                    <form onSubmit={handleSubmit} className="space-y-5">
                      {/* Ticket Title Field */}
                      <div className="space-y-2">
                        <Label
                          htmlFor="ticket_title"
                          className="text-sm font-medium text-slate-700"
                        >
                          Ticket Title{" "}
                          <span className="text-red-500">*</span>
                        </Label>
                        <Input
                          id="ticket_title"
                          name="ticket_title"
                          type="text"
                          placeholder="Brief description of your issue (3-200 characters)"
                          value={formData.ticket_title}
                          onChange={handleInputChange}
                          required
                          minLength={3}
                          maxLength={200}
                          className="h-11 border-slate-200 focus:border-primary transition-colors"
                        />
                        <p className="text-xs text-slate-500">
                          {formData.ticket_title.length}/200 characters
                        </p>
                      </div>

                      {/* Ticket Description Field */}
                      <div className="space-y-2">
                        <Label
                          htmlFor="ticket_description"
                          className="text-sm font-medium text-slate-700"
                        >
                          Ticket Description{" "}
                          <span className="text-red-500">*</span>
                        </Label>
                        <Textarea
                          id="ticket_description"
                          name="ticket_description"
                          placeholder="Describe your query or issue in detail (minimum 5 characters)..."
                          value={formData.ticket_description}
                          onChange={handleInputChange}
                          className="min-h-[180px] resize-none border-slate-200 focus:border-primary transition-colors"
                          required
                          minLength={5}
                        />
                        <p className="text-xs text-slate-500">
                          Please provide as much detail as possible to help us
                          assist you better. (Minimum 5 characters)
                        </p>
                      </div>

               

                      {/* Submit Button */}
                      <Button
                        type="submit"
                        className="w-full h-12 paybazaar-gradient text-white hover:opacity-90 font-medium text-base shadow-lg hover:shadow-xl transition-all duration-200"
                        disabled={loading}
                      >
                        {loading ? (
                          <>
                            <motion.div
                              animate={{ rotate: 360 }}
                              transition={{
                                duration: 1,
                                repeat: Infinity,
                                ease: "linear",
                              }}
                              className="mr-2"
                            >
                              <Send className="h-5 w-5" />
                            </motion.div>
                            Submitting...
                          </>
                        ) : (
                          <>
                            <Send className="mr-2 h-5 w-5" />
                            Submit Ticket
                          </>
                        )}
                      </Button>

                      {/* Privacy Note */}
                      <p className="text-xs text-center text-slate-500">
                        By submitting this form, you agree to our terms of service
                        and privacy policy.
                      </p>
                    </form>
                  </CardContent>
                </Card>
              </motion.div>
            </motion.div>

            {/* Additional Help Section */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.4 }}
              className="mt-6"
            >
              <Card className="overflow-hidden rounded-2xl border border-border/60 shadow-lg">
                <CardContent className="p-6">
                  <div className="text-center space-y-3">
                    <h3 className="text-lg font-semibold text-slate-700">
                      Need Immediate Assistance?
                    </h3>
                    <p className="text-sm text-slate-600">
                      For urgent matters, please call our support hotline during
                      working hours
                    </p>
                    <div className="flex flex-wrap justify-center gap-4 pt-2">
                      <Button
                        variant="outline"
                        className="gap-2"
                        onClick={() => window.open("tel:+919311367701")}
                      >
                        <Phone className="h-4 w-4" />
                        Call Support
                      </Button>
                      <Button
                        variant="outline"
                        className="gap-2"
                        onClick={() =>
                          window.open("mailto:helpdeskpaybazaar@gmail.com")
                        }
                      >
                        <Mail className="h-4 w-4" />
                        Send Email
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default ContactUs;