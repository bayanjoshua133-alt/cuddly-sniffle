import React, { useState, useEffect } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import { Box, Paper, Typography, CircularProgress, Snackbar, Alert } from '@mui/material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import dayjs from 'dayjs';

// --- Types ---
interface Shift {
  id: string;
  userId: string;
  startTime: string;
  endTime: string;
  title?: string;
}

// --- Scheduler Component ---
const Scheduler = () => {
  const queryClient = useQueryClient();
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' as 'success' | 'error' });

  // 1. Fetch Events from Backend
  const { data: shifts = [], isLoading } = useQuery<Shift[]>({
    queryKey: ['shifts'],
    queryFn: async () => {
      const res = await apiRequest('GET', '/api/shifts');
      const data = await res.json();
      const list = data.shifts || data;
      return Array.isArray(list) ? list : [];
    }
  });

  // 2. Mutations for Drag & Drop / Resize
  const updateShiftMutation = useMutation({
    mutationFn: async (payload: { id: string; startTime: string; endTime: string }) => {
      await apiRequest('PUT', `/api/shifts/${payload.id}`, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shifts'] });
      setSnackbar({ open: true, message: 'Shift updated', severity: 'success' });
    },
    onError: () => {
      setSnackbar({ open: true, message: 'Failed to update shift', severity: 'error' });
    }
  });

  // Map DB events to FullCalendar format
  const events = shifts.map(shift => ({
    id: shift.id,
    title: shift.title || 'Shift',
    start: shift.startTime,
    end: shift.endTime,
    backgroundColor: '#3788d8',
    borderColor: '#3788d8',
    textColor: '#ffffff'
  }));

  // Handlers
  const handleEventDrop = (info: any) => {
    const { event } = info;
    updateShiftMutation.mutate({
      id: event.id,
      startTime: event.startStr,
      endTime: event.endStr
    });
  };

  const handleEventResize = (info: any) => {
    const { event } = info;
    updateShiftMutation.mutate({
      id: event.id,
      startTime: event.startStr,
      endTime: event.endStr
    });
  };

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 5 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ height: 'calc(100vh - 100px)', p: 2 }}>
      <Paper elevation={3} sx={{ p: 2, height: '100%', borderRadius: 2 }}>
        <Typography variant="h5" sx={{ mb: 2, fontWeight: 'bold' }}>
          Schedule
        </Typography>
        
        <Box sx={{ flexGrow: 1, height: '90%' }}>
          <FullCalendar
            plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
            initialView="timeGridWeek"
            headerToolbar={{
              left: 'prev,next today',
              center: 'title',
              right: 'dayGridMonth,timeGridWeek,timeGridDay'
            }}
            editable={true}
            droppable={true}
            selectable={true}
            events={events}
            eventDrop={handleEventDrop}
            eventResize={handleEventResize}
            slotMinTime="06:00:00"
            slotMaxTime="22:00:00"
            allDaySlot={false}
            height="100%"
          />
        </Box>
      </Paper>

      <Snackbar 
        open={snackbar.open} 
        autoHideDuration={3000} 
        onClose={() => setSnackbar({ ...snackbar, open: false })}
      >
        <Alert severity={snackbar.severity}>{snackbar.message}</Alert>
      </Snackbar>
    </Box>
  );
};

export default Scheduler;
