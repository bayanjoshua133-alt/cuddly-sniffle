import React from "react";
import { useLocation } from "wouter";
import {
  BottomNavigation,
  BottomNavigationAction,
  Badge,
  Avatar,
  Paper,
  alpha,
  Theme,
} from "@mui/material";
import {
  Home as HomeIcon,
  CalendarMonth as CalendarIcon,
  AttachMoney as MoneyIcon,
  MoreHoriz as MoreIcon,
} from "@mui/icons-material";
import { getCurrentUser } from "@/lib/auth";

interface MuiMobileBottomNavProps {
  notificationCount?: number;
}

export default function MuiMobileBottomNav({ notificationCount = 0 }: MuiMobileBottomNavProps) {
  const [location, setLocation] = useLocation();
  const currentUser = getCurrentUser();

  // Map current location to nav value
  const getNavValue = () => {
    if (location === "/" || location === "/mobile-dashboard") return 0;
    if (location === "/schedule" || location === "/mobile-schedule") return 1;
    if (location === "/payroll" || location === "/mobile-payroll") return 2;
    if (location === "/profile" || location === "/mobile-profile") return 3;
    if (location === "/more" || location === "/mobile-more") return 4;
    return 0;
  };

  const handleNavChange = (_event: React.SyntheticEvent, newValue: number) => {
    const paths = [
      "/mobile-dashboard",
      "/mobile-schedule",
      "/mobile-payroll",
      "/mobile-profile",
      "/mobile-more",
    ];
    setLocation(paths[newValue]);
  };

  return (
    <Paper 
      sx={{ 
        position: 'fixed', 
        bottom: 0, 
        left: 0, 
        right: 0,
        zIndex: 1100,
        borderTop: 2,
        borderColor: 'divider',
        bgcolor: (t: Theme) => alpha(t.palette.background.paper, 0.95),
        backdropFilter: 'blur(20px)',
      }} 
      elevation={8}
    >
      <BottomNavigation
        showLabels
        value={getNavValue()}
        onChange={handleNavChange}
        sx={{
          height: 70,
          '& .MuiBottomNavigationAction-root': {
            minWidth: 64,
            py: 1.5,
            borderRadius: 3,
            mx: 0.5,
            transition: 'all 0.2s',
            '&.Mui-selected': {
              bgcolor: (t: Theme) => alpha(t.palette.primary.main, 0.1),
              '& .MuiBottomNavigationAction-label': {
                fontWeight: 600,
              },
            },
            '&:active': {
              transform: 'scale(0.95)',
            },
          },
          '& .MuiBottomNavigationAction-label': {
            fontSize: '0.75rem',
            fontWeight: 500,
            mt: 0.5,
          },
        }}
      >
        <BottomNavigationAction 
          label="Home" 
          icon={<HomeIcon />} 
        />
        <BottomNavigationAction 
          label="Schedule" 
          icon={<CalendarIcon />} 
        />
        <BottomNavigationAction 
          label="Pay" 
          icon={<MoneyIcon />} 
        />
        <BottomNavigationAction 
          label="Profile" 
          icon={
            <Avatar
              sx={{
                width: 28,
                height: 28,
                fontSize: '0.75rem',
                fontWeight: 700,
                bgcolor: getNavValue() === 3 ? 'primary.main' : 'grey.400',
                border: getNavValue() === 3 ? 2 : 0,
                borderColor: (t: Theme) => alpha(t.palette.primary.main, 0.3),
              }}
            >
              {currentUser?.firstName?.[0]}{currentUser?.lastName?.[0]}
            </Avatar>
          } 
        />
        <BottomNavigationAction 
          label="More" 
          icon={
            <Badge badgeContent={notificationCount} color="error" max={9}>
              <MoreIcon />
            </Badge>
          } 
        />
      </BottomNavigation>
    </Paper>
  );
}
