import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format, parseISO, isSameDay, startOfWeek, addDays } from "date-fns";
import { apiRequest } from "@/lib/queryClient";

// MUI Components
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  IconButton,
  Tooltip,
  Box,
  Alert,
  CircularProgress,
  Chip,
  Stack,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
} from "@mui/material";
import {
  Delete as DeleteIcon,
  Edit as EditIcon,
  Add as AddIcon,
  ChevronLeft as ChevronLeftIcon,
  ChevronRight as ChevronRightIcon,
} from "@mui/icons-material";

import { WeekShiftPicker } from "../schedule/week-shift-picker";

interface Employee {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  position: string;
  branchId: string;
}

interface Shift {
  id: string;
  userId: string;
  startTime: string;
  endTime: string;
  status: string;
  position: string;
}

interface EmployeeShiftModalProps {
  open: boolean;
  onClose: () => void;
  employee: Employee | null;
  branchId: string;
}

export function EmployeeShiftModal({
  open,
  onClose,
  employee,
  branchId,
}: EmployeeShiftModalProps) {
  const queryClient = useQueryClient();
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [weekPickerOpen, setWeekPickerOpen] = useState(false);
  const [editingShiftId, setEditingShiftId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!employee) return null;

  // Fetch shifts for the week
  const { data: shiftsData, isLoading } = useQuery({
    queryKey: ["employee-shifts", employee.id, weekStart.toISOString()],
    queryFn: async () => {
      const endDate = addDays(weekStart, 6);
      const response = await apiRequest("GET", `/api/shifts?userId=${employee.id}&startDate=${weekStart.toISOString()}&endDate=${endDate.toISOString()}`);
      return response.json();
    },
    enabled: open && !!employee,
  });

  const shifts: Shift[] = shiftsData?.shifts || [];

  // Delete shift mutation
  const deleteShiftMutation = useMutation({
    mutationFn: async (shiftId: string) => {
      const response = await apiRequest("DELETE", `/api/shifts/${shiftId}`);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to delete shift");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["employee-shifts"] });
      queryClient.invalidateQueries({ queryKey: ["shifts"] });
      setError(null);
    },
    onError: (error: Error) => {
      setError(error.message);
    },
  });

  const handleDeleteShift = (shiftId: string) => {
    if (window.confirm("Are you sure you want to delete this shift?")) {
      deleteShiftMutation.mutate(shiftId);
    }
  };

  const handleNavigateWeek = (direction: "prev" | "next") => {
    setWeekStart((prev) => {
      const newDate = new Date(prev);
      newDate.setDate(newDate.getDate() + (direction === "next" ? 7 : -7));
      return newDate;
    });
  };

  const weekEnd = addDays(weekStart, 6);
  const weekLabel = `${format(weekStart, "MMM d")} - ${format(weekEnd, "MMM d, yyyy")}`;

  return (
    <>
      <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
        <DialogTitle>
          Shift Management - {employee.firstName} {employee.lastName}
          <Box sx={{ fontSize: "0.875rem", color: "text.secondary", mt: 0.5 }}>
            {employee.position}
          </Box>
        </DialogTitle>

        <DialogContent>
          <Stack spacing={2}>
            {error && (
              <Alert severity="error" onClose={() => setError(null)}>
                {error}
              </Alert>
            )}

            {/* Week Navigation */}
            <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <IconButton size="small" onClick={() => handleNavigateWeek("prev")}>
                <ChevronLeftIcon />
              </IconButton>
              <Box sx={{ textAlign: "center", flex: 1 }}>
                <strong>{weekLabel}</strong>
              </Box>
              <IconButton size="small" onClick={() => handleNavigateWeek("next")}>
                <ChevronRightIcon />
              </IconButton>
            </Box>

            {/* Shifts Table */}
            {isLoading ? (
              <Box sx={{ display: "flex", justifyContent: "center", py: 3 }}>
                <CircularProgress />
              </Box>
            ) : shifts.length === 0 ? (
              <Alert severity="info">No shifts scheduled for this week</Alert>
            ) : (
              <TableContainer component={Paper}>
                <Table size="small">
                  <TableHead>
                    <TableRow sx={{ backgroundColor: "#f5f5f5" }}>
                      <TableCell>Date</TableCell>
                      <TableCell>Time</TableCell>
                      <TableCell>Duration</TableCell>
                      <TableCell>Status</TableCell>
                      <TableCell align="right">Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {shifts.map((shift) => {
                      const startTime = parseISO(shift.startTime);
                      const endTime = parseISO(shift.endTime);
                      const durationHours = (endTime.getTime() - startTime.getTime()) / (1000 * 60 * 60);

                      return (
                        <TableRow key={shift.id} hover>
                          <TableCell>{format(startTime, "MMM d, EEE")}</TableCell>
                          <TableCell>
                            {format(startTime, "h:mm a")} - {format(endTime, "h:mm a")}
                          </TableCell>
                          <TableCell>{durationHours.toFixed(1)} hrs</TableCell>
                          <TableCell>
                            <Chip
                              label={shift.status}
                              size="small"
                              variant="outlined"
                              color={
                                shift.status === "completed"
                                  ? "success"
                                  : shift.status === "scheduled"
                                  ? "primary"
                                  : "default"
                              }
                            />
                          </TableCell>
                          <TableCell align="right">
                            <Tooltip title="Delete shift">
                              <IconButton
                                size="small"
                                onClick={() => handleDeleteShift(shift.id)}
                                disabled={deleteShiftMutation.isPending}
                              >
                                <DeleteIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </Stack>
        </DialogContent>

        <DialogActions>
          <Button
            onClick={() => setWeekPickerOpen(true)}
            variant="contained"
            startIcon={<AddIcon />}
          >
            Add Shifts
          </Button>
          <Button onClick={onClose}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* Week Shift Picker Modal */}
      <WeekShiftPicker
        open={weekPickerOpen}
        onClose={() => setWeekPickerOpen(false)}
        employeeId={employee.id}
        employeeName={`${employee.firstName} ${employee.lastName}`}
        initialWeekDate={weekStart}
        branchId={branchId}
      />
    </>
  );
}
