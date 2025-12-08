# Developer Implementation Guide - Shift Management System

## Quick Start

### 1. Backend API Testing

Test the DELETE endpoint:
```bash
curl -X DELETE http://localhost:5000/api/shifts/{shiftId} \
  -H "Content-Type: application/json" \
  -H "Cookie: cafe-session=..."
```

Response:
```json
{
  "message": "Shift deleted successfully",
  "shiftId": "shift_123"
}
```

### 2. Frontend Component Usage

#### WeekShiftPicker
```tsx
import { WeekShiftPicker } from "@/components/schedule/week-shift-picker";

<WeekShiftPicker
  open={isOpen}
  onClose={handleClose}
  employeeId="emp_123"
  employeeName="John Doe"
  initialWeekDate={new Date("2025-12-09")}
  branchId="branch_456"
/>
```

#### EmployeeShiftModal
```tsx
import { EmployeeShiftModal } from "@/components/employees/employee-shift-modal";

const [employee, setEmployee] = useState(null);

<EmployeeShiftModal
  open={modalOpen}
  onClose={() => setModalOpen(false)}
  employee={employee}
  branchId="branch_456"
/>
```

## Component Architecture

### WeekShiftPicker Component Flow

```
User Opens Modal
    ↓
Select Shift Preset (Morning/Afternoon/Night/Off)
    ↓
Click Days to Apply Preset
    ↓
Visual Preview with Chips
    ↓
Click "Save X Shifts"
    ↓
Validate (at least 1 shift)
    ↓
Batch API Call: POST /api/shifts (multiple)
    ↓
Success: Invalidate Queries & Close Modal
    ↓
Error: Display Alert & Stay Open
```

### State Management

```typescript
// WeekShiftPicker State
const [weekStartDate, setWeekStartDate] = useState(Date);
const [selectedPreset, setSelectedPreset] = useState("morning");
const [weekShifts, setWeekShifts] = useState<Record<string, Shift>>({
  "2025-12-09": { date: "2025-12-09", startTime: "06:00", endTime: "14:00" },
  // ...
});
const [error, setError] = useState<string | null>(null);
```

## API Integration Details

### Create Multiple Shifts (Batch)
```bash
POST /api/shifts
Content-Type: application/json

{
  "userId": "emp_123",
  "branchId": "branch_456",
  "position": "Staff",
  "startTime": "2025-12-09T06:00:00Z",
  "endTime": "2025-12-09T14:00:00Z",
  "status": "scheduled"
}
```

Note: Each shift sent as separate POST (for transaction safety).

### Delete Shift
```bash
DELETE /api/shifts/{shiftId}
Authorization: Bearer {token}
```

**Validation**:
- Authenticated: ✓ (requireAuth)
- Manager Role: ✓ (requireRole(["manager"]))
- Same Branch: ✓ (shift.branchId === req.user.branchId)

**Response on Success**:
```json
{
  "message": "Shift deleted successfully",
  "shiftId": "shift_123"
}
```

**Response on Error**:
```json
{
  "message": "Cannot delete shift from another branch"
}
```

## Data Flow Diagram

```
EmployeeShiftModal
    ├─ useQuery: Fetch shifts for week
    │  └─ Endpoint: GET /api/shifts?userId={id}&startDate=...&endDate=...
    │
    ├─ useMutation: Delete shift
    │  ├─ Endpoint: DELETE /api/shifts/{id}
    │  └─ onSuccess: Invalidate queries & refetch
    │
    └─ [Add Shifts Button]
       └─ Opens WeekShiftPicker Modal
           ├─ useQueryClient: Get data
           └─ useMutation: Create shifts (batch)
              ├─ Multiple: POST /api/shifts (looped)
              └─ onSuccess: Invalidate & close
```

## Error Handling Best Practices

### Client-Side
```typescript
const deleteShiftMutation = useMutation({
  mutationFn: async (shiftId: string) => {
    const response = await apiRequest("DELETE", `/api/shifts/${shiftId}`);
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || "Failed to delete shift");
    }
    return response.json();
  },
  onError: (error: Error) => {
    setError(error.message); // User-friendly message
  },
});
```

### Server-Side (Existing Pattern)
```typescript
app.delete("/api/shifts/:id", requireAuth, requireRole(["manager"]), async (req, res) => {
  try {
    const { id } = req.params;
    const shift = await storage.getShift(id);

    if (!shift) {
      return res.status(404).json({ message: "Shift not found" });
    }

    if (shift.branchId !== req.user!.branchId) {
      return res.status(403).json({ message: "Cannot delete shift from another branch" });
    }

    const result = await storage.deleteShift(id);
    if (!result) {
      return res.status(500).json({ message: "Failed to delete shift" });
    }

    res.json({ message: "Shift deleted successfully", shiftId: id });
  } catch (error) {
    console.error('Delete shift error:', error);
    res.status(500).json({ message: "Failed to delete shift" });
  }
});
```

## Date Handling

### Night Shift Edge Case
When end time is before start time (night shift 10 PM - 6 AM):
```typescript
let endDateTime = new Date(`${shift.date}T${shift.endTime}:00`);
if (endDateTime <= startDateTime) {
  endDateTime = addDays(endDateTime, 1); // Add 1 day
}
// Result: 2025-12-09 22:00 to 2025-12-10 06:00
```

### Week Date Calculation
```typescript
import { startOfWeek, endOfWeek, addDays } from "date-fns";

const weekStartDate = startOfWeek(new Date(), { weekStartsOn: 1 }); // Monday
const weekEndDate = endOfWeek(weekStartDate, { weekStartsOn: 1 }); // Sunday

const weekDates = Array.from({ length: 7 }, (_, i) => addDays(weekStartDate, i));
// Result: [Monday, Tuesday, ..., Sunday]
```

## Query Invalidation Strategy

After successful shifts operation:
```typescript
onSuccess: () => {
  // Invalidate multiple query keys to ensure fresh data
  queryClient.invalidateQueries({ queryKey: ["employee-shifts"] });
  queryClient.invalidateQueries({ queryKey: ["shifts"] });
  // Triggers refetch from server
}
```

## TypeScript Type Definitions

```typescript
interface Shift {
  id?: string; // Generated by server on creation
  userId: string;
  branchId: string;
  startTime: string; // ISO 8601 format
  endTime: string;   // ISO 8601 format
  position: string;
  status: "scheduled" | "in-progress" | "completed" | "cancelled";
  notes?: string;
}

interface WeekShiftPickerProps {
  open: boolean;
  onClose: () => void;
  employeeId: string;
  employeeName: string;
  initialWeekDate?: Date;
  branchId: string;
}

interface EmployeeShiftModalProps {
  open: boolean;
  onClose: () => void;
  employee: Employee | null;
  branchId: string;
}
```

## Performance Optimization

### Query Caching
```typescript
// Shift data cached for 5 minutes
const { data: shiftsData } = useQuery({
  queryKey: ["employee-shifts", employeeId, weekStart.toISOString()],
  queryFn: async () => { /* ... */ },
  staleTime: 5 * 60 * 1000, // 5 minutes
  cacheTime: 10 * 60 * 1000, // 10 minutes
});
```

### Mutation Invalidation
```typescript
// Only invalidate affected queries, not all
queryClient.invalidateQueries({
  queryKey: ["employee-shifts", employeeId], // Specific employee
  exact: false // Include all date variations
});
```

## Testing Checklist

### Unit Tests
- [ ] Week date calculation (Monday-Sunday)
- [ ] Night shift date handling (end after start)
- [ ] Shift preset application logic
- [ ] Error message formatting

### Integration Tests
- [ ] Create shift with valid data
- [ ] Create shift with invalid time range
- [ ] Delete shift with proper auth
- [ ] Delete shift without permission
- [ ] Navigate week and fetch new data
- [ ] Batch create multiple shifts

### E2E Tests
- [ ] Manager opens employee shift modal
- [ ] Manager adds shifts for Monday-Friday
- [ ] Manager deletes single shift
- [ ] Changes reflect in employee schedule view
- [ ] Refresh page shows persisted data
- [ ] Error alert displays on failed deletion

## Debugging Tips

### Check Network Requests
```javascript
// In browser console
// Monitor all fetch requests
const originalFetch = window.fetch;
window.fetch = function(...args) {
  console.log("API Call:", args[0]);
  return originalFetch.apply(this, args);
};
```

### Query Cache Inspection
```typescript
// In component or console
import { useQueryClient } from "@tanstack/react-query";

const queryClient = useQueryClient();
console.log(queryClient.getQueryCache().getAll());
```

### State Inspection
```typescript
// React DevTools or inline logging
useEffect(() => {
  console.log("weekShifts updated:", weekShifts);
}, [weekShifts]);
```

## Common Issues & Solutions

### Issue: "Shift not found" 404
**Cause**: Trying to delete shift that doesn't exist
**Solution**: Verify shift ID is correct, check if shift was already deleted

### Issue: "Cannot delete shift from another branch"
**Cause**: Manager trying to delete shift from different branch
**Solution**: Ensure user has access to the correct branch

### Issue: Week picker shows empty
**Cause**: Query failed to fetch shifts
**Solution**: Check network tab for API errors, verify user authentication

### Issue: Night shift saves with wrong date
**Cause**: Missing date overflow handling
**Solution**: This is handled in the component (line 114-117), verify time is after midnight

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2025-12 | Initial implementation with DELETE endpoint and modern UI |

## Contact & Support

For implementation questions, refer to:
- React Query docs: https://tanstack.com/query/docs
- Material-UI docs: https://mui.com/
- date-fns docs: https://date-fns.org/
- This codebase: Search for `WeekShiftPicker` or `EmployeeShiftModal`
