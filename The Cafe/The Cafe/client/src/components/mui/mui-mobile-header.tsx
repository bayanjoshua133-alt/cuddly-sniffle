import React, { useState, useEffect } from "react";
import {
  AppBar,
  Toolbar,
  IconButton,
  Typography,
  Badge,
  Box,
  alpha,
  Theme,
} from "@mui/material";
import {
  Menu as MenuIcon,
  Close as CloseIcon,
  ArrowBack as ArrowBackIcon,
  Notifications as NotificationsIcon,
  LightMode as SunIcon,
  DarkMode as MoonIcon,
} from "@mui/icons-material";

// Theme management hook
function useTheme() {
  const [theme, setThemeState] = useState<'dark' | 'light'>(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('theme');
      if (stored === 'light' || stored === 'dark') return stored;
      return 'dark';
    }
    return 'dark';
  });

  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove('light', 'dark');
    if (theme === 'light') {
      root.classList.add('light');
    }
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setThemeState((prev: 'dark' | 'light') => prev === 'dark' ? 'light' : 'dark');
  };

  return { theme, toggleTheme };
}

interface MuiMobileHeaderProps {
  title: string;
  subtitle?: string;
  showBack?: boolean;
  showMenu?: boolean;
  showThemeToggle?: boolean;
  menuOpen?: boolean;
  onMenuToggle?: () => void;
  onBack?: () => void;
  notificationCount?: number;
  onNotificationClick?: () => void;
  rightAction?: React.ReactNode;
}

export default function MuiMobileHeader({
  title,
  subtitle,
  showBack = false,
  showMenu = true,
  showThemeToggle = true,
  menuOpen = false,
  onMenuToggle,
  onBack,
  notificationCount = 0,
  onNotificationClick,
  rightAction,
}: MuiMobileHeaderProps) {
  const { theme, toggleTheme } = useTheme();
  
  return (
    <AppBar 
      position="sticky" 
      elevation={4}
      sx={{
        background: (t: Theme) => `linear-gradient(135deg, ${t.palette.primary.main} 0%, ${t.palette.primary.dark} 100%)`,
      }}
    >
      <Toolbar sx={{ py: 1.5, px: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flex: 1 }}>
          {showBack && (
            <IconButton
              edge="start"
              color="inherit"
              onClick={onBack || (() => window.history.back())}
              sx={{
                bgcolor: (t: Theme) => alpha(t.palette.common.white, 0.1),
                '&:hover': {
                  bgcolor: (t: Theme) => alpha(t.palette.common.white, 0.2),
                },
                borderRadius: 2,
              }}
            >
              <ArrowBackIcon />
            </IconButton>
          )}
          <Box sx={{ flex: 1 }}>
            <Typography variant="h6" component="h1" fontWeight={700}>
              {title}
            </Typography>
            {subtitle && (
              <Typography variant="body2" sx={{ opacity: 0.9 }}>
                {subtitle}
              </Typography>
            )}
          </Box>
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {showThemeToggle && (
            <IconButton
              color="inherit"
              onClick={toggleTheme}
              sx={{
                bgcolor: (t: Theme) => alpha(t.palette.common.white, 0.1),
                '&:hover': {
                  bgcolor: (t: Theme) => alpha(t.palette.common.white, 0.2),
                },
                borderRadius: 2,
              }}
            >
              {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
            </IconButton>
          )}
          
          {onNotificationClick && (
            <IconButton
              color="inherit"
              onClick={onNotificationClick}
              sx={{
                bgcolor: (t: Theme) => alpha(t.palette.common.white, 0.1),
                '&:hover': {
                  bgcolor: (t: Theme) => alpha(t.palette.common.white, 0.2),
                },
                borderRadius: 2,
              }}
            >
              <Badge badgeContent={notificationCount} color="error" max={9}>
                <NotificationsIcon />
              </Badge>
            </IconButton>
          )}

          {rightAction}

          {showMenu && onMenuToggle && (
            <IconButton
              edge="end"
              color="inherit"
              onClick={onMenuToggle}
              sx={{
                bgcolor: (t: Theme) => alpha(t.palette.common.white, 0.1),
                '&:hover': {
                  bgcolor: (t: Theme) => alpha(t.palette.common.white, 0.2),
                },
                borderRadius: 2,
              }}
            >
              {menuOpen ? <CloseIcon /> : <MenuIcon />}
            </IconButton>
          )}
        </Box>
      </Toolbar>
    </AppBar>
  );
}
