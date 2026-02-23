"use client";

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import axios from "axios";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Toaster } from "@/components/ui/toaster";

import {
  CreditCard,
  Clock,
  Headphones,
  Building2,
  Mail,
  Phone,
  MapPin,
  Eye,
  EyeOff,
} from "lucide-react";

const loginSchema = z.object({
  retailer_id: z
    .string() 
    .min(6, "Retailer ID must be at least 6 characters"),
  retailer_password: z
    .string()
    .min(6, "Password must be at least 6 characters"),
});

type LoginFormData = z.infer<typeof loginSchema>;

export default function Login() {
  const { toast } = useToast();
  const navigate = useNavigate();

  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      retailer_id: "",
      retailer_password: "",
    },
  });

  const onLogin = async (data: LoginFormData) => {
    setIsLoading(true);
    try {
      const response = await axios.post(
        import.meta.env.VITE_API_BASE_URL + "/retailer/login",
        {
          retailer_id: data.retailer_id,
          retailer_password: data.retailer_password,
        }
      );

      if (response.data.status === "success") {
        const token = response.data.data?.access_token;
        if (token) {
          localStorage.setItem("authToken", token);
        }

        toast({
          title: "Login Successful",
          description: "Redirecting to dashboard...",
        });

        setTimeout(() => {
          navigate("/dashboard");
        }, 1000);
      } else {
        throw new Error(response.data.message || "Login failed");
      }
    } catch (error: any) {
      toast({
        title: "Login Failed",
        description:
          error.response?.data?.message ||
          "Invalid Retailer ID or Password",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full grid grid-cols-1 md:grid-cols-2 relative">
      {/* LEFT SIDE */}
      <div className="hidden md:flex flex-col justify-center items-center bg-[#0d3154] px-12 py-16 text-white gap-8">
        <div className="flex flex-col items-center max-w-lg text-center space-y-6">
          <img
            src="/login-page.png"
            alt="PayBazaar Illustration"
            className="w-56 h-52 object-contain drop-shadow-lg"
          />
          <h2 className="text-3xl font-extrabold tracking-wide leading-tight">
            PayBazaar: Secure & Reliable Payments
          </h2>
          <p className="text-slate-200 text-sm leading-relaxed max-w-md">
            PAYBAZAAR empowers inclusive financial growth through technology,
            reaching every corner of the nation.
          </p>

          <ul className="flex justify-center gap-10 text-xs text-slate-200 mt-4">
            <li className="flex items-center gap-2 font-semibold">
              <Clock className="w-5 h-5 text-white" /> 1-hour settlements
            </li>
            <li className="flex items-center gap-2 font-semibold">
              <Headphones className="w-5 h-5 text-white" /> 24/7 Support
            </li>
          </ul>

          <Card className="w-full shadow-xl border-0 rounded-2xl bg-white backdrop-blur-lg border-white/20">
            <CardHeader>
              <CardTitle className="text-lg font-semibold text-[#0d3154] flex items-center gap-3">
                <Building2 className="w-6 h-6 text-[#0d3154]" /> Company Info
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-xs text-slate-700">
              <p className="flex items-center gap-3">
                <Mail className="w-5 h-5 text-[#0d3154]" /> info@paybazaar.in
              </p>
              <p className="flex items-center gap-3">
                <Phone className="w-5 h-5 text-[#0d3154]" /> +91 9319187762
              </p>
              <div className="flex items-start">
                <MapPin className="w-5 h-5 text-[#0d3154] mt-1" />
                <span className="text-xs text-slate-700 leading-relaxed">
                  Unit 902, Tower B4 on 9th Spaze I-Tech Park, Sector-49, Sohna
                  Road, Gurugram, Haryana, 122018.
                </span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* RIGHT SIDE */}
      <div className="flex justify-center items-center px-10 lg:px-20 bg-white min-h-screen overflow-auto">
        <div className="w-full max-w-md space-y-10">
          <div className="text-center space-y-4">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-tr from-[#0d3154] to-blue-900 rounded-3xl shadow-2xl">
              <CreditCard className="w-10 h-10 text-white drop-shadow" />
            </div>
            <h1 className="text-3xl font-extrabold text-slate-900 tracking-wide">
              Welcome to PayBazaar!
            </h1>
            <p className="text-slate-600 text-base font-medium">
              Enter your credentials to continue
            </p>
          </div>

          <Card className="shadow-2xl border-0 bg-white/95 backdrop-blur-md rounded-3xl">
            <CardHeader className="text-center pb-8">
              <CardTitle className="text-3xl font-bold text-[#0d3154] tracking-tight">
                Retailer Sign In
              </CardTitle>
              <CardDescription className="text-slate-600 text-base font-medium">
                Login to access your dashboard
              </CardDescription>
            </CardHeader>

            <CardContent>
              <form onSubmit={handleSubmit(onLogin)} className="space-y-6">

                <div className="space-y-3">
                  <Label
                    htmlFor="retailer_id"
                    className="text-md font-semibold text-slate-800"
                  >
                   Retailer ID
                  </Label>
                  <Input
                    id="retailer_id"
                    type="text"
                    placeholder="Enter your retailer ID"
                    {...register("retailer_id")}
                    className="h-14 bg-slate-50 border border-slate-300 rounded-xl focus:border-[#0d3154] focus:ring-[#0d3154]/50 text-lg"
                    disabled={isLoading}
                  />
                  {errors.retailer_id && (
                    <p className="text-sm text-destructive">
                      {errors.retailer_id.message}
                    </p>
                  )}
                </div>

                {/* Password */}
                <div className="space-y-3">
                  <Label
                    htmlFor="password"
                    className="text-md font-semibold text-slate-800"
                  >
                    Password
                  </Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      placeholder="Enter your password"
                      {...register("retailer_password")}
                      className="h-14 bg-slate-50 border border-slate-300 rounded-xl focus:border-[#0d3154] focus:ring-[#0d3154]/50 text-lg pr-12"
                      disabled={isLoading}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-700 transition-colors"
                      tabIndex={-1}
                    >
                      {showPassword ? (
                        <EyeOff className="w-5 h-5" />
                      ) : (
                        <Eye className="w-5 h-5" />
                      )}
                    </button>
                  </div>
                  {errors.retailer_password && (
                    <p className="text-sm text-destructive">
                      {errors.retailer_password.message}
                    </p>
                  )}
                </div>

                <Button
                  type="submit"
                  disabled={isLoading}
                  className="w-full h-14 bg-gradient-to-r from-[#0d3154] to-blue-900 text-white font-semibold text-lg rounded-xl shadow-lg hover:opacity-90 transition-opacity duration-300"
                >
                  {isLoading ? "Signing in..." : "Sign In"}
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Footer */}
          <div className="text-center space-y-3">
            <p className="text-xs text-slate-500">
              Are you a distributor?{" "}
              <a
                href="https://distributor.paybazaar.in"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#0d3154] font-semibold hover:underline"
              >
                Login here
              </a>
            </p>
            <p className="text-xs text-slate-500">
              Designed and developed by{" "}
              <a
                href="https://gvinfotech.org/"
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold text-slate-700"
              >
                GV Infotech
              </a>
            </p>
          </div>
        </div>
      </div>

      <Toaster />
    </div>
  );
}