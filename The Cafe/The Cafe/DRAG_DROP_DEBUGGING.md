# Drag-Drop Not Working - Root Cause Analysis & Fix

## 🔴 The Problem: "Total shifts: 0"

Your drag-drop logic is **working correctly in code**, but **no shifts are being loaded** from the API. The error shows:
```
Total shifts: 0 | Future shifts: 0
```

This means:
- ❌ Shifts API endpoint is returning empty array `[]` 
- ❌ Drag-drop handlers have no data to work with
- ✅ The HTML structure exists (you can see the shift cards)
- ✅ The TypeScript logic is sound

---

## 🔍 Root Causes to Check

### 1. **Check if Shifts Exist in Database**

Run these database queries:

```sql
-- Check if any shifts exist
SELECT COUNT(*) FROM shifts;

-- Check shifts for current date range
SELECT id, "userId", "startTime", "endTime", "branchId" 
FROM shifts 
WHERE "startTime" >= NOW() - INTERVAL '7 days'
ORDER BY "startTime" DESC
LIMIT 5;

-- Check if shifts have valid users
SELECT s.id, u."firstName", u."lastName", s."startTime", s."endTime"
FROM shifts s
LEFT JOIN users u ON s."userId" = u.id
WHERE s."startTime" >= NOW() - INTERVAL '7 days'
LIMIT 5;

-- Check if manager's branch has shifts
SELECT b.id, b.name, COUNT(s.id) as shift_count
FROM branches b
LEFT JOIN shifts s ON s."branchId" = b.id
GROUP BY b.id, b.name;
```

### 2. **Check if Manager's Branch ID is Set**

```sql
-- Check if logged-in manager has branchId
SELECT id, username, "firstName", "branchId", role
FROM users
WHERE role = 'manager' AND "branchId" IS NOT NULL;
```

**If branchId is NULL**, shifts won't load because the API filters by branch.

### 3. **Check API Endpoint Parameters**

The `/api/shifts/branch` endpoint requires:
```typescript
GET /api/shifts/branch?startDate=2025-12-09T00:00:00Z&endDate=2025-12-15T23:59:59Z
```

**Make sure:**
- ✅ startDate is ISO string (e.g., `2025-12-09T00:00:00.000Z`)
- ✅ endDate is ISO string (e.g., `2025-12-15T23:59:59.999Z`)
- ✅ Both parameters are URL-encoded

---

## 🛠️ Fix Steps

### **Step 1: Enable Console Logging**

Add logging to see what's happening:

```typescript
// In client/src/pages/mui-schedule.tsx - Line 180-220

const {
  data: shiftsData,
  isLoading,
  isError,
  refetch,
} = useQuery({
  queryKey: ["shifts", dateRange.start.toISOString(), dateRange.end.toISOString()],
  queryFn: async () => {
    const endpoint = isManagerRole
      ? `/api/shifts/branch?startDate=${dateRange.start.toISOString()}&endDate=${dateRange.end.toISOString()}`
      : `/api/shifts?startDate=${dateRange.start.toISOString()}&endDate=${dateRange.end.toISOString()}`;
    
    console.log('📡 Fetching shifts from:', endpoint); // ADD THIS
    
    const response = await apiRequest("GET", endpoint);
    const json = await response.json();
    
    console.log('✅ Shifts response:', json); // ADD THIS
    console.log('📊 Shift count:', json.shifts?.length || 0); // ADD THIS
    
    return json;
  },
  refetchInterval: 5000,
  refetchOnWindowFocus: true,
  refetchIntervalInBackground: true,
  retry: (failureCount, error: any) => {
    if (error?.status === 401) return false;
    return failureCount < 3;
  },
});
```

**What to look for in console:**
```
📡 Fetching shifts from: /api/shifts/branch?startDate=2025-12-09T00:00:00.000Z&endDate=2025-12-15T23:59:59.999Z
✅ Shifts response: { shifts: [] }
📊 Shift count: 0
```

### **Step 2: Check Network Tab**

Open **DevTools → Network Tab**:
1. Filter by "XHR" requests
2. Find the `/api/shifts/branch` request
3. Check:
   - **Status:** Should be `200 OK`, not `401` or `403`
   - **Request Headers:** Session cookie should be present
   - **Response:** Should have `{ "shifts": [...] }` structure

**If you see 401:** Session expired, need to login
**If you see 403:** User is not a manager, check role
**If you see 200 but empty array:** No shifts in database, or shifts are for different date range

### **Step 3: Verify Manager Role**

Add this check to the page:

```typescript
// In client/src/pages/mui-schedule.tsx - Line 87

const isManagerRole = isManager();

console.log('👤 Current user role:', isManagerRole ? 'MANAGER' : 'EMPLOYEE'); // ADD THIS
console.log('📍 Current user branch:', currentUser?.branchId); // ADD THIS

// If not manager, component won't even try to fetch shifts
if (!isManagerRole) {
  return <Typography>Manager access only</Typography>;
}
```

### **Step 4: Check Date Range**

The query filters by date. If today is Dec 9, 2025:

```typescript
// Week view (default)
Start: Sunday Dec 7
End: Saturday Dec 13

// API filters for shifts in this range
GET /api/shifts/branch?startDate=2025-12-07T00:00:00Z&endDate=2025-12-13T23:59:59Z
```

**If you have shifts but they're outside this range**, they won't show. Check:

```sql
-- Are shifts in current week?
SELECT "startTime", "endTime" FROM shifts WHERE "startTime" >= '2025-12-07' AND "startTime" <= '2025-12-13' ORDER BY "startTime";
```

---

## 🔧 The Real Fix: Create Test Shifts

If your database is empty, you need to seed shifts:

```typescript
// Create a new file: server/seed-shifts.ts

import { storage } from './storage';

async function seedShifts() {
  try {
    // Get first manager and employee
    const manager = await storage.getUserByRole('manager');
    const employee = await storage.getUserByRole('staff');
    
    if (!manager || !employee) {
      console.error('❌ Need at least one manager and one employee');
      return;
    }
    
    // Create shift for tomorrow
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    const shift = await storage.createShift({
      userId: employee.id,
      branchId: manager.branchId,
      startTime: new Date(tomorrow.toDateString() + ' 06:00:00'),
      endTime: new Date(tomorrow.toDateString() + ' 14:00:00'),
      status: 'scheduled',
      position: employee.position || 'Staff',
    });
    
    console.log('✅ Test shift created:', shift);
  } catch (error) {
    console.error('❌ Error seeding shifts:', error);
  }
}

seedShifts();
```

Then run:
```bash
npx ts-node server/seed-shifts.ts
```

---

## ✅ Complete Drag-Drop Debug Checklist

| Check | Command/Location | Expected | Your Result |
|-------|------------------|----------|-------------|
| **1. Database has shifts** | `SELECT COUNT(*) FROM shifts;` | > 0 | ❓ |
| **2. Shifts in date range** | Check week boundaries | YES | ❓ |
| **3. Manager has branchId** | `SELECT "branchId" FROM users WHERE id = ?` | NOT NULL | ❓ |
| **4. API returns 200** | DevTools Network tab | 200 OK | ❓ |
| **5. Response has shifts** | Console log shiftsData | `{ shifts: [...]  }` | ❓ |
| **6. Shifts array populated** | Console log shifts.length | > 0 | ❓ |
| **7. isManager is true** | Console log isManagerRole | true | ❓ |
| **8. Drag listeners attached** | Inspect HTML `draggable=true` | YES | ❓ |

---

## 🎯 Quick Diagnostic Script

Add this to your console (DevTools) to check everything:

```javascript
// Copy this into browser console on the schedule page

async function diagnoseScheduling() {
  console.clear();
  console.log('🔍 SCHEDULE DIAGNOSTIC\n');
  
  // 1. Check current user
  const status = await fetch('/api/auth/status').then(r => r.json());
  console.log('👤 User:', status.user?.username, 'Role:', status.user?.role);
  console.log('📍 Branch:', status.user?.branchId);
  
  // 2. Check if manager
  const isManager = status.user?.role === 'manager';
  console.log(`👨‍💼 Is Manager: ${isManager ? '✅' : '❌'}`);
  
  if (!isManager) {
    console.log('❌ STOP: Not a manager. Schedule requires manager role.');
    return;
  }
  
  // 3. Check API response
  const now = new Date();
  const start = new Date(now.setDate(now.getDate() - 7));
  const end = new Date(now.setDate(now.getDate() + 7));
  
  const endpoint = `/api/shifts/branch?startDate=${start.toISOString()}&endDate=${end.toISOString()}`;
  const shiftsResp = await fetch(endpoint).then(r => r.json());
  
  console.log(`📡 API Response: ${shiftsResp.shifts?.length || 0} shifts`);
  
  if (shiftsResp.shifts?.length === 0) {
    console.log('⚠️  WARNING: No shifts returned from API');
    console.log('   Possible causes:');
    console.log('   1. No shifts in database');
    console.log('   2. Shifts are outside current date range');
    console.log('   3. Shifts belong to different branch');
    return;
  }
  
  console.log('✅ SUCCESS: Shifts loaded:', shiftsResp.shifts);
  
  // 4. Check drag-drop setup
  console.log('\n📦 Shift Details:');
  shiftsResp.shifts.slice(0, 2).forEach(s => {
    console.log(`  - ${s.user?.firstName} ${s.user?.lastName}: ${s.startTime} to ${s.endTime}`);
  });
}

diagnoseScheduling();
```

---

## 🚀 If Shifts Still Don't Load

### **Nuclear Option: Create Shift Via API**

```javascript
// In browser console:

const createShift = async () => {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  
  const response = await fetch('/api/shifts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      userId: 'EMPLOYEE_ID_HERE',
      branchId: 'BRANCH_ID_HERE',
      position: 'Barista',
      startTime: new Date(tomorrow.toDateString() + ' 06:00:00').toISOString(),
      endTime: new Date(tomorrow.toDateString() + ' 14:00:00').toISOString(),
      status: 'scheduled',
    })
  });
  
  console.log(await response.json());
};

createShift();
```

---

## 📋 TypeScript Logic is CORRECT

Your drag-drop TypeScript code is working fine:

```typescript
// ✅ Drag start handler (line 216)
const handleDragStart = (shift: Shift, employeeId: string) => {
  if (!isManager) return;
  setDraggedShift(shift); // Stores shift
  const startHour = parseISO(shift.startTime).getHours();
  setDragSource({ employeeId, hour: startHour });
};

// ✅ Drop handler with position calculation (line 231-260)
const handleDrop = (employeeId: string, dayIdx: number, hour: number) => {
  if (!draggedShift || !dragSource || !isManager) return;
  
  // Original shift
  const shift = draggedShift;
  const oldStart = parseISO(shift.startTime);
  const oldEnd = parseISO(shift.endTime);
  const duration = oldEnd.getTime() - oldStart.getTime();
  
  // New shift time
  const newStart = new Date(weekDays[dayIdx]);
  newStart.setHours(hour, 0, 0, 0);
  const newEnd = new Date(newStart.getTime() + duration);
  
  // Send to server
  updateShiftMutation.mutate({
    shiftId: shift.id,
    newStartTime: newStart.toISOString(),
    newEndTime: newEnd.toISOString(),
  });
  
  setDraggedShift(null);
  setDragSource(null);
};

// ✅ Mutation (line 134-161)
const updateShiftMutation = useMutation({
  mutationFn: async ({ shiftId, newStartTime, newEndTime }) => {
    const response = await apiRequest("PUT", `/api/shifts/${shiftId}`, {
      startTime: newStartTime,
      endTime: newEndTime,
    });
    if (!response.ok) throw new Error("Failed to update shift");
    return response.json();
  },
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ["shifts"] });
    onShiftUpdated?.();
  },
});
```

**The logic is perfect.** The issue is purely **data availability** (no shifts in state).

---

## 🎯 Next Steps

1. **Run the diagnostic script** above in console
2. **Check database** for shifts in current date range
3. **Check manager's branchId** is not null
4. **Create test shifts** if database is empty
5. **Reload page** and watch Network tab
6. **Drag-drop will work** once shifts load

Once shifts appear in the grid, drag-drop will work perfectly because all the TypeScript is correct! 🎉
