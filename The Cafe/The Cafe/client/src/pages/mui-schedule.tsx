import React from 'react';
import { Box, Typography, Avatar, CircularProgress } from '@mui/material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';

const SchedulePage = () => {
  const queryClient = useQueryClient();

  // Fetch data
  const { data, isLoading } = useQuery({
    queryKey: ['schedule'],
    queryFn: async () => {
      // Parallel fetch to match the user's single 'data' object expectation
      const [employeesRes, shiftsRes] = await Promise.all([
        apiRequest('GET', '/api/employees'),
        apiRequest('GET', '/api/shifts')
      ]);
      const employees = await employeesRes.json();
      const shifts = await shiftsRes.json();
      
      return {
        employees: employees.map((e: any) => ({ ...e, name: `${e.firstName} ${e.lastName}` })),
        shifts: (shifts.shifts || shifts).map((s: any) => ({
            ...s, 
            employeeId: s.userId, 
            start: s.startTime, 
            end: s.endTime,
            type: new Date(s.startTime).getHours() < 12 ? 'morning' : 'afternoon'
        }))
      };
    },
  });

  const mutation = useMutation({
    mutationFn: async (shift: any) => {
      const res = await apiRequest('PUT', `/api/shifts/${shift.id}`, shift);
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['schedule'] }),
  });

  if (isLoading) return <CircularProgress />;

  const employees = data?.employees || [];
  const shifts = data?.shifts || [];

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom>Shift Schedule</Typography>

      <Box sx={{ display: 'grid', gap: 2 }}>
        {employees.map((emp: any) => (
          <Box key={emp.id} sx={{ border: '1px solid #ddd', borderRadius: 2, p: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
              <Avatar sx={{ bgcolor: emp.role?.includes('manager') ? '#e25dd2' : '#60e81a' }}>
                {emp.name[0]}
              </Avatar>
              <Box>
                <div><strong>{emp.name}</strong></div>
                <div style={{ fontSize: '0.9rem', color: '#666' }}>{emp.role || 'Staff'}</div>
              </Box>
            </Box>

            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
              {shifts
                .filter((s: any) => s.employeeId === emp.id)
                .map((shift: any) => (
                  <Box
                    key={shift.id}
                    sx={{
                      bgcolor: shift.type === 'morning' ? '#60e81a' : '#ffb300',
                      color: 'white',
                      px: 2,
                      py: 1,
                      borderRadius: 2,
                      fontSize: '0.9rem',
                      cursor: 'grab',
                    }}
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData('shiftId', shift.id);
                    }}
                  >
                    {new Date(shift.start).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})} - {new Date(shift.end).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}
                  </Box>
                ))}
            </Box>
          </Box>
        ))}
      </Box>
    </Box>
  );
};

export default SchedulePage;
