import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format, parseISO, isFuture } from "date-fns";
import { apiRequest } from "@/lib/queryClient";
import { getCurrentUser, isManager } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { getInitials } from "@/lib/utils";

// MUI Components
import {
  Box,
  Card,
  CardContent,
  CardHeader,
  Typography,
  Button,
  Avatar,
  AvatarGroup,
  Chip,
  Stack,
  Paper,
  Grid,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Tabs,
  Tab,
  Alert,
  CircularProgress,
  IconButton,
  Tooltip,
  useTheme,
  alpha,
} from "@mui/material";

// Icons
import {
  SwapHoriz as SwapIcon,
  RefreshRounded as RefreshIcon,
  AddRounded as AddIcon,
  CheckCircle as CheckIcon,
  Cancel as CancelIcon,
  AccessTime as TimeIcon,
  Person as PersonIcon,
  TrendingUp as UrgentIcon,
} from "@mui/icons-material";

interface Shift {
  id: string;
  userId: string;
  date: string;
  startTime: string;
  endTime: string;
  position: string;
  userName?: string;
}

interface ShiftTrade {
  id: string;
  shiftId: string;
  fromUserId: string;
  toUserId?: string;
  reason: string;
  status: "pending" | "accepted" | "approved" | "rejected";
  urgency: "low" | "normal" | "urgent";
  createdAt: string;
  fromUser?: { firstName: string; lastName: string };
  toUser?: { firstName: string; lastName: string };
  shift?: Shift;
}

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index } = props;
  return (
    <div role="tabpanel" hidden={value !== index}>
      {value === index && <Box sx={{ py: 3 }}>{children}</Box>}
    </div>
  );
}

export default function ShiftTradingPanel() {
  const theme = useTheme();
  const currentUser = getCurrentUser();
  const isManagerRole = isManager();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState(0);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedShift, setSelectedShift] = useState("");
  const [targetEmployee, setTargetEmployee] = useState("");
  const [reason, setReason] = useState("");
  const [urgency, setUrgency] = useState<"low" | "normal" | "urgent">("normal");

  // Real-time shifts query with polling
  const { data: shiftsData, isLoading: shiftsLoading, refetch: refetchShifts } = useQuery({
    queryKey: ["employee-shifts"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/shifts");
      return response.json();
    },
    refetchInterval: 3000, // Poll every 3 seconds for real-time updates
    refetchOnWindowFocus: true,
    refetchIntervalInBackground: true,
  });

  // Real-time shift trades query
  const { data: tradesData, isLoading: tradesLoading, refetch: refetchTrades } = useQuery({
    queryKey: ["shift-trades"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/shift-trades");
      return response.json();
    },
    refetchInterval: 3000,
    refetchOnWindowFocus: true,
    refetchIntervalInBackground: true,
  });

  // Fetch all employees for target selection
  const { data: employeesData } = useQuery({
    queryKey: ["employees"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/employees");
      return response.json();
    },
    refetchInterval: 30000,
  });

  // Create trade mutation
  const createTradeMutation = useMutation({
    mutationFn: async () => {
      if (!selectedShift || !targetEmployee || !reason.trim()) {
        throw new Error("Please fill all fields");
      }
      const response = await apiRequest("POST", "/api/shift-trades", {
        shiftId: selectedShift,
        targetUserId: targetEmployee,
        reason,
        urgency,
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["shift-trades"] });
      toast({ title: "Shift trade request sent successfully!" });
      setDialogOpen(false);
      resetForm();
      refetchTrades();
    },
    onError: (error: any) => {
      toast({
        title: "Error creating trade request",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Respond to trade mutation
  const respondToTradeMutation = useMutation({
    mutationFn: async ({ tradeId, accept }: { tradeId: string; accept: boolean }) => {
      const response = await apiRequest("PATCH", `/api/shift-trades/${tradeId}`, {
        status: accept ? "accepted" : "rejected",
      });
      return response.json();
    },
    onSuccess: (_, { accept }) => {
      queryClient.invalidateQueries({ queryKey: ["shift-trades"] });
      toast({
        title: accept ? "Trade accepted!" : "Trade rejected",
      });
      refetchTrades();
    },
    onError: (error: any) => {
      toast({
        title: "Error responding to trade",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Manager approval mutation
  const approveTradeAsManagerMutation = useMutation({
    mutationFn: async ({ tradeId, approve }: { tradeId: string; approve: boolean }) => {
      const response = await apiRequest("PATCH", `/api/shift-trades/${tradeId}/approve`, {
        status: approve ? "approved" : "rejected",
      });
      return response.json();
    },
    onSuccess: (_, { approve }) => {
      queryClient.invalidateQueries({ queryKey: ["shift-trades"] });
      toast({
        title: approve ? "Trade approved!" : "Trade rejected",
      });
      refetchTrades();
    },
    onError: (error: any) => {
      toast({
        title: "Error processing trade",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const resetForm = () => {
    setSelectedShift("");
    setTargetEmployee("");
    setReason("");
    setUrgency("normal");
  };

  const shifts = shiftsData?.shifts || [];
  const trades = tradesData?.trades || [];
  const employees = employeesData?.employees || [];

  // Filter trades by type
  const myOutgoingTrades = trades.filter((t) => t.fromUserId === currentUser?.id);
  const incomingTrades = trades.filter((t) => t.toUserId === currentUser?.id && t.status === "pending");
  const managerPendingTrades = isManagerRole ? trades.filter((t) => t.status === "accepted") : [];

  // Available shifts for creating trade (future shifts only)
  const availableShifts = shifts.filter((s) => isFuture(parseISO(s.startTime)) && s.userId === currentUser?.id);

  // Status badge helper
  const getStatusChip = (status: string) => {
    const configs: Record<string, any> = {
      pending: { label: "Pending", color: "warning" },
      accepted: { label: "Accepted", color: "info" },
      approved: { label: "Approved", color: "success" },
      rejected: { label: "Rejected", color: "error" },
    };
    const config = configs[status] || { label: status, color: "default" };
    return <Chip label={config.label} color={config.color as any} size="small" />;
  };

  // Urgency indicator
  const getUrgencyIndicator = (urgency: string) => {
    const colors: Record<string, string> = {
      low: theme.palette.info.main,
      normal: theme.palette.warning.main,
      urgent: theme.palette.error.main,
    };
    return (
      <Tooltip title={`Urgency: ${urgency}`}>
        <Box
          sx={{
            width: 12,
            height: 12,
            borderRadius: "50%",
            backgroundColor: colors[urgency] || colors.normal,
          }}
        />
      </Tooltip>
    );
  };

  // Trade card component
  const TradeCard = ({
    trade,
    showActions,
    actionType,
  }: {
    trade: ShiftTrade;
    showActions: boolean;
    actionType?: "respond" | "approve";
  }) => (
    <Card
      sx={{
        mb: 2,
        transition: "all 0.3s ease",
        "&:hover": {
          boxShadow: theme.shadows[8],
          transform: "translateY(-2px)",
        },
        border: `1px solid ${alpha(theme.palette.divider, 0.5)}`,
      }}
    >
      <CardContent>
        <Stack spacing={2}>
          {/* Header */}
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Stack direction="row" spacing={1} alignItems="center">
              {getUrgencyIndicator(trade.urgency)}
              <Typography variant="subtitle1" fontWeight={600}>
                Shift Trade Request
              </Typography>
            </Stack>
            {getStatusChip(trade.status)}
          </Stack>

          {/* People involved */}
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, sm: 5 }}>
              <Paper
                variant="outlined"
                sx={{
                  p: 2,
                  borderRadius: 2,
                  bgcolor: alpha(theme.palette.primary.main, 0.05),
                }}
              >
                <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1 }}>
                  From
                </Typography>
                <Stack direction="row" spacing={1} alignItems="center">
                  <Avatar sx={{ width: 32, height: 32, bgcolor: "primary.main", fontSize: "0.75rem" }}>
                    {getInitials(trade.fromUser?.firstName, trade.fromUser?.lastName)}
                  </Avatar>
                  <Box>
                    <Typography variant="body2" fontWeight={600}>
                      {trade.fromUser?.firstName} {trade.fromUser?.lastName}
                    </Typography>
                  </Box>
                </Stack>
              </Paper>
            </Grid>

            <Grid size={{ xs: 12, sm: 2 }} sx={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
              <SwapIcon color="action" />
            </Grid>

            <Grid size={{ xs: 12, sm: 5 }}>
              <Paper
                variant="outlined"
                sx={{
                  p: 2,
                  borderRadius: 2,
                  bgcolor: alpha(theme.palette.success.main, 0.05),
                }}
              >
                <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1 }}>
                  To
                </Typography>
                <Stack direction="row" spacing={1} alignItems="center">
                  <Avatar sx={{ width: 32, height: 32, bgcolor: "success.main", fontSize: "0.75rem" }}>
                    {trade.toUserId ? getInitials(trade.toUser?.firstName, trade.toUser?.lastName) : "?"}
                  </Avatar>
                  <Box>
                    <Typography variant="body2" fontWeight={600}>
                      {trade.toUser ? `${trade.toUser.firstName} ${trade.toUser.lastName}` : "Unassigned"}
                    </Typography>
                  </Box>
                </Stack>
              </Paper>
            </Grid>
          </Grid>

          {/* Shift details */}
          {trade.shift && (
            <Paper
              variant="outlined"
              sx={{
                p: 2,
                borderRadius: 2,
                bgcolor: alpha(theme.palette.secondary.main, 0.03),
              }}
            >
              <Stack spacing={1}>
                <Stack direction="row" spacing={1} alignItems="center">
                  <TimeIcon fontSize="small" color="action" />
                  <Typography variant="body2" fontWeight={500}>
                    {format(parseISO(trade.shift.startTime), "MMM d, yyyy")} •{" "}
                    {format(parseISO(trade.shift.startTime), "h:mm a")} -{" "}
                    {format(parseISO(trade.shift.endTime), "h:mm a")}
                  </Typography>
                </Stack>
                <Stack direction="row" spacing={1} alignItems="center">
                  <PersonIcon fontSize="small" color="action" />
                  <Typography variant="body2">{trade.shift.position}</Typography>
                </Stack>
              </Stack>
            </Paper>
          )}

          {/* Reason */}
          <Box>
            <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 0.5 }}>
              Reason
            </Typography>
            <Typography variant="body2">{trade.reason}</Typography>
          </Box>

          {/* Timestamp */}
          <Typography variant="caption" color="text.secondary">
            Requested {format(parseISO(trade.createdAt), "MMM d, yyyy 'at' h:mm a")}
          </Typography>

          {/* Action buttons */}
          {showActions && (
            <Stack direction="row" spacing={1} sx={{ pt: 1 }}>
              {actionType === "respond" && trade.status === "pending" && (
                <>
                  <Button
                    variant="contained"
                    color="success"
                    size="small"
                    startIcon={<CheckIcon />}
                    onClick={() =>
                      respondToTradeMutation.mutate({ tradeId: trade.id, accept: true })
                    }
                    disabled={respondToTradeMutation.isPending}
                  >
                    Accept
                  </Button>
                  <Button
                    variant="outlined"
                    color="error"
                    size="small"
                    startIcon={<CancelIcon />}
                    onClick={() =>
                      respondToTradeMutation.mutate({ tradeId: trade.id, accept: false })
                    }
                    disabled={respondToTradeMutation.isPending}
                  >
                    Reject
                  </Button>
                </>
              )}

              {actionType === "approve" && trade.status === "accepted" && isManagerRole && (
                <>
                  <Button
                    variant="contained"
                    color="success"
                    size="small"
                    startIcon={<CheckIcon />}
                    onClick={() =>
                      approveTradeAsManagerMutation.mutate({ tradeId: trade.id, approve: true })
                    }
                    disabled={approveTradeAsManagerMutation.isPending}
                  >
                    Approve
                  </Button>
                  <Button
                    variant="outlined"
                    color="error"
                    size="small"
                    startIcon={<CancelIcon />}
                    onClick={() =>
                      approveTradeAsManagerMutation.mutate({ tradeId: trade.id, approve: false })
                    }
                    disabled={approveTradeAsManagerMutation.isPending}
                  >
                    Reject
                  </Button>
                </>
              )}
            </Stack>
          )}
        </Stack>
      </CardContent>
    </Card>
  );

  return (
    <Box sx={{ p: { xs: 2, md: 3 } }}>
      {/* Header */}
      <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" alignItems="flex-start" sx={{ mb: 3 }}>
        <Box>
          <Typography variant="h5" fontWeight={700} sx={{ mb: 1 }}>
            <SwapIcon sx={{ mr: 1, verticalAlign: "middle" }} />
            Shift Trading
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Request or accept shift swaps with colleagues
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => setDialogOpen(true)}
          disabled={availableShifts.length === 0}
          sx={{ mt: { xs: 2, sm: 0 } }}
        >
          New Request
        </Button>
      </Stack>

      {/* Tabs */}
      <Box sx={{ borderBottom: 1, borderColor: "divider", mb: 2 }}>
        <Tabs value={activeTab} onChange={(_, value) => setActiveTab(value)}>
          <Tab label={`My Requests (${myOutgoingTrades.length})`} />
          <Tab label={`Incoming (${incomingTrades.length})`} />
          {isManagerRole && <Tab label={`Pending Approvals (${managerPendingTrades.length})`} />}
        </Tabs>
      </Box>

      {/* My Outgoing Requests */}
      <TabPanel value={activeTab} index={0}>
        {shiftsLoading || tradesLoading ? (
          <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
            <CircularProgress />
          </Box>
        ) : myOutgoingTrades.length === 0 ? (
          <Alert severity="info">No outgoing shift trade requests. Create one to get started!</Alert>
        ) : (
          myOutgoingTrades.map((trade) => <TradeCard key={trade.id} trade={trade} showActions={false} />)
        )}
      </TabPanel>

      {/* Incoming Requests */}
      <TabPanel value={activeTab} index={1}>
        {tradesLoading ? (
          <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
            <CircularProgress />
          </Box>
        ) : incomingTrades.length === 0 ? (
          <Alert severity="info">No incoming shift trade requests</Alert>
        ) : (
          incomingTrades.map((trade) => (
            <TradeCard key={trade.id} trade={trade} showActions actionType="respond" />
          ))
        )}
      </TabPanel>

      {/* Manager Approvals */}
      {isManagerRole && (
        <TabPanel value={activeTab} index={2}>
          {tradesLoading ? (
            <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
              <CircularProgress />
            </Box>
          ) : managerPendingTrades.length === 0 ? (
            <Alert severity="info">No pending approvals</Alert>
          ) : (
            managerPendingTrades.map((trade) => (
              <TradeCard key={trade.id} trade={trade} showActions actionType="approve" />
            ))
          )}
        </TabPanel>
      )}

      {/* Create Trade Dialog */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Create Shift Trade Request</DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          <Stack spacing={3}>
            <FormControl fullWidth>
              <InputLabel>Your Shift</InputLabel>
              <Select
                value={selectedShift}
                label="Your Shift"
                onChange={(e) => setSelectedShift(e.target.value)}
              >
                {availableShifts.map((shift) => (
                  <MenuItem key={shift.id} value={shift.id}>
                    {format(parseISO(shift.startTime), "MMM d")} •{" "}
                    {format(parseISO(shift.startTime), "h:mm a")} - {format(parseISO(shift.endTime), "h:mm a")} •{" "}
                    {shift.position}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl fullWidth>
              <InputLabel>Target Employee</InputLabel>
              <Select
                value={targetEmployee}
                label="Target Employee"
                onChange={(e) => setTargetEmployee(e.target.value)}
              >
                {employees.map((emp: any) => (
                  <MenuItem key={emp.id} value={emp.id}>
                    {emp.firstName} {emp.lastName}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl fullWidth>
              <InputLabel>Urgency</InputLabel>
              <Select
                value={urgency}
                label="Urgency"
                onChange={(e) => setUrgency(e.target.value as "low" | "normal" | "urgent")}
              >
                <MenuItem value="low">Low</MenuItem>
                <MenuItem value="normal">Normal</MenuItem>
                <MenuItem value="urgent">Urgent</MenuItem>
              </Select>
            </FormControl>

            <TextField
              label="Reason"
              multiline
              rows={4}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Why are you requesting this shift trade?"
              fullWidth
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={() => createTradeMutation.mutate()}
            disabled={createTradeMutation.isPending || !selectedShift || !targetEmployee || !reason.trim()}
          >
            {createTradeMutation.isPending ? "Creating..." : "Create Request"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
