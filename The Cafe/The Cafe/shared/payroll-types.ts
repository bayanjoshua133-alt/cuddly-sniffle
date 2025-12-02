export type HolidayType = 'regular' | 'special_non_working' | 'special_working' | 'normal';

export interface HolidayLookupResult {
  type: HolidayType;
  name?: string;
}

export interface HourlyBucketBreakdown {
  start: string;
  end: string;
  hours: number;
  isNightDiff: boolean;
  isOvertime: boolean;
  multipliers: {
    holiday: number;
    overtime: number;
    nightDiff: number;
  };
  pay: number;
}

export interface DatePayBreakdown {
  date: string;
  holidayType: HolidayType;
  holidayName?: string;
  isRestDay: boolean;
  hoursWorked: number;
  overtimeHours: number;
  nightHours: number;
  basePay: number;
  holidayMultiplier: number;
  overtimeMultiplier: number;
  nightDiffMultiplier: number;
  holidayPremium: number;
  restDayPremium: number;
  overtimePay: number;
  nightDiffPremium: number;
  totalForDate: number;
  detailedHourBreakdown: HourlyBucketBreakdown[];
}

export interface PayBreakdown {
  perDate: DatePayBreakdown[];
  totalHours: number;
  grossPay: number;
  taxesNotHandledHereFlag: boolean;
  notes: string[];
  weeklyOtHoursToReview: number;
}

export interface ShiftPayBreakdown {
  shiftId: string;
  scheduledStart: string;
  scheduledEnd: string;
  actualStart?: string | null;
  actualEnd?: string | null;
  pay: PayBreakdown;
}

export interface PayrollEntryBreakdownPayload {
  version: 1;
  generatedAt: string;
  aggregated: PayBreakdown;
  perShift: ShiftPayBreakdown[];
}
