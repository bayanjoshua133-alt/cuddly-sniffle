import { useState } from "react";
import {
  Box,
  Drawer,
  AppBar,
  Toolbar,
  IconButton,
  Typography,
  useTheme,
  useMediaQuery,
  Menu,
  MenuItem,
  Avatar,
  Stack,
  Divider,
  alpha,
} from "@mui/material";
import {
  Menu as MenuIcon,
  Close as CloseIcon,
  LogoutRounded as LogoutIcon,
  SettingsRounded as SettingsIcon,
  HomeRounded as HomeIcon,
  SwapHorizRounded as ShiftIcon,
  EventRoundedIcon,
  PeopleRoundedIcon,
  PaymentsRoundedIcon,
  AssignmentRoundedIcon,
  NotificationsRoundedIcon,
} from "@mui/icons-material";
import { useLocation } from "wouter";
import { logout } from "@/lib/auth";

interface ModernLayoutProps {
  children: React.ReactNode;
}

const navItems = [
  { icon: HomeIcon, label: "Dashboard", path: "/dashboard" },
  { icon: ShiftIcon, label: "Shift Trading", path: "/shift-trading" },
  { icon: EventRoundedIcon, label: "Schedule", path: "/schedule" },
  { icon: AssignmentRoundedIcon, label: "Time Off", path: "/time-off" },
  { icon: PeopleRoundedIcon, label: "Employees", path: "/employees" },
  { icon: PaymentsRoundedIcon, label: "Payroll", path: "/payroll" },
  { icon: NotificationsRoundedIcon, label: "Notifications", path: "/notifications" },
];

const SIDEBAR_WIDTH = 280;
const DRAWER_OPEN_DURATION = 225;

export default function ModernLayout({ children }: ModernLayoutProps) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));
  const [, navigate] = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(!isMobile);
  const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null);

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  const handleNavigation = (path: string) => {
    navigate(path);
    if (isMobile) setSidebarOpen(false);
  };

  // Sidebar content
  const sidebarContent = (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        bgcolor: theme.palette.mode === "dark" ? "grey.900" : "grey.50",
      }}
    >
      {/* Logo/Header */}
      <Box
        sx={{
          p: 2.5,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          borderBottom: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
        }}
      >
        <Typography variant="h6" fontWeight={700} sx={{ background: `linear-gradient(135deg, ${theme.palette.primary.main}, ${theme.palette.secondary.main})`, backgroundClip: "text", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
          ☕ The Cafe
        </Typography>
        {isMobile && (
          <IconButton
            onClick={() => setSidebarOpen(false)}
            size="small"
            sx={{
              borderRadius: 1,
              "&:hover": { bgcolor: alpha(theme.palette.action.hover, 0.5) },
            }}
          >
            <CloseIcon />
          </IconButton>
        )}
      </Box>

      {/* Navigation items */}
      <Box
        sx={{
          flex: 1,
          overflowY: "auto",
          p: 1.5,
          "&::-webkit-scrollbar": {
            width: 6,
          },
          "&::-webkit-scrollbar-thumb": {
            bgcolor: alpha(theme.palette.action.active, 0.3),
            borderRadius: 3,
            "&:hover": { bgcolor: alpha(theme.palette.action.active, 0.5) },
          },
        }}
      >
        <Stack spacing={0.5}>
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = window.location.pathname.includes(item.path);

            return (
              <Box
                key={item.path}
                onClick={() => handleNavigation(item.path)}
                sx={{
                  display: "flex",
                  alignItems: "center",
                  gap: 2,
                  px: 2,
                  py: 1.5,
                  borderRadius: 1.5,
                  cursor: "pointer",
                  transition: "all 0.2s ease",
                  bgcolor: isActive ? alpha(theme.palette.primary.main, 0.1) : "transparent",
                  color: isActive ? theme.palette.primary.main : "text.secondary",
                  borderLeft: isActive ? `3px solid ${theme.palette.primary.main}` : "3px solid transparent",
                  "&:hover": {
                    bgcolor: alpha(theme.palette.primary.main, 0.05),
                    color: isActive ? theme.palette.primary.main : "text.primary",
                  },
                }}
              >
                <Icon sx={{ fontSize: 20 }} />
                <Typography variant="body2" fontWeight={isActive ? 600 : 500} sx={{ userSelect: "none" }}>
                  {item.label}
                </Typography>
              </Box>
            );
          })}
        </Stack>
      </Box>

      {/* Bottom actions */}
      <Box
        sx={{
          p: 1.5,
          borderTop: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
        }}
      >
        <Stack spacing={0.5}>
          <Box
            onClick={(e) => setMenuAnchor(e.currentTarget)}
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 1.5,
              p: 1.5,
              borderRadius: 1.5,
              cursor: "pointer",
              transition: "all 0.2s ease",
              bgcolor: alpha(theme.palette.action.hover, 0.3),
              "&:hover": {
                bgcolor: alpha(theme.palette.action.hover, 0.6),
              },
            }}
          >
            <Avatar sx={{ width: 36, height: 36, bgcolor: "primary.main" }}>JD</Avatar>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography variant="body2" fontWeight={600} noWrap>
                John Doe
              </Typography>
              <Typography variant="caption" color="text.secondary" noWrap>
                Employee
              </Typography>
            </Box>
          </Box>
        </Stack>
      </Box>
    </Box>
  );

  return (
    <Box sx={{ display: "flex" }}>
      {/* Desktop Sidebar */}
      <Box
        sx={{
          width: isMobile ? 0 : SIDEBAR_WIDTH,
          height: "100vh",
          position: "sticky",
          top: 0,
          overflow: "hidden",
          borderRight: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
          transition: `width ${DRAWER_OPEN_DURATION}ms cubic-bezier(0.4, 0, 0.2, 1)`,
        }}
      >
        {!isMobile && sidebarContent}
      </Box>

      {/* Mobile Drawer */}
      <Drawer
        anchor="left"
        open={sidebarOpen && isMobile}
        onClose={() => setSidebarOpen(false)}
        sx={{
          display: { xs: "block", md: "none" },
          "& .MuiDrawer-paper": {
            width: SIDEBAR_WIDTH,
            boxSizing: "border-box",
          },
        }}
      >
        {sidebarContent}
      </Drawer>

      {/* Main content */}
      <Box sx={{ flex: 1, display: "flex", flexDirection: "column" }}>
        {/* Top app bar */}
        <AppBar
          position="sticky"
          elevation={0}
          sx={{
            bgcolor: theme.palette.background.paper,
            borderBottom: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
            backdropFilter: "blur(10px)",
            backgroundColor: alpha(theme.palette.background.paper, 0.8),
          }}
        >
          <Toolbar>
            {isMobile && (
              <IconButton
                edge="start"
                color="inherit"
                onClick={() => setSidebarOpen(true)}
                sx={{ mr: 2 }}
              >
                <MenuIcon />
              </IconButton>
            )}
            <Typography variant="body1" sx={{ flex: 1 }} color="text.primary">
              {/* Breadcrumb or page title could go here */}
            </Typography>
            <Stack direction="row" spacing={1}>
              <IconButton
                size="small"
                onClick={(e) => setMenuAnchor(e.currentTarget)}
                sx={{
                  borderRadius: 1,
                  border: `1px solid ${alpha(theme.palette.divider, 0.2)}`,
                }}
              >
                <Avatar sx={{ width: 32, height: 32, bgcolor: "primary.main", fontSize: "0.875rem" }}>
                  JD
                </Avatar>
              </IconButton>
            </Stack>
          </Toolbar>
        </AppBar>

        {/* Page content */}
        <Box
          component="main"
          sx={{
            flex: 1,
            overflowY: "auto",
            bgcolor: theme.palette.mode === "dark" ? "grey.900" : "grey.50",
          }}
        >
          {children}
        </Box>
      </Box>

      {/* User menu */}
      <Menu
        anchorEl={menuAnchor}
        open={Boolean(menuAnchor)}
        onClose={() => setMenuAnchor(null)}
        transformOrigin={{ horizontal: "right", vertical: "top" }}
        anchorOrigin={{ horizontal: "right", vertical: "bottom" }}
      >
          <MenuItem onClick={() => navigate("/profile")}>
          <SettingsIcon sx={{ mr: 1.5, fontSize: 20 }} />
          <Typography variant="body2">Profile Settings</Typography>
        </MenuItem>
        <Divider sx={{ my: 0.5 }} />
        <MenuItem onClick={handleLogout}>
          <LogoutIcon sx={{ mr: 1.5, fontSize: 20, color: "error.main" }} />
          <Typography variant="body2" color="error">
            Logout
          </Typography>
        </MenuItem>
      </Menu>
    </Box>
  );
}
