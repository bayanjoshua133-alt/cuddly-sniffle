import React, { useMemo, useCallback } from "react";
import { Scheduler } from "@aldabil/react-scheduler";
import type {
  ProcessedEvent,
  SchedulerRef,
  SchedulerProps,
} from "@aldabil/react-scheduler/types";
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
  FormControlLabel,
  Switch,
} from "@mui/material";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { format, parseISO } from "date-fns";
import { enUS } from "date-fns/locale";

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

// --- styled-components or internal styles ---
// We can use the props for visual customization directly.

export default function SchedulePage() {
  const queryClient = useQueryClient();
  const calendarRef = React.useRef<SchedulerRef>(null);

  // 1. Fetch Employees (Resources)
  const { data: employees = [], isLoading: loadingEmployees } = useQuery<Employee[]>({
    queryKey: ["employees"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/employees");
      const data = await res.json();
      return Array.isArray(data) ? data : [];
    },
  });

  // Map employees to Scheduler Resources
  const resources = useMemo(() => {
    return employees.map((emp) => ({
      admin_id: emp.id,
      title: `${emp.firstName} ${emp.lastName}`,
      subtitle: emp.role || emp.position || "Staff",
      avatar: "", // could use a URL if available, or we handle visuals in header
      color: (emp.role || emp.position)?.toLowerCase().includes("manager") ? "#e25dd2" : "#60e81a",
    }));
  }, [employees]);

  // 2. Data Fetching (getRemoteEvents)
  const fetchRemote = async (query: any): Promise<ProcessedEvent[]> => {
    // query includes { start, end, view }
    // API expects ISO strings
    const startStr = query.start.toISOString();
    const endStr = query.end.toISOString();
    
    // Adjust endpoint based on user role if needed, but here assuming general access
    const res = await apiRequest("GET", `/api/shifts?startDate=${startStr}&endDate=${endStr}`);
    const data = await res.json();
    const rawShifts: Shift[] = data.shifts || data; // handle {shifts:[]} or []

    // Map to ProcessedEvent
    return rawShifts.map((s) => {
      const start = new Date(s.startTime);
      const end = new Date(s.endTime);
      const isMorning = start.getHours() < 12;

      return {
        event_id: s.id,
        title: `${format(start, "h:mm a")} - ${format(end, "h:mm a")}`,
        start,
        end,
        assignee: s.userId, // Map to resource
        color: isMorning ? "#60e81a" : "#f1e920", // Morning vs Afternoon colors
        textColor: "#1a1a1a",
        editable: true,
        deletable: true,
        draggable: true,
      };
    });
  };

  // 3. Mutations

  // Create / Update
  const handleConfirm = async (event: ProcessedEvent, action: "create" | "edit"): Promise<ProcessedEvent> => {
    const payload = {
      userId: event.assignee, // Ensure our editor sets this
      startTime: event.start.toISOString(),
      endTime: event.end.toISOString(),
      status: "scheduled",
    };

    let res;
    if (action === "edit") {
      res = await apiRequest("PUT", `/api/shifts/${event.event_id}`, payload);
    } else {
      res = await apiRequest("POST", "/api/shifts", payload);
    }

    if (!res.ok) throw new Error("Failed to save shift");
    
    const saved: Shift = await res.json();
    const sStart = new Date(saved.startTime);
    const sEnd = new Date(saved.endTime);
    // Return processed event to update UI immediately (or rely on refetch)
    return {
      event_id: saved.id,
      title: `${format(sStart, "h:mm a")} - ${format(sEnd, "h:mm a")}`,
      start: sStart,
      end: sEnd,
      assignee: saved.userId,
      color: sStart.getHours() < 12 ? "#60e81a" : "#f1e920",
      textColor: "#1a1a1a",
    };
  };

  // Delete
  const handleDelete = async (deletedId: string): Promise<string> => {
    const res = await apiRequest("DELETE", `/api/shifts/${deletedId}`);
    if (!res.ok) throw new Error("Failed to delete");
    return deletedId;
  };

  // Drag & Drop
  const handleEventDrop = async (
    droppedOn: Date,
    updatedEvent: ProcessedEvent,
    originalEvent: ProcessedEvent
  ): Promise<ProcessedEvent | void> => {
    // Check if changed
    if (
      updatedEvent.start.getTime() === originalEvent.start.getTime() &&
      updatedEvent.end.getTime() === originalEvent.end.getTime() &&
      updatedEvent.assignee === originalEvent.assignee // Assignee change support
    ) {
      return updatedEvent;
    }

    // Call API
    const payload = {
      startTime: updatedEvent.start.toISOString(),
      endTime: updatedEvent.end.toISOString(),
      userId: updatedEvent.assignee, // Support re-assigning
    };

    const res = await apiRequest("PUT", `/api/shifts/${updatedEvent.event_id}`, payload);
    if (!res.ok) {
       // revert? The library might handle error defaults. 
       throw new Error("Failed to move");
    }
    
    // We can invalidate queries to be sure, but returning the event updates local state
    queryClient.invalidateQueries({ queryKey: ["shifts"] });
    return updatedEvent;
  };

  // 4. Custom Components

  // Resource Header (Avatar + Name)
  const resourceHeader = (resource: { resource: { title: string; subtitle: string; admin_id: string } }) => {
    return (
      <Stack direction="row" alignItems="center" spacing={2} sx={{ p: 1 }}>
        <Avatar sx={{ bgcolor: getAvatarColor(resource.resource.subtitle) }}>
          {resource.resource.title.charAt(0)}
        </Avatar>
        <Box>
          <Typography variant="body2" fontWeight="bold" noWrap>
            {resource.resource.title}
          </Typography>
          <Typography variant="caption" color="text.secondary" noWrap>
            {resource.resource.subtitle}
          </Typography>
        </Box>
      </Stack>
    );
  };

  // Helper for colors
  const getAvatarColor = (role: string) => {
    if (!role) return "#999";
    const r = role.toLowerCase();
    if (r.includes("manager")) return "#9c27b0";
    if (r.includes("cashier")) return "#60e81a";
    return "#2196f3";
  };

  // Custom Editor
  // The library passes { state, close, onConfirm } to the custom editor component.
  // We need to implement a fully functional Dialog.
  const CustomEditor = ({ scheduler }: { scheduler: any }) => {
    const event = scheduler.edited;
    
    // Form state
    const [userId, setUserId] = React.useState(event?.assignee || (scheduler.state.resource?.admin_id) || "");
    const [start, setStart] = React.useState(event?.start || scheduler.state.start.value);
    const [end, setEnd] = React.useState(event?.end || scheduler.state.end.value);
    const [error, setError] = React.useState("");

    const handleSave = async () => {
        try {
            scheduler.loading(true);
            const newEvent = {
                event_id: event?.event_id,
                title: "Shift", // Title is auto-generated in display, but we need structure
                start,
                end,
                assignee: userId
            };
            
            await scheduler.onConfirm(newEvent, event ? "edit" : "create");
            scheduler.close();
        } catch (e) {
            console.error(e);
            setError("Failed to save shift");
        } finally {
            scheduler.loading(false);
        }
    };

    // Calculate duration for convenience?
    // For simplicity, just use native datetime-local inputs or text
    
    return (
      <Box sx={{ p: 2, minWidth: 300 }}>
        <DialogTitle>{event ? "Edit Shift" : "Add Shift"}</DialogTitle>
        <DialogContent>
            <Stack spacing={2} sx={{ mt: 1 }}>
                <Autocomplete
                    options={resources}
                    getOptionLabel={(option) => option.title}
                    value={resources.find(r => r.admin_id === userId) || null}
                    onChange={(_, val) => setUserId(val?.admin_id || "")}
                    renderInput={(params) => <TextField {...params} label="Employee" />}
                    disableClearable
                />
                <TextField
                   label="Start Time"
                   type="datetime-local"
                   fullWidth
                   value={format(start, "yyyy-MM-dd'T'HH:mm")}
                   onChange={(e) => setStart(new Date(e.target.value))}
                   InputLabelProps={{ shrink: true }}
                />
                <TextField
                   label="End Time"
                   type="datetime-local"
                   fullWidth
                   value={format(end, "yyyy-MM-dd'T'HH:mm")}
                   onChange={(e) => setEnd(new Date(e.target.value))}
                   InputLabelProps={{ shrink: true }}
                />
                {error && <Typography color="error">{error}</Typography>}
            </Stack>
        </DialogContent>
        <DialogActions>
            <Button onClick={scheduler.close}>Cancel</Button>
            <Button variant="contained" onClick={handleSave}>Confirm</Button>
        </DialogActions>
      </Box>
    );
  };


  if (loadingEmployees) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" height="calc(100vh - 100px)">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ height: "calc(100vh - 100px)", p: 2 }}>
      <Scheduler
        ref={calendarRef}
        view="week"
        locale={enUS}
        
        // Resource Configuration
        resources={resources}
        resourceFields={{
          idField: "admin_id",
          textField: "title",
          subTextField: "subtitle",
          avatarField: "avatar",
          colorField: "color",
        }}
        resourceViewMode="default" // Rows
        
        // Data Callbacks
        getRemoteEvents={fetchRemote}
        onConfirm={handleConfirm}
        onDelete={handleDelete}
        onEventDrop={handleEventDrop as any} 
        
        // View Props
        week={{
          weekDays: [0, 1, 2, 3, 4, 5, 6],
          weekStartOn: 1,
          startHour: 6,
          endHour: 23,
          step: 60,
          navigation: true,
        }}
        day={{
          startHour: 6,
          endHour: 23,
          step: 60,
          navigation: true,
        }}
        
        // Customizations
        resourceHeaderComponent={resourceHeader}
        // eventRenderer can be used for custom blocks, default is okay but we can enhance
        customEditor={(scheduler) => <CustomEditor scheduler={scheduler} />}
        
        // Styling
        hourFormat="12"
      />
    </Box>
  );
}
