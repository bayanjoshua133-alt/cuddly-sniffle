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
        paddingTop: 'env(safe-area-inset-top, 0px)',
      }}
    >
      <Toolbar sx={{ 
        py: { xs: 1, sm: 1.5 }, 
        px: { xs: 1.5, sm: 2 },
        minHeight: { xs: 56, sm: 64 },
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 1, sm: 2 }, flex: 1, minWidth: 0 }}>
          {showBack && (
            <IconButton
              edge="start"
              color="inherit"
              onClick={onBack || (() => window.history.back())}
              size="small"
              sx={{
                bgcolor: (t: Theme) => alpha(t.palette.common.white, 0.1),
                '&:hover': {
                  bgcolor: (t: Theme) => alpha(t.palette.common.white, 0.2),
                },
                borderRadius: 2,
                p: { xs: 0.75, sm: 1 },
              }}
            >
              <ArrowBackIcon sx={{ fontSize: { xs: 20, sm: 24 } }} />
            </IconButton>
          )}
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography 
              variant="h6" 
              component="h1" 
              fontWeight={700}
              sx={{ 
                fontSize: { xs: '1rem', sm: '1.25rem' },
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {title}
            </Typography>
            {subtitle && (
              <Typography 
                variant="body2" 
                sx={{ 
                  opacity: 0.9,
                  fontSize: { xs: '0.75rem', sm: '0.875rem' },
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {subtitle}
              </Typography>
            )}
          </Box>
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 0.5, sm: 1 }, flexShrink: 0 }}>
          {showThemeToggle && (
            <IconButton
              color="inherit"
              onClick={toggleTheme}
              size="small"
              sx={{
                bgcolor: (t: Theme) => alpha(t.palette.common.white, 0.1),
                '&:hover': {
                  bgcolor: (t: Theme) => alpha(t.palette.common.white, 0.2),
                },
                borderRadius: 2,
                p: { xs: 0.75, sm: 1 },
              }}
            >
              {theme === 'dark' ? <SunIcon sx={{ fontSize: { xs: 18, sm: 22 } }} /> : <MoonIcon sx={{ fontSize: { xs: 18, sm: 22 } }} />}
            </IconButton>
          )}
          
          {onNotificationClick && (
            <IconButton
              color="inherit"
              onClick={onNotificationClick}
              size="small"
              sx={{
                bgcolor: (t: Theme) => alpha(t.palette.common.white, 0.1),
                '&:hover': {
                  bgcolor: (t: Theme) => alpha(t.palette.common.white, 0.2),
                },
                borderRadius: 2,
                p: { xs: 0.75, sm: 1 },
              }}
            >
              <Badge badgeContent={notificationCount} color="error" max={9}>
                <NotificationsIcon sx={{ fontSize: { xs: 18, sm: 22 } }} />
              </Badge>
            </IconButton>
          )}

          {rightAction}

          {showMenu && onMenuToggle && (
            <IconButton
              edge="end"
              color="inherit"
              onClick={onMenuToggle}
              size="small"
              sx={{
                bgcolor: (t: Theme) => alpha(t.palette.common.white, 0.1),
                '&:hover': {
                  bgcolor: (t: Theme) => alpha(t.palette.common.white, 0.2),
                },
                borderRadius: 2,
                p: { xs: 0.75, sm: 1 },
              }}
            >
              {menuOpen ? <CloseIcon sx={{ fontSize: { xs: 20, sm: 24 } }} /> : <MenuIcon sx={{ fontSize: { xs: 20, sm: 24 } }} />}
            </IconButton>
          )}
        </Box>
      </Toolbar>
    </AppBar>
  );
}
