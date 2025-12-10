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
    if (location === "/employee" || location === "/employee/dashboard") return 0;
    if (location === "/employee/schedule") return 1;
    if (location === "/employee/payroll") return 2;
    if (location === "/employee/profile") return 3;
    if (location === "/employee/more") return 4;
    return 0;
  };

  const handleNavChange = (_event: React.SyntheticEvent, newValue: number) => {
    const paths = [
      "/employee/dashboard",
      "/employee/schedule",
      "/employee/payroll",
      "/employee/profile",
      "/employee/more",
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
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
      }} 
      elevation={8}
    >
      <BottomNavigation
        showLabels
        value={getNavValue()}
        onChange={handleNavChange}
        sx={{
          height: { xs: 60, sm: 70 },
          '& .MuiBottomNavigationAction-root': {
            minWidth: { xs: 48, sm: 64 },
            py: { xs: 1, sm: 1.5 },
            px: { xs: 0.5, sm: 1 },
            borderRadius: 2,
            mx: { xs: 0.25, sm: 0.5 },
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
            fontSize: { xs: '0.625rem', sm: '0.75rem' },
            fontWeight: 500,
            mt: 0.5,
          },
          '& .MuiSvgIcon-root': {
            fontSize: { xs: '1.25rem', sm: '1.5rem' },
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
                width: { xs: 24, sm: 28 },
                height: { xs: 24, sm: 28 },
                fontSize: { xs: '0.625rem', sm: '0.75rem' },
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
