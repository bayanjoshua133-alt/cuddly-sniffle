import React, { useState, useEffect, useRef } from "react";
import { 
  Box, 
  Typography, 
  Avatar, 
  CircularProgress, 
  Dialog, 
  DialogTitle, 
  DialogContent, 
  DialogActions, 
  Button, 
  TextField, 
  Autocomplete, 
  Stack, 
  Snackbar, 
  Alert 
} from "@mui/material";
import { 
  Scheduler, 
  SchedulerData, 
  ViewType, 
  DATE_FORMAT 
} from "react-big-schedule";
import { DndProvider } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";
import dayjs from "dayjs";
// CSS import usually handled at app level or here
import "react-big-schedule/dist/css/style.css"; 

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

// --- Types ---
interface Shift {
  id: string;
  userId: string;
  startTime: string;
  endTime: string;
  status: string;
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

// --- Styles ---
// We use a container class to scope overrides if global CSS isn't enough
const schedulerContainerStyle = {
  height: "calc(100vh - 100px)",
  padding: "16px",
  "& .scheduler-bg": { fontFamily: "inherit" },
  // Hide specific libraries details
};

const SchedulerComponent = () => {
  const queryClient = useQueryClient();
  const [viewModel, setViewModel] = useState<SchedulerData | null>(null);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showSnackbar, setShowSnackbar] = useState(false);
  const [snackbarMsg, setSnackbarMsg] = useState("");
  
  // Dialog State
  const [editingEvent, setEditingEvent] = useState<any>(null);
  const [formData, setFormData] = useState({
    resourceId: "",
    startTime: "",
    endTime: ""
  });

  // 1. Fetch Employees
  const { data: employees = [], isLoading: loadingEmployees } = useQuery<Employee[]>({
    queryKey: ["employees"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/employees");
      const data = await res.json();
      return Array.isArray(data) ? data : [];
    },
  });

  // 2. Fetch Shifts
  const { data: shifts = [], isLoading: loadingShifts } = useQuery<Shift[]>({
    queryKey: ["shifts"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/shifts"); 
      const data = await res.json();
      const shiftList = (data.shifts || data);
      return Array.isArray(shiftList) ? shiftList : [];
    },
  });

  // 3. Initialize SchedulerData
  // We use a ref to prevent recreation loop or flickering if easier, but state is standard.
  // CRITICAL FIX: Ensure DATE_FORMAT matches the string we pass.
  useEffect(() => {
    // Wait for data? Or show empty scheduler. Let's wait for basic readiness.
    if (loadingEmployees || loadingShifts) return;

    // Current date string
    const todayStr = dayjs().format(DATE_FORMAT);

    // Create Instance
    // ViewType.Week is standard.
    const schedulerData = new SchedulerData(
      todayStr,
      ViewType.Week,
      false, 
      false, 
      {
        schedulerWidth: '100%',
        responsiveByParent: true,
        defaultEventBgColor: "#2196f3",
        minuteStep: 30, 
        checkConflict: true,
        creatable: true,
        crossResourceMove: true,
        
        // UI Configs matching user request
        resourceName: "Resource Name",
        taskName: "Task Name",
        agendaViewHeader: "Agenda",
        addMorePopoverHeaderFormat: "MMM D, YYYY dddd",
        eventItemPopoverDateFormat: "MMM D",
        nonAgendaDayCellHeaderFormat: "HA", // Date format for headers
        nonAgendaOtherCellHeaderFormat: "ddd M/D", // Date format for Week view headers

        views: [
          { viewName: 'Week', viewType: ViewType.Week, showAgenda: false, isEventPerspective: false },
          { viewName: 'Day', viewType: ViewType.Day, showAgenda: false, isEventPerspective: false },
        ],
      }
    );

    // Set Locale 
    // schedulerData.setSchedulerLocale('en'); // Defaults to en-US

    // Mapped Resources
    let resources = employees.map(emp => ({
      id: emp.id,
      name: `${emp.firstName} ${emp.lastName}`,
      role: emp.role || emp.position,
      avatar: "", // We handle this in custom helper
      groupOnly: false
    }));
    
    // Safety fallback
    if (resources.length === 0) resources = [];
    schedulerData.setResources(resources);

    // Mapped Events
    const events = shifts.map(shift => {
      const start = dayjs(shift.startTime);
      const isMorning = start.hour() < 12;
      return {
        id: shift.id,
        start: dayjs(shift.startTime).format("YYYY-MM-DD HH:mm:ss"),
        end: dayjs(shift.endTime).format("YYYY-MM-DD HH:mm:ss"),
        resourceId: shift.userId,
        title: "", // We use custom render
        bgColor: isMorning ? "#60e81a" : "#f1e920", // Custom logic for visuals
        // Extra data/props
        showTitle: `${dayjs(shift.startTime).format("HH:mm")} - ${dayjs(shift.endTime).format("HH:mm")}`
      };
    });
    schedulerData.setEvents(events);

    setViewModel(schedulerData);
  }, [employees.length, shifts.length, loadingEmployees, loadingShifts]); 
  // We use .length to trigger re-init only if count changes, typical pattern to avoid depth issues.
  // In a real app with updates, we might use a hash or just accept re-renders.

  // --- Mutations ---
  const createShiftMutation = useMutation({
    mutationFn: async (payload: any) => {
      const res = await apiRequest("POST", "/api/shifts", { ...payload, status: "scheduled" });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["shifts"] })
  });

  const updateShiftMutation = useMutation({
    mutationFn: async (payload: any) => {
      const res = await apiRequest("PUT", `/api/shifts/${payload.id}`, payload);
      if (!res.ok) throw new Error("Failed");
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["shifts"] })
  });

  const deleteShiftMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("DELETE", `/api/shifts/${id}`);
      if (!res.ok) throw new Error("Failed");
    },
    onSuccess: () => {
      setShowEditDialog(false);
      queryClient.invalidateQueries({ queryKey: ["shifts"] });
    }
  });

  // --- Callbacks ---
  const prevClick = (schedulerData: SchedulerData) => {
    schedulerData.prev();
    schedulerData.setEvents(schedulerData.events);
    setViewModel(new SchedulerData(schedulerData));
  };

  const nextClick = (schedulerData: SchedulerData) => {
    schedulerData.next();
    schedulerData.setEvents(schedulerData.events);
    setViewModel(new SchedulerData(schedulerData));
  };

  const onViewChange = (schedulerData: SchedulerData, view: any) => {
    schedulerData.setViewType(view.viewType, view.showAgenda, view.isEventPerspective);
    schedulerData.setEvents(schedulerData.events);
    setViewModel(new SchedulerData(schedulerData));
  };

  const onSelectDate = (schedulerData: SchedulerData, date: string) => {
    schedulerData.setDate(date);
    schedulerData.setEvents(schedulerData.events);
    setViewModel(new SchedulerData(schedulerData));
  };

  const eventClicked = (schedulerData: SchedulerData, event: any) => {
    setEditingEvent(event);
    setFormData({
      resourceId: event.resourceId,
      startTime: dayjs(event.start).format("YYYY-MM-DDTHH:mm"),
      endTime: dayjs(event.end).format("YYYY-MM-DDTHH:mm"),
    });
    setShowEditDialog(true);
  };

  const newEvent = (schedulerData: SchedulerData, slotId: string, slotName: string, start: string, end: string) => {
    setEditingEvent(null);
    setFormData({
      resourceId: slotId,
      startTime: dayjs(start).format("YYYY-MM-DDTHH:mm"),
      endTime: dayjs(end).format("YYYY-MM-DDTHH:mm"),
    });
    setShowEditDialog(true);
  };

  const moveEvent = async (schedulerData: SchedulerData, event: any, slotId: string, slotName: string, start: string, end: string) => {
    // Update local state first for snapiness
    schedulerData.moveEvent(event, slotId, slotName, start, end);
    setViewModel(new SchedulerData(schedulerData));

    try {
      await updateShiftMutation.mutateAsync({
        id: event.id,
        userId: slotId,
        startTime: dayjs(start).toISOString(),
        endTime: dayjs(end).toISOString()
      });
    } catch (e) {
      setSnackbarMsg("Failed to move shift");
      setShowSnackbar(true);
    }
  };

  const updateEventStart = async (schedulerData: SchedulerData, event: any, newStart: string) => {
    schedulerData.updateEventStart(event, newStart);
    setViewModel(new SchedulerData(schedulerData));
    await updateShiftMutation.mutateAsync({
      id: event.id,
      startTime: dayjs(newStart).toISOString(),
      endTime: dayjs(event.end).toISOString()
    });
  };

  const updateEventEnd = async (schedulerData: SchedulerData, event: any, newEnd: string) => {
    schedulerData.updateEventEnd(event, newEnd);
    setViewModel(new SchedulerData(schedulerData));
    await updateShiftMutation.mutateAsync({
      id: event.id,
      startTime: dayjs(event.start).toISOString(),
      endTime: dayjs(newEnd).toISOString()
    });
  };

  const conflictOccurred = () => {
    setSnackbarMsg("Conflict detected! Cannot place overlapping shifts.");
    setShowSnackbar(true);
  };

  // --- UI Resolvers ---
  
  // Custom Employee Row
  const slotItemTemplateResolver = (schedulerData: any, slot: any, slotClickedFunc: any, width: any, clsName: any) => {
    const emp = employees.find(e => e.id === slot.slotId);
    return (
      <div className={clsName} style={{ width, height: '100%', borderRight: '1px solid #e0e0e0' }} title={slot.slotName}>
         <Box sx={{ display: 'flex', alignItems: 'center', p: 1, gap: 1.5, height: '100%' }}>
           <Avatar sx={{ bgcolor: (emp?.role||'').includes('manager') ? '#e25dd2' : '#60e81a', width: 36, height: 36 }}>
             {slot.slotName.charAt(0)}
           </Avatar>
           <Box>
             <Typography variant="subtitle2" noWrap sx={{ fontWeight: 'bold', fontSize: '0.85rem' }}>{slot.slotName}</Typography>
             <Typography variant="caption" display="block" color="text.secondary" noWrap sx={{ fontSize: '0.7rem' }}>
               {emp?.role || "Staff"}
             </Typography>
           </Box>
         </Box>
      </div>
    );
  };

  // Custom Event Block
  const eventItemTemplateResolver = (schedulerData: any, event: any, bgColor: any, isStart: any, isEnd: any, mustAddCssClass: any, mustBeHeight: any) => {
    return (
        <div key={event.id} style={{
            background: event.bgColor,
            height: '100%',
            width: '100%',
            borderRadius: 4,
            padding: '4px 6px',
            color: '#1a1a1a', 
            border: '1px solid rgba(0,0,0,0.1)',
            overflow: 'hidden',
            fontSize: '11px',
            fontWeight: 700,
            boxSizing: 'border-box',
            display: 'flex',
            alignItems: 'center',
            boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
        }}>
            {/* Show time range + custom title logic if needed */}
             {event.showTitle} 
             {/* If we wanted title: {event.title} */}
        </div>
    );
  };

  // Custom Header Cell (Standard date rendering + visual hints)
  // This library makes it hard to split columns into "Morning/Afternoon" explicitly without a custom ViewType.
  // We will decorate the header to look professional.
  const nonAgendaCellHeaderTemplateResolver = (schedulerData: any, item: any, formattedDateItems: any, style: any) => {
      const date = dayjs(item.time);
      const isToday = date.isSame(dayjs(), 'day');
      
      return (
          <div style={{
              ...style, 
              background: isToday ? 'transparent' : 'transparent', 
              color: isToday ? '#1a1a1a' : '#555',
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center'
          }}>
              {/* Day Name */}
              <Typography variant="caption" sx={{ fontWeight: 'bold', fontSize: '0.75rem', textTransform: 'uppercase' }}>
                  {formattedDateItems[0]}
              </Typography>
              {/* Date */}
              <Typography variant="caption" >
                  {formattedDateItems[1]} 
              </Typography>
          </div>
      );
  };

  const handleDialogSave = async () => {
    const payload = {
      userId: formData.resourceId,
      startTime: dayjs(formData.startTime).toISOString(),
      endTime: dayjs(formData.endTime).toISOString()
    };

    if (editingEvent) {
      await updateShiftMutation.mutateAsync({ id: editingEvent.id, ...payload });
    } else {
      await createShiftMutation.mutateAsync(payload);
    }
    setShowEditDialog(false);
  };


  // --- Render ---

  if (loadingEmployees || loadingShifts) {
    return <Box sx={{ display: 'flex', justifyContent: 'center', p: 8 }}><CircularProgress /></Box>;
  }

  // Not ready?
  if (!viewModel) {
     return <Box sx={{ display: 'flex', justifyContent: 'center', p: 8 }}><CircularProgress /></Box>;
  }

  return (
    <Box sx={schedulerContainerStyle}>
      <DndProvider backend={HTML5Backend}>
        <Scheduler
          schedulerData={viewModel}
          prevClick={prevClick}
          nextClick={nextClick}
          onSelectDate={onSelectDate}
          onViewChange={onViewChange}
          eventItemClick={eventClicked}
          viewEventClick={eventClicked}
          viewEventText="Edit"
          viewEvent2Text="Delete"
          viewEvent2Click={() => {}}
          updateEventStart={updateEventStart}
          updateEventEnd={updateEventEnd}
          moveEvent={moveEvent}
          newEvent={newEvent}
          conflictOccurred={conflictOccurred}
          slotItemTemplateResolver={slotItemTemplateResolver}
          eventItemTemplateResolver={eventItemTemplateResolver}
          nonAgendaCellHeaderTemplateResolver={nonAgendaCellHeaderTemplateResolver}
        />
      </DndProvider>

      {/* Editor Dialog */}
      <Dialog open={showEditDialog} onClose={() => setShowEditDialog(false)} fullWidth maxWidth="xs">
        <DialogTitle>{editingEvent ? "Edit Shift" : "New Shift"}</DialogTitle>
        <DialogContent>
           <Stack spacing={2} sx={{ mt: 1 }}>
              <Autocomplete
                 options={employees}
                 getOptionLabel={(e) => `${e.firstName} ${e.lastName}`}
                 value={employees.find(e => e.id === formData.resourceId) || null}
                 onChange={(_, val) => setFormData({...formData, resourceId: val?.id || ""})}
                 renderInput={(params) => <TextField {...params} label="Employee" />}
                 disableClearable
              />
              <TextField
                 label="Start Time"
                 type="datetime-local"
                 fullWidth
                 value={formData.startTime}
                 onChange={(e) => setFormData({...formData, startTime: e.target.value})}
                 InputLabelProps={{ shrink: true }}
              />
              <TextField
                 label="End Time"
                 type="datetime-local"
                 fullWidth
                 value={formData.endTime}
                 onChange={(e) => setFormData({...formData, endTime: e.target.value})}
                 InputLabelProps={{ shrink: true }}
              />
           </Stack>
        </DialogContent>
        <DialogActions>
           {editingEvent && (
              <Button onClick={() => deleteShiftMutation.mutate(editingEvent.id)} color="error">
                 Delete
              </Button>
           )}
           <Button onClick={() => setShowEditDialog(false)}>Cancel</Button>
           <Button onClick={handleDialogSave} variant="contained">Save</Button>
        </DialogActions>
      </Dialog>

      <Snackbar 
        open={showSnackbar} 
        autoHideDuration={4000} 
        onClose={() => setShowSnackbar(false)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert onClose={() => setShowSnackbar(false)} severity="warning" sx={{ width: '100%' }}>
          {snackbarMsg}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default SchedulerComponent;
