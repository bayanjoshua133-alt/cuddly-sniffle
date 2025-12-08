import { Route, Switch, Redirect, useLocation } from "wouter";
import ErrorBoundary from "@/components/layout/error-boundary";
import { queryClient, apiRequest } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useState, useCallback, Suspense, lazy } from "react";
import { getAuthState, setAuthState, subscribeToAuth } from "./lib/auth";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";

// Theme Providers
import { ThemeProvider } from "@/components/theme-provider";
import { MuiThemeProvider } from "@/components/mui/mui-theme-provider";

// Modern Layout (with responsive sidebar)
import ModernLayout from "@/components/layout/modern-layout";
import ShiftTradingPanel from "@/components/shift-trading/shift-trading-panel";

// Real-time hook
import { useRealtime } from "@/hooks/use-realtime";

// MUI Components
import { Box, CircularProgress, Typography, Button, alpha } from "@mui/material";
import { LocalCafe as CoffeeIcon } from "@mui/icons-material";

// MUI Layout Components
import MuiSidebar from "@/components/mui/mui-sidebar";
import MuiHeader from "@/components/mui/mui-header";

// MUI-based Pages - Lazy loaded for code splitting
const MuiDashboard = lazy(() => import("@/pages/mui-dashboard"));
const MuiEmployees = lazy(() => import("@/pages/mui-employees"));
const MuiSchedule = lazy(() => import("@/pages/mui-schedule"));
const MuiPayroll = lazy(() => import("@/pages/mui-payroll"));
const MuiNotifications = lazy(() => import("@/pages/mui-notifications"));
const MuiBranches = lazy(() => import("@/pages/mui-branches"));
const MuiReports = lazy(() => import("@/pages/mui-reports"));
const MuiLogin = lazy(() => import("@/pages/mui-login"));
const MuiTimeOff = lazy(() => import("@/pages/mui-time-off"));
const MuiDeductionSettings = lazy(() => import("@/pages/mui-deduction-settings"));
const MuiPayrollManagement = lazy(() => import("@/pages/mui-payroll-management"));
const MuiAdminDeductionRates = lazy(() => import("@/pages/mui-admin-deduction-rates"));
const PayslipDemo = lazy(() => import("@/pages/payslip-demo"));
const Setup = lazy(() => import("@/pages/setup"));
const NotFound = lazy(() => import("@/pages/not-found"));

// Mobile Pages - Lazy loaded for code splitting
const MobileDashboard = lazy(() => import("@/pages/mobile-dashboard"));
const MobileSchedule = lazy(() => import("@/pages/mobile-schedule"));
const MobilePayroll = lazy(() => import("@/pages/mobile-payroll"));
const MobileNotifications = lazy(() => import("@/pages/mobile-notifications"));
const MobileTimeOff = lazy(() => import("@/pages/mobile-time-off"));
const MobileProfile = lazy(() => import("@/pages/mobile-profile"));
const MobileMore = lazy(() => import("@/pages/mobile-more"));
const MobileClock = lazy(() => import("@/pages/mobile-clock"));

function LoadingFallback() {
  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "100vh",
        bgcolor: "background.default",
      }}
    >
      <CircularProgress sx={{ mb: 2 }} />
      <Typography color="textSecondary">Loading...</Typography>
    </Box>
  );
}

interface AuthState {
  authenticated: boolean;
  user?: any;
}

function AppRoutes() {
  const [location] = useLocation();
  const [authState, setAuthStateLocal] = useState<AuthState>(() => {
    const state = getAuthState();
    return {
      authenticated: !!state.user,
      user: state.user,
    };
  });
  const [hydrated, setHydrated] = useState(false);

  // Real-time updates subscription
  const { isConnected } = useRealtime({
    enabled: authState.authenticated,
    queryKeys: ["shift-trades", "employee-shifts"],
  });

  useEffect(() => {
    const unsubscribe = subscribeToAuth((newAuthState) => {
      setAuthStateLocal({
        authenticated: !!newAuthState.user,
        user: newAuthState.user,
      });
    });

    // Check auth on mount
    const verifyAuth = async () => {
      try {
        const response = await apiRequest("GET", "/api/verify-auth");
        const data = await response.json();
        if (data.authenticated) {
          setAuthState(data.user);
          setAuthStateLocal({
            authenticated: true,
            user: data.user,
          });
        } else {
          setAuthState(null);
          setAuthStateLocal({
            authenticated: false,
          });
        }
      } catch {
        setAuthState(null);
        setAuthStateLocal({
          authenticated: false,
        });
      }
      setHydrated(true);
    };

    verifyAuth();
    return unsubscribe;
  }, []);

  if (!hydrated) {
    return <LoadingFallback />;
  }

  const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
  const isLoginPage = location === "/login" || location === "/setup";

  return (
    <ErrorBoundary>
      <Suspense fallback={<LoadingFallback />}>
        {!authState.authenticated ? (
          // Login/Public Routes
          <Switch>
            <Route path="/login" component={() => <MuiLogin />} />
            <Route path="/setup" component={() => <Setup />} />
            <Route path="*" component={() => <Redirect to="/login" />} />
          </Switch>
        ) : (
          // Authenticated Routes with Modern Layout
          <ModernLayout>
            <Switch>
              {/* Desktop Routes */}
              {!isMobile ? (
                <>
                  <Route path="/dashboard" component={() => <MuiDashboard />} />
                  <Route path="/shift-trading" component={() => <ShiftTradingPanel />} />
                  <Route path="/schedule" component={() => <MuiSchedule />} />
                  <Route path="/time-off" component={() => <MuiTimeOff />} />
                  <Route path="/employees" component={() => <MuiEmployees />} />
                  <Route path="/payroll" component={() => <MuiPayroll />} />
                  <Route path="/payroll-management" component={() => <MuiPayrollManagement />} />
                  <Route path="/notifications" component={() => <MuiNotifications />} />
                  <Route path="/branches" component={() => <MuiBranches />} />
                  <Route path="/reports" component={() => <MuiReports />} />
                  <Route path="/deduction-settings" component={() => <MuiDeductionSettings />} />
                  <Route path="/deduction-rates" component={() => <MuiAdminDeductionRates />} />
                  <Route path="/payslip" component={() => <PayslipDemo />} />
                  <Route path="/" component={() => <Redirect to="/dashboard" />} />
                  <Route component={() => <NotFound />} />
                </>
              ) : (
                // Mobile Routes (without ModernLayout sidebar - use mobile-specific navs)
                <>
                  <Route path="/dashboard" component={() => <MobileDashboard />} />
                  <Route path="/shift-trading" component={() => <ShiftTradingPanel />} />
                  <Route path="/schedule" component={() => <MobileSchedule />} />
                  <Route path="/time-off" component={() => <MobileTimeOff />} />
                  <Route path="/payroll" component={() => <MobilePayroll />} />
                  <Route path="/clock" component={() => <MobileClock />} />
                  <Route path="/notifications" component={() => <MobileNotifications />} />
                  <Route path="/profile" component={() => <MobileProfile />} />
                  <Route path="/more" component={() => <MobileMore />} />
                  <Route path="/" component={() => <Redirect to="/dashboard" />} />
                  <Route component={() => <NotFound />} />
                </>
              )}
            </Switch>

            {/* Real-time status indicator (optional) */}
            {/* {!isConnected && authState.authenticated && (
              <Box sx={{ position: 'fixed', bottom: 20, right: 20, bgcolor: 'warning.main', color: 'white', p: 1, borderRadius: 1 }}>
                Reconnecting to real-time updates...
              </Box>
            )} */}
          </ModernLayout>
        )}
      </Suspense>
    </ErrorBoundary>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <MuiThemeProvider>
        <QueryClientProvider client={queryClient}>
          <TooltipProvider>
            <Toaster />
            <AppRoutes />
          </TooltipProvider>
        </QueryClientProvider>
      </MuiThemeProvider>
    </ThemeProvider>
  );
}
