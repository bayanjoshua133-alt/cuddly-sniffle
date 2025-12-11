import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin, { Draggable } from '@fullcalendar/interaction';
import {
  Box,
  Paper,
  Typography,
  CircularProgress,
  Snackbar,
  Alert,
  Drawer,
  IconButton,
  Avatar,
  Chip,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Stack,
  Tooltip,
  Divider,
} from '@mui/material';
import {
  ContentCopy as CopyIcon,
  ContentPaste as PasteIcon,
  People as PeopleIcon,
  Close as CloseIcon,
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  ChevronLeft as ChevronLeftIcon,
  ChevronRight as ChevronRightIcon,
  FileCopy as CopyWeekIcon,
} from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { format, addDays, startOfWeek, endOfWeek, parseISO, differenceInMilliseconds } from 'date-fns';

// --- Types ---
interface Shift {
  id: string;
  userId: string;
  startTime: string;
  endTime: string;
  title?: string;
  notes?: string;
  user?: {
    id: string;
    firstName: string;
    lastName: string;
    role?: string;
    username?: string;
  };
}

interface Employee {
  id: string;
  firstName: string;
  lastName: string;
  role?: string;
  username?: string;
  isActive?: boolean;
}

// Employee color palette - 2025 modern colors
const EMPLOYEE_COLORS = [
  { bg: '#3B82F6', text: '#FFFFFF' }, // Blue
  { bg: '#10B981', text: '#FFFFFF' }, // Emerald
  { bg: '#8B5CF6', text: '#FFFFFF' }, // Violet
  { bg: '#F59E0B', text: '#000000' }, // Amber
  { bg: '#EF4444', text: '#FFFFFF' }, // Red
  { bg: '#EC4899', text: '#FFFFFF' }, // Pink
  { bg: '#06B6D4', text: '#FFFFFF' }, // Cyan
  { bg: '#84CC16', text: '#000000' }, // Lime
  { bg: '#6366F1', text: '#FFFFFF' }, // Indigo
  { bg: '#14B8A6', text: '#FFFFFF' }, // Teal
];

const getEmployeeColor = (employeeId: string, employees: Employee[]) => {
  const index = employees.findIndex(e => e.id === employeeId);
  return EMPLOYEE_COLORS[index % EMPLOYEE_COLORS.length] || EMPLOYEE_COLORS[0];
};

// --- Enhanced Scheduler Component ---
const EnhancedScheduler = () => {
  const queryClient = useQueryClient();
  const calendarRef = useRef<any>(null);
  const rosterRef = useRef<HTMLDivElement>(null);

  // UI State
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' as 'success' | 'error' | 'info' });
  const [rosterOpen, setRosterOpen] = useState(false);
  const [currentWeekStart, setCurrentWeekStart] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }));

  // Clipboard State
  const [clipboardShift, setClipboardShift] = useState<Shift | null>(null);
  const [clipboardWeek, setClipboardWeek] = useState<Shift[] | null>(null);
  const [clipboardWeekStart, setClipboardWeekStart] = useState<Date | null>(null);

  // Modal State
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [selectedShift, setSelectedShift] = useState<Shift | null>(null);
  const [newShiftData, setNewShiftData] = useState({
    employeeId: '',
    startTime: '',
    endTime: '',
    notes: '',
  });

  // Fetch Shifts
  const { data: shiftsData, isLoading: shiftsLoading } = useQuery<{ shifts: Shift[] }>({
    queryKey: ['shifts', 'branch'],
    queryFn: async () => {
      const res = await apiRequest('GET', '/api/shifts/branch');
      return res.json();
    },
  });

  // Fetch Employees
  const { data: employeesData, isLoading: employeesLoading } = useQuery<{ employees: Employee[] }>({
    queryKey: ['employees'],
    queryFn: async () => {
      const res = await apiRequest('GET', '/api/employees');
      return res.json();
    },
  });

  const shifts = shiftsData?.shifts || [];
  const employees = (employeesData?.employees || []).filter(e => e.isActive !== false);

  // Mutations
  const createShiftMutation = useMutation({
    mutationFn: async (payload: { userId: string; startTime: string; endTime: string; notes?: string }) => {
      const res = await apiRequest('POST', '/api/shifts', payload);
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || 'Failed to create shift');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shifts'] });
      setSnackbar({ open: true, message: 'Shift created!', severity: 'success' });
      setCreateModalOpen(false);
      resetNewShiftData();
    },
    onError: (error: Error) => {
      setSnackbar({ open: true, message: error.message, severity: 'error' });
    },
  });

  const updateShiftMutation = useMutation({
    mutationFn: async (payload: { id: string; startTime?: string; endTime?: string; notes?: string }) => {
      const { id, ...data } = payload;
      const res = await apiRequest('PUT', `/api/shifts/${id}`, data);
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || 'Failed to update shift');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shifts'] });
      setSnackbar({ open: true, message: 'Shift updated!', severity: 'success' });
      setEditModalOpen(false);
    },
    onError: (error: Error) => {
      setSnackbar({ open: true, message: error.message, severity: 'error' });
    },
  });

  const deleteShiftMutation = useMutation({
    mutationFn: async (shiftId: string) => {
      const res = await apiRequest('DELETE', `/api/shifts/${shiftId}`);
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || 'Failed to delete shift');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shifts'] });
      setSnackbar({ open: true, message: 'Shift deleted!', severity: 'success' });
      setDeleteConfirmOpen(false);
      setSelectedShift(null);
    },
    onError: (error: Error) => {
      setSnackbar({ open: true, message: error.message, severity: 'error' });
    },
  });

  // Helper Functions
  const resetNewShiftData = () => {
    setNewShiftData({ employeeId: '', startTime: '', endTime: '', notes: '' });
  };

  const getEmployeeName = (userId: string) => {
    const emp = employees.find(e => e.id === userId);
    return emp ? `${emp.firstName} ${emp.lastName}` : 'Unknown';
  };

  const getEmployeeRole = (userId: string) => {
    const emp = employees.find(e => e.id === userId);
    return emp?.role || '';
  };

  // Map shifts to FullCalendar events with employee color-coding
  const calendarEvents = useMemo(() => {
    return shifts.map(shift => {
      const colors = getEmployeeColor(shift.userId, employees);
      const empName = shift.user 
        ? `${shift.user.firstName} ${shift.user.lastName}` 
        : getEmployeeName(shift.userId);
      const role = shift.user?.role || getEmployeeRole(shift.userId);
      
      return {
        id: shift.id,
        title: `${empName}${role ? ` • ${role}` : ''}`,
        start: shift.startTime,
        end: shift.endTime,
        backgroundColor: colors.bg,
        borderColor: colors.bg,
        textColor: colors.text,
        extendedProps: { shift, employeeId: shift.userId },
      };
    });
  }, [shifts, employees]);

  // FullCalendar Event Handlers
  const handleEventDrop = useCallback((info: any) => {
    const { event } = info;
    updateShiftMutation.mutate({
      id: event.id,
      startTime: event.startStr,
      endTime: event.endStr,
    });
  }, [updateShiftMutation]);

  const handleEventResize = useCallback((info: any) => {
    const { event } = info;
    updateShiftMutation.mutate({
      id: event.id,
      startTime: event.startStr,
      endTime: event.endStr,
    });
  }, [updateShiftMutation]);

  const handleEventClick = useCallback((info: any) => {
    const shift = info.event.extendedProps.shift as Shift;
    setSelectedShift(shift);
    setEditModalOpen(true);
  }, []);

  const handleDateSelect = useCallback((info: any) => {
    setNewShiftData(prev => ({
      ...prev,
      startTime: info.startStr,
      endTime: info.endStr,
    }));
    setCreateModalOpen(true);
  }, []);

  // External Drop from Employee Roster
  const handleExternalDrop = useCallback((info: any) => {
    const employeeData = info.draggedEl.getAttribute('data-employee');
    if (!employeeData) return;
    
    const employee = JSON.parse(employeeData) as Employee;
    const start = info.dateStr || info.date?.toISOString();
    
    if (start) {
      const startDate = new Date(start);
      const endDate = new Date(startDate.getTime() + 4 * 60 * 60 * 1000); // Default 4 hour shift
      
      setNewShiftData({
        employeeId: employee.id,
        startTime: startDate.toISOString(),
        endTime: endDate.toISOString(),
        notes: '',
      });
      setCreateModalOpen(true);
    }
  }, []);

  // Initialize external draggable for employee roster
  useEffect(() => {
    if (rosterRef.current && rosterOpen) {
      const draggable = new Draggable(rosterRef.current, {
        itemSelector: '.draggable-employee',
        eventData: (eventEl) => {
          const empData = eventEl.getAttribute('data-employee');
          const emp = empData ? JSON.parse(empData) : null;
          return {
            title: emp ? `${emp.firstName} ${emp.lastName}` : 'New Shift',
            duration: '04:00',
            create: false, // We'll handle creation manually
          };
        },
      });
      return () => draggable.destroy();
    }
  }, [rosterOpen, employees]);

  // Copy/Paste Shift Functions
  const handleCopyShift = useCallback((shift: Shift) => {
    setClipboardShift(shift);
    setSnackbar({ open: true, message: 'Shift copied! Click a time slot to paste.', severity: 'info' });
  }, []);

  const handlePasteShift = useCallback((start: Date) => {
    if (!clipboardShift) return;

    const originalStart = new Date(clipboardShift.startTime);
    const originalEnd = new Date(clipboardShift.endTime);
    const duration = originalEnd.getTime() - originalStart.getTime();
    
    const newStart = start;
    const newEnd = new Date(newStart.getTime() + duration);

    createShiftMutation.mutate({
      userId: clipboardShift.userId,
      startTime: newStart.toISOString(),
      endTime: newEnd.toISOString(),
      notes: clipboardShift.notes,
    });
  }, [clipboardShift, createShiftMutation]);

  // Copy Week Functions
  const handleCopyWeek = useCallback(() => {
    const weekEnd = endOfWeek(currentWeekStart, { weekStartsOn: 1 });
    const weekShifts = shifts.filter(shift => {
      const shiftDate = new Date(shift.startTime);
      return shiftDate >= currentWeekStart && shiftDate <= weekEnd;
    });
    
    setClipboardWeek(weekShifts);
    setClipboardWeekStart(currentWeekStart);
    setSnackbar({ 
      open: true, 
      message: `Copied ${weekShifts.length} shifts! Navigate to target week and click Paste Week.`, 
      severity: 'info' 
    });
  }, [shifts, currentWeekStart]);

  const handlePasteWeek = useCallback(async () => {
    if (!clipboardWeek || !clipboardWeekStart) {
      setSnackbar({ open: true, message: 'No week copied!', severity: 'error' });
      return;
    }

    const daysDiff = differenceInMilliseconds(currentWeekStart, clipboardWeekStart);
    
    setSnackbar({ open: true, message: `Pasting ${clipboardWeek.length} shifts...`, severity: 'info' });

    for (const shift of clipboardWeek) {
      const newStart = new Date(new Date(shift.startTime).getTime() + daysDiff);
      const newEnd = new Date(new Date(shift.endTime).getTime() + daysDiff);
      
      await createShiftMutation.mutateAsync({
        userId: shift.userId,
        startTime: newStart.toISOString(),
        endTime: newEnd.toISOString(),
        notes: shift.notes,
      });
    }

    setSnackbar({ open: true, message: 'Week pasted successfully!', severity: 'success' });
  }, [clipboardWeek, clipboardWeekStart, currentWeekStart, createShiftMutation]);

  // Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === 'c' && selectedShift) {
        e.preventDefault();
        handleCopyShift(selectedShift);
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedShift, handleCopyShift]);

  // Track calendar date changes
  const handleDatesSet = useCallback((info: any) => {
    setCurrentWeekStart(startOfWeek(info.start, { weekStartsOn: 1 }));
  }, []);

  if (shiftsLoading || employeesLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <CircularProgress size={48} />
      </Box>
    );
  }

  return (
    <Box sx={{ display: 'flex', height: '100vh', bgcolor: 'background.default' }}>
      {/* Employee Roster Drawer */}
      <Drawer
        anchor="left"
        open={rosterOpen}
        onClose={() => setRosterOpen(false)}
        variant="persistent"
        sx={{
          width: rosterOpen ? 280 : 0,
          flexShrink: 0,
          '& .MuiDrawer-paper': {
            width: 280,
            boxSizing: 'border-box',
            top: 64,
            height: 'calc(100% - 64px)',
          },
        }}
      >
        <Box sx={{ p: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
            <Typography variant="h6" fontWeight={700}>
              Employee Roster
            </Typography>
            <IconButton size="small" onClick={() => setRosterOpen(false)}>
              <CloseIcon />
            </IconButton>
          </Box>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Drag an employee onto the calendar to create a shift
          </Typography>
          <Divider sx={{ mb: 2 }} />
          
          <Box ref={rosterRef} sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            {employees.map((employee, index) => {
              const colors = EMPLOYEE_COLORS[index % EMPLOYEE_COLORS.length];
              return (
                <Box
                  key={employee.id}
                  className="draggable-employee"
                  data-employee={JSON.stringify(employee)}
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 2,
                    p: 1.5,
                    borderRadius: 2,
                    bgcolor: 'background.paper',
                    cursor: 'grab',
                    transition: 'all 0.2s',
                    '&:hover': {
                      bgcolor: 'action.hover',
                      transform: 'translateX(4px)',
                    },
                    '&:active': {
                      cursor: 'grabbing',
                    },
                  }}
                >
                  <Avatar
                    sx={{
                      width: 36,
                      height: 36,
                      bgcolor: colors.bg,
                      color: colors.text,
                      fontSize: '0.875rem',
                      fontWeight: 600,
                    }}
                  >
                    {employee.firstName[0]}{employee.lastName[0]}
                  </Avatar>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography variant="body2" fontWeight={600} noWrap>
                      {employee.firstName} {employee.lastName}
                    </Typography>
                    {employee.role && (
                      <Typography variant="caption" color="text.secondary">
                        {employee.role}
                      </Typography>
                    )}
                  </Box>
                  <Box
                    sx={{
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      bgcolor: colors.bg,
                    }}
                  />
                </Box>
              );
            })}
          </Box>
        </Box>
      </Drawer>

      {/* Main Calendar Area */}
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: 3,
          transition: 'margin 0.2s',
          marginLeft: rosterOpen ? '280px' : 0,
        }}
      >
        {/* Toolbar */}
        <Paper sx={{ p: 2, mb: 2, display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
          <Typography variant="h5" fontWeight={700} sx={{ flexGrow: 1 }}>
            Schedule
          </Typography>
          
          {/* Roster Toggle */}
          <Tooltip title="Toggle Employee Roster">
            <Button
              variant={rosterOpen ? 'contained' : 'outlined'}
              startIcon={<PeopleIcon />}
              onClick={() => setRosterOpen(!rosterOpen)}
              size="small"
            >
              Roster
            </Button>
          </Tooltip>

          <Divider orientation="vertical" flexItem />

          {/* Copy/Paste Shift */}
          <Tooltip title={clipboardShift ? 'Shift in clipboard - select a time to paste' : 'Select a shift first'}>
            <span>
              <Button
                variant="outlined"
                startIcon={<CopyIcon />}
                size="small"
                disabled={!selectedShift}
                onClick={() => selectedShift && handleCopyShift(selectedShift)}
              >
                Copy Shift
              </Button>
            </span>
          </Tooltip>

          {clipboardShift && (
            <Chip
              label={`📋 ${getEmployeeName(clipboardShift.userId)}`}
              size="small"
              onDelete={() => setClipboardShift(null)}
              color="primary"
              variant="outlined"
            />
          )}

          <Divider orientation="vertical" flexItem />

          {/* Copy/Paste Week */}
          <Tooltip title="Copy all shifts from this week">
            <Button
              variant="outlined"
              startIcon={<CopyWeekIcon />}
              size="small"
              onClick={handleCopyWeek}
            >
              Copy Week
            </Button>
          </Tooltip>

          {clipboardWeek && (
            <>
              <Chip
                label={`📅 ${clipboardWeek.length} shifts`}
                size="small"
                onDelete={() => {
                  setClipboardWeek(null);
                  setClipboardWeekStart(null);
                }}
                color="secondary"
                variant="outlined"
              />
              <Tooltip title="Paste copied shifts to this week">
                <Button
                  variant="contained"
                  startIcon={<PasteIcon />}
                  size="small"
                  onClick={handlePasteWeek}
                  disabled={createShiftMutation.isPending}
                >
                  Paste Week
                </Button>
              </Tooltip>
            </>
          )}
        </Paper>

        {/* Calendar */}
        <Paper sx={{ p: 2, height: 'calc(100vh - 180px)', borderRadius: 2 }}>
          <FullCalendar
            ref={calendarRef}
            plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
            initialView="timeGridWeek"
            headerToolbar={{
              left: 'prev,next today',
              center: 'title',
              right: 'dayGridMonth,timeGridWeek,timeGridDay',
            }}
            slotMinTime="06:00:00"
            slotMaxTime="22:00:00"
            allDaySlot={false}
            height="100%"
            editable={true}
            droppable={true}
            selectable={true}
            selectMirror={true}
            events={calendarEvents}
            eventDrop={handleEventDrop}
            eventResize={handleEventResize}
            eventClick={handleEventClick}
            select={handleDateSelect}
            drop={handleExternalDrop}
            datesSet={handleDatesSet}
            eventTimeFormat={{
              hour: 'numeric',
              minute: '2-digit',
              meridiem: 'short',
            }}
            slotLabelFormat={{
              hour: 'numeric',
              minute: '2-digit',
              meridiem: 'short',
            }}
            nowIndicator={true}
            eventDisplay="block"
            dayMaxEvents={true}
          />
        </Paper>
      </Box>

      {/* Create Shift Modal */}
      <Dialog open={createModalOpen} onClose={() => setCreateModalOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Create Shift</DialogTitle>
        <DialogContent>
          <Stack spacing={3} sx={{ mt: 1 }}>
            <FormControl fullWidth>
              <InputLabel>Employee</InputLabel>
              <Select
                value={newShiftData.employeeId}
                label="Employee"
                onChange={(e) => setNewShiftData(prev => ({ ...prev, employeeId: e.target.value }))}
              >
                {employees.map((emp) => (
                  <MenuItem key={emp.id} value={emp.id}>
                    {emp.firstName} {emp.lastName} {emp.role && `• ${emp.role}`}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <TextField
              label="Start Time"
              type="datetime-local"
              value={newShiftData.startTime ? format(new Date(newShiftData.startTime), "yyyy-MM-dd'T'HH:mm") : ''}
              onChange={(e) => setNewShiftData(prev => ({ ...prev, startTime: new Date(e.target.value).toISOString() }))}
              slotProps={{ inputLabel: { shrink: true } }}
              fullWidth
            />
            <TextField
              label="End Time"
              type="datetime-local"
              value={newShiftData.endTime ? format(new Date(newShiftData.endTime), "yyyy-MM-dd'T'HH:mm") : ''}
              onChange={(e) => setNewShiftData(prev => ({ ...prev, endTime: new Date(e.target.value).toISOString() }))}
              slotProps={{ inputLabel: { shrink: true } }}
              fullWidth
            />
            <TextField
              label="Notes"
              multiline
              rows={2}
              value={newShiftData.notes}
              onChange={(e) => setNewShiftData(prev => ({ ...prev, notes: e.target.value }))}
              fullWidth
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => { setCreateModalOpen(false); resetNewShiftData(); }}>Cancel</Button>
          <Button
            variant="contained"
            onClick={() => createShiftMutation.mutate({
              userId: newShiftData.employeeId,
              startTime: newShiftData.startTime,
              endTime: newShiftData.endTime,
              notes: newShiftData.notes,
            })}
            disabled={!newShiftData.employeeId || !newShiftData.startTime || !newShiftData.endTime || createShiftMutation.isPending}
          >
            {createShiftMutation.isPending ? 'Creating...' : 'Create Shift'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Edit Shift Modal */}
      <Dialog open={editModalOpen} onClose={() => setEditModalOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Edit Shift</DialogTitle>
        <DialogContent>
          {selectedShift && (
            <Stack spacing={3} sx={{ mt: 1 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, p: 2, bgcolor: 'action.hover', borderRadius: 2 }}>
                <Avatar sx={{ bgcolor: getEmployeeColor(selectedShift.userId, employees).bg }}>
                  {selectedShift.user?.firstName?.[0] || '?'}
                </Avatar>
                <Box>
                  <Typography fontWeight={600}>
                    {selectedShift.user ? `${selectedShift.user.firstName} ${selectedShift.user.lastName}` : getEmployeeName(selectedShift.userId)}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {selectedShift.user?.role || getEmployeeRole(selectedShift.userId)}
                  </Typography>
                </Box>
              </Box>
              <TextField
                label="Start Time"
                type="datetime-local"
                defaultValue={format(new Date(selectedShift.startTime), "yyyy-MM-dd'T'HH:mm")}
                slotProps={{ inputLabel: { shrink: true } }}
                fullWidth
                onChange={(e) => {
                  if (selectedShift) {
                    selectedShift.startTime = new Date(e.target.value).toISOString();
                  }
                }}
              />
              <TextField
                label="End Time"
                type="datetime-local"
                defaultValue={format(new Date(selectedShift.endTime), "yyyy-MM-dd'T'HH:mm")}
                slotProps={{ inputLabel: { shrink: true } }}
                fullWidth
                onChange={(e) => {
                  if (selectedShift) {
                    selectedShift.endTime = new Date(e.target.value).toISOString();
                  }
                }}
              />
              <TextField
                label="Notes"
                multiline
                rows={2}
                defaultValue={selectedShift.notes || ''}
                fullWidth
                onChange={(e) => {
                  if (selectedShift) {
                    selectedShift.notes = e.target.value;
                  }
                }}
              />
              <Stack direction="row" spacing={2}>
                <Button
                  variant="outlined"
                  color="primary"
                  startIcon={<CopyIcon />}
                  onClick={() => {
                    handleCopyShift(selectedShift);
                    setEditModalOpen(false);
                  }}
                  fullWidth
                >
                  Copy Shift
                </Button>
                <Button
                  variant="outlined"
                  color="error"
                  startIcon={<DeleteIcon />}
                  onClick={() => {
                    setEditModalOpen(false);
                    setDeleteConfirmOpen(true);
                  }}
                  fullWidth
                >
                  Delete
                </Button>
              </Stack>
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditModalOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={() => {
              if (selectedShift) {
                updateShiftMutation.mutate({
                  id: selectedShift.id,
                  startTime: selectedShift.startTime,
                  endTime: selectedShift.endTime,
                  notes: selectedShift.notes,
                });
              }
            }}
            disabled={updateShiftMutation.isPending}
          >
            {updateShiftMutation.isPending ? 'Saving...' : 'Save Changes'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog open={deleteConfirmOpen} onClose={() => setDeleteConfirmOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Delete Shift?</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete this shift? This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteConfirmOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            color="error"
            onClick={() => selectedShift && deleteShiftMutation.mutate(selectedShift.id)}
            disabled={deleteShiftMutation.isPending}
          >
            {deleteShiftMutation.isPending ? 'Deleting...' : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar(prev => ({ ...prev, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          onClose={() => setSnackbar(prev => ({ ...prev, open: false }))}
          severity={snackbar.severity}
          variant="filled"
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default EnhancedScheduler;
