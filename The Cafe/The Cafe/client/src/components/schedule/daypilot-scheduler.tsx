import { useState, useCallback, useMemo } from 'react';
import { DayPilot, DayPilotScheduler } from '@daypilot/daypilot-lite-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { format, parseISO, startOfWeek, addDays } from 'date-fns';
import { apiRequest } from '@/lib/queryClient';

// MUI imports
import {
  Box,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Typography,
  Avatar,
  Snackbar,
  Alert,
  IconButton,
  Stack,
} from '@mui/material';
import {
  Close as CloseIcon,
  Delete as DeleteIcon,
} from '@mui/icons-material';

interface Shift {
  id: string;
  userId: string;
  startTime: string;
  endTime: string;
  notes?: string;
  user?: {
    firstName: string;
    lastName: string;
    role?: string;
  };
}

interface Employee {
  id: string;
  firstName: string;
  lastName: string;
  role?: string;
  position?: string;
}

interface DayPilotSchedulerProps {
  shifts: Shift[];
  employees: Employee[];
  weekStart: Date;
  onShiftUpdated?: () => void;
  isManager: boolean;
}

// Role-based colors
const ROLE_COLORS: Record<string, string> = {
  barista: '#60e81a',
  cook: '#f1e920',
  manager: '#e25dd2',
  default: '#1ac38d',
};

const getColorByRole = (role?: string): string => {
  if (!role) return ROLE_COLORS.default;
  const key = role.toLowerCase().includes('barista')
    ? 'barista'
    : role.toLowerCase().includes('cook')
    ? 'cook'
    : role.toLowerCase().includes('manager')
    ? 'manager'
    : 'default';
  return ROLE_COLORS[key];
};

// Get shift color based on time (morning = green, afternoon = yellow/orange)
const getShiftColor = (startTime: string): string => {
  const hour = parseISO(startTime).getHours();
  return hour < 12 ? '#60e81a' : '#f1e920'; // Green for morning, Yellow for afternoon
};

// Get initials from name
const getInitials = (firstName: string, lastName: string): string => {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
};

export function DayPilotSchedulerComponent({
  shifts,
  employees,
  weekStart,
  onShiftUpdated,
  isManager,
}: DayPilotSchedulerProps) {
  const queryClient = useQueryClient();

  // Dialog state
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [selectedShift, setSelectedShift] = useState<Shift | null>(null);
  const [newShiftData, setNewShiftData] = useState<{
    employeeId: string;
    start: Date;
    end: Date;
  } | null>(null);
  const [editStartTime, setEditStartTime] = useState('');
  const [editEndTime, setEditEndTime] = useState('');

  // Snackbar state
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [snackbarSeverity, setSnackbarSeverity] = useState<'success' | 'error'>('success');

  // Calculate week dates
  const startDate = useMemo(() => {
    return format(weekStart, 'yyyy-MM-dd');
  }, [weekStart]);

  // Convert employees to DayPilot resources
  const resources = useMemo(() => {
    return employees.map((emp) => ({
      name: `${emp.firstName} ${emp.lastName}`,
      id: emp.id,
      role: emp.role || emp.position || 'Employee',
      initials: getInitials(emp.firstName, emp.lastName),
      color: getColorByRole(emp.role),
    }));
  }, [employees]);

  // Convert shifts to DayPilot events
  const events = useMemo(() => {
    return shifts.map((shift) => ({
      id: shift.id,
      text: `${format(parseISO(shift.startTime), 'h:mm a')} - ${format(parseISO(shift.endTime), 'h:mm a')}`,
      start: shift.startTime,
      end: shift.endTime,
      resource: shift.userId,
      backColor: getShiftColor(shift.startTime),
      borderColor: '#00000033',
      barHidden: true,
      shift: shift, // Store original shift data
    }));
  }, [shifts]);

  // API Mutations
  const updateShiftMutation = useMutation({
    mutationFn: async ({ shiftId, startTime, endTime, userId }: { 
      shiftId: string; 
      startTime: string; 
      endTime: string;
      userId?: string;
    }) => {
      const body: Record<string, string> = { startTime, endTime };
      if (userId) body.userId = userId;
      
      const response = await apiRequest('PUT', `/api/shifts/${shiftId}`, body);
      if (!response.ok) throw new Error('Failed to update shift');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shifts'] });
      onShiftUpdated?.();
      setSnackbarMessage('Shift updated successfully');
      setSnackbarSeverity('success');
      setSnackbarOpen(true);
    },
    onError: () => {
      setSnackbarMessage('Failed to update shift');
      setSnackbarSeverity('error');
      setSnackbarOpen(true);
      queryClient.invalidateQueries({ queryKey: ['shifts'] }); // Refresh to revert UI
    },
  });

  const deleteShiftMutation = useMutation({
    mutationFn: async (shiftId: string) => {
      const response = await apiRequest('DELETE', `/api/shifts/${shiftId}`);
      if (!response.ok) throw new Error('Failed to delete shift');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shifts'] });
      onShiftUpdated?.();
      setSnackbarMessage('Shift deleted');
      setSnackbarSeverity('success');
      setSnackbarOpen(true);
    },
  });

  const createShiftMutation = useMutation({
    mutationFn: async (data: { userId: string; startTime: string; endTime: string }) => {
      const response = await apiRequest('POST', '/api/shifts', {
        ...data,
        status: 'scheduled',
      });
      if (!response.ok) throw new Error('Failed to create shift');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shifts'] });
      onShiftUpdated?.();
      setSnackbarMessage('Shift created successfully');
      setSnackbarSeverity('success');
      setSnackbarOpen(true);
    },
  });

  // Event handlers
  const handleEventMove = useCallback((args: any) => {
    if (!isManager) {
      args.preventDefault();
      return;
    }

    const shiftId = args.e.id();
    const newStart = args.newStart.toString();
    const newEnd = args.newEnd.toString();
    const newResource = args.newResource;

    updateShiftMutation.mutate({
      shiftId,
      startTime: newStart,
      endTime: newEnd,
      userId: newResource,
    });
  }, [isManager, updateShiftMutation]);

  const handleEventResize = useCallback((args: any) => {
    if (!isManager) {
      args.preventDefault();
      return;
    }

    const shiftId = args.e.id();
    const newStart = args.newStart.toString();
    const newEnd = args.newEnd.toString();

    updateShiftMutation.mutate({
      shiftId,
      startTime: newStart,
      endTime: newEnd,
    });
  }, [isManager, updateShiftMutation]);

  const handleEventClick = useCallback((args: any) => {
    if (!isManager) return;

    const eventData = args.e.data;
    const shift = eventData.shift as Shift;
    
    setSelectedShift(shift);
    setEditStartTime(format(parseISO(shift.startTime), 'HH:mm'));
    setEditEndTime(format(parseISO(shift.endTime), 'HH:mm'));
    setEditDialogOpen(true);
  }, [isManager]);

  const handleTimeRangeSelected = useCallback((args: any) => {
    if (!isManager) return;

    const startHour = args.start.getHours();
    const isMorning = startHour < 12;

    // Snap to morning (7-13) or afternoon (12-18) shift
    const start = new Date(args.start.toString());
    const end = new Date(args.start.toString());
    
    if (isMorning) {
      start.setHours(7, 0, 0, 0);
      end.setHours(13, 0, 0, 0);
    } else {
      start.setHours(12, 0, 0, 0);
      end.setHours(18, 0, 0, 0);
    }

    setNewShiftData({
      employeeId: args.resource,
      start,
      end,
    });
    setEditStartTime(format(start, 'HH:mm'));
    setEditEndTime(format(end, 'HH:mm'));
    setCreateDialogOpen(true);
  }, [isManager]);

  // Save edited shift
  const handleSaveEdit = useCallback(() => {
    if (!selectedShift) return;

    const startDate = parseISO(selectedShift.startTime);
    const [startHour, startMin] = editStartTime.split(':').map(Number);
    const [endHour, endMin] = editEndTime.split(':').map(Number);

    const newStart = new Date(startDate);
    newStart.setHours(startHour, startMin, 0, 0);

    const newEnd = new Date(startDate);
    newEnd.setHours(endHour, endMin, 0, 0);

    if (newEnd <= newStart) {
      newEnd.setDate(newEnd.getDate() + 1);
    }

    updateShiftMutation.mutate({
      shiftId: selectedShift.id,
      startTime: newStart.toISOString(),
      endTime: newEnd.toISOString(),
    });

    setEditDialogOpen(false);
    setSelectedShift(null);
  }, [selectedShift, editStartTime, editEndTime, updateShiftMutation]);

  // Create new shift
  const handleCreateShift = useCallback(() => {
    if (!newShiftData) return;

    const [startHour, startMin] = editStartTime.split(':').map(Number);
    const [endHour, endMin] = editEndTime.split(':').map(Number);

    const newStart = new Date(newShiftData.start);
    newStart.setHours(startHour, startMin, 0, 0);

    const newEnd = new Date(newShiftData.start);
    newEnd.setHours(endHour, endMin, 0, 0);

    if (newEnd <= newStart) {
      newEnd.setDate(newEnd.getDate() + 1);
    }

    createShiftMutation.mutate({
      userId: newShiftData.employeeId,
      startTime: newStart.toISOString(),
      endTime: newEnd.toISOString(),
    });

    setCreateDialogOpen(false);
    setNewShiftData(null);
  }, [newShiftData, editStartTime, editEndTime, createShiftMutation]);

  // Delete shift
  const handleDeleteShift = useCallback(() => {
    if (!selectedShift) return;
    deleteShiftMutation.mutate(selectedShift.id);
    setEditDialogOpen(false);
    setSelectedShift(null);
  }, [selectedShift, deleteShiftMutation]);

  // Scheduler configuration
  const config = useMemo(() => ({
    startDate: startDate,
    days: 7,
    scale: 'Hour',
    timeHeaders: [
      { groupBy: 'Day', format: 'dddd M/d' },
      { groupBy: 'Hour', format: 'h a' },
    ],
    cellWidth: 60,
    cellHeight: 50,
    eventHeight: 40,
    treeEnabled: false,
    rowHeaderWidth: 200,
    eventMoveHandling: isManager ? 'Update' : 'Disabled',
    eventResizeHandling: isManager ? 'Update' : 'Disabled',
    timeRangeSelectedHandling: isManager ? 'Enabled' : 'Disabled',
    businessBeginsHour: 6,
    businessEndsHour: 23,
    showNonBusiness: false,
    heightSpec: 'Auto',
    onEventMoved: handleEventMove,
    onEventResized: handleEventResize,
    onEventClick: handleEventClick,
    onTimeRangeSelected: handleTimeRangeSelected,
  }), [startDate, isManager, handleEventMove, handleEventResize, handleEventClick, handleTimeRangeSelected]);

  return (
    <Box sx={{ width: '100%' }}>
      {/* Custom resource header rendering */}
      <Box sx={{ mb: 2 }}>
        <Typography variant="h6" fontWeight={600} color="text.primary">
          Staff Schedule
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {isManager ? 'Drag shifts to move • Resize to change duration • Click to edit' : 'View only'}
        </Typography>
      </Box>

      {/* DayPilot Scheduler */}
      <Box 
        sx={{ 
          border: '1px solid',
          borderColor: 'divider',
          borderRadius: 2,
          overflow: 'hidden',
          '& .scheduler_default_main': {
            fontFamily: 'inherit',
          },
          '& .scheduler_default_rowheader_inner': {
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            padding: '8px',
          },
          '& .scheduler_default_event_inner': {
            borderRadius: '6px',
            fontSize: '12px',
            fontWeight: 600,
            padding: '4px 8px',
          },
        }}
      >
        <DayPilotScheduler
          {...config}
          resources={resources}
          events={events}
          onBeforeRowHeaderRender={(args: any) => {
            const resource = args.row.data;
            args.row.html = `
              <div style="display: flex; align-items: center; gap: 10px; padding: 8px;">
                <div style="
                  width: 36px; 
                  height: 36px; 
                  border-radius: 50%; 
                  background: ${resource.color}; 
                  display: flex; 
                  align-items: center; 
                  justify-content: center;
                  color: white;
                  font-weight: 600;
                  font-size: 14px;
                ">
                  ${resource.initials}
                </div>
                <div>
                  <div style="font-weight: 600; font-size: 14px;">${resource.name}</div>
                  <div style="font-size: 12px; opacity: 0.7;">${resource.role}</div>
                </div>
              </div>
            `;
          }}
        />
      </Box>

      {/* Edit Shift Dialog */}
      <Dialog open={editDialogOpen} onClose={() => setEditDialogOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="h6" fontWeight={600}>
            Edit Shift
          </Typography>
          <IconButton size="small" onClick={() => setEditDialogOpen(false)}>
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent>
          {selectedShift && (
            <Stack spacing={2} sx={{ mt: 1 }}>
              <Typography variant="body2" color="text.secondary">
                {selectedShift.user?.firstName} {selectedShift.user?.lastName} •{' '}
                {format(parseISO(selectedShift.startTime), 'EEEE, MMM d, yyyy')}
              </Typography>
              <TextField
                label="Start Time"
                type="time"
                value={editStartTime}
                onChange={(e) => setEditStartTime(e.target.value)}
                fullWidth
                slotProps={{ inputLabel: { shrink: true } }}
              />
              <TextField
                label="End Time"
                type="time"
                value={editEndTime}
                onChange={(e) => setEditEndTime(e.target.value)}
                fullWidth
                slotProps={{ inputLabel: { shrink: true } }}
              />
            </Stack>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2, justifyContent: 'space-between' }}>
          <Button
            color="error"
            startIcon={<DeleteIcon />}
            onClick={handleDeleteShift}
            disabled={deleteShiftMutation.isPending}
          >
            Delete
          </Button>
          <Box>
            <Button onClick={() => setEditDialogOpen(false)} sx={{ mr: 1 }}>
              Cancel
            </Button>
            <Button
              variant="contained"
              onClick={handleSaveEdit}
              disabled={updateShiftMutation.isPending}
            >
              Save
            </Button>
          </Box>
        </DialogActions>
      </Dialog>

      {/* Create Shift Dialog */}
      <Dialog open={createDialogOpen} onClose={() => setCreateDialogOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="h6" fontWeight={600}>
            Create Shift
          </Typography>
          <IconButton size="small" onClick={() => setCreateDialogOpen(false)}>
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent>
          {newShiftData && (
            <Stack spacing={2} sx={{ mt: 1 }}>
              <Typography variant="body2" color="text.secondary">
                {employees.find((e) => e.id === newShiftData.employeeId)?.firstName}{' '}
                {employees.find((e) => e.id === newShiftData.employeeId)?.lastName} •{' '}
                {format(newShiftData.start, 'EEEE, MMM d, yyyy')}
              </Typography>
              <TextField
                label="Start Time"
                type="time"
                value={editStartTime}
                onChange={(e) => setEditStartTime(e.target.value)}
                fullWidth
                slotProps={{ inputLabel: { shrink: true } }}
              />
              <TextField
                label="End Time"
                type="time"
                value={editEndTime}
                onChange={(e) => setEditEndTime(e.target.value)}
                fullWidth
                slotProps={{ inputLabel: { shrink: true } }}
              />
            </Stack>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setCreateDialogOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleCreateShift}
            disabled={createShiftMutation.isPending}
          >
            Create Shift
          </Button>
        </DialogActions>
      </Dialog>

      {/* Success/Error Snackbar */}
      <Snackbar
        open={snackbarOpen}
        autoHideDuration={3000}
        onClose={() => setSnackbarOpen(false)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
      >
        <Alert onClose={() => setSnackbarOpen(false)} severity={snackbarSeverity} sx={{ width: '100%' }}>
          {snackbarMessage}
        </Alert>
      </Snackbar>
    </Box>
  );
}

export default DayPilotSchedulerComponent;
