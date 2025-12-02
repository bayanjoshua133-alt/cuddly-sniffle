/**
 * Philippine Payroll Calculation Utilities
 * Implements DOLE-compliant payroll calculations including:
 * - Daily 8-hour overtime rule
 * - Holiday pay (Regular, Special Non-Working, Special Working)
 * - Night differential (10PM-6AM = +10%)
 * - Rest day premiums
 * - Cross-midnight shift splitting
 */

import { Holiday, Shift } from "@shared/schema";

// Philippine Holiday Types and their pay rates
export const HOLIDAY_RATES = {
  regular: {
    notWorked: 1.0,    // Paid holiday - 100% of daily wage
    worked: 2.0,       // 200% of daily wage
    overtime: 2.6,     // 200% × 130% = 260%
    restDay: 2.6,      // 260% on rest day
    restDayOT: 3.38,   // 338% rest day overtime
  },
  special_non_working: {
    notWorked: 0,      // No work, no pay
    worked: 1.3,       // 130% of daily wage
    overtime: 1.69,    // 130% × 130% = 169%
    restDay: 1.5,      // 150% on rest day
    restDayOT: 1.95,   // 150% × 130% = 195%
  },
  special_working: {
    notWorked: 1.0,    // Normal day - 100%
    worked: 1.0,       // Normal rate
    overtime: 1.25,    // Normal OT
    restDay: 1.3,      // 130% on rest day
    restDayOT: 1.69,   // Rest day OT
  },
  normal: {
    notWorked: 0,      // No pay for not working
    worked: 1.0,       // 100% normal rate
    overtime: 1.25,    // 125% for OT (first 8 hours at 100%, after that 125%)
    restDay: 1.3,      // 130% on rest day
    restDayOT: 1.69,   // Rest day OT
  }
};

// Night Differential: 10% premium for hours between 10PM-6AM
export const NIGHT_DIFF_START = 22; // 10 PM
export const NIGHT_DIFF_END = 6;    // 6 AM
export const NIGHT_DIFF_RATE = 0.10; // 10% additional

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

export interface CalculateShiftPayOptions {
  applyHolidayLogic?: boolean;
  holidayLogicCutoffDate?: Date;
  nightDiffRate?: number;
}

export interface CalculateShiftPayParams {
  shift: Shift;
  hourlyRate: number;
  holidays?: Holiday[];
  restDay?: number;
  holidayLookup?: (date: Date) => HolidayLookupResult | HolidayType | null;
  options?: CalculateShiftPayOptions;
  weeklyOtHoursAlreadyAccumulated?: number;
}

// Daily overtime threshold (DOLE compliance)
export const DAILY_REGULAR_HOURS = 8;

export interface ShiftHourBreakdown {
  regularHours: number;
  overtimeHours: number;
  nightDiffHours: number;
  holidayType: HolidayType;
  isRestDay: boolean;
  date: Date;
}

export interface PayCalculation {
  basicPay: number;
  overtimePay: number;
  holidayPay: number;
  nightDiffPay: number;
  restDayPay: number;
  totalGrossPay: number;
  breakdown: ShiftHourBreakdown[];
}

/**
 * Check if a given hour falls within night differential window (10PM-6AM)
 */
export function isNightDiffHour(hour: number): boolean {
  return hour >= NIGHT_DIFF_START || hour < NIGHT_DIFF_END;
}

/**
 * Calculate how many hours in a shift fall within night differential window
 */
export function calculateNightDiffHours(startTime: Date, endTime: Date): number {
  let nightHours = 0;
  const current = new Date(startTime);

  while (current < endTime) {
    const hour = current.getHours();
    if (isNightDiffHour(hour)) {
      nightHours += 1;
    }
    current.setHours(current.getHours() + 1);
  }

  // Handle partial hours at the end
  const remainingMinutes = (endTime.getTime() - current.getTime() + 3600000) % 3600000;
  if (remainingMinutes > 0 && isNightDiffHour(endTime.getHours())) {
    nightHours += remainingMinutes / 3600000;
  }

  return Math.max(0, nightHours);
}

/**
 * Get holiday type for a specific date
 */
export function getHolidayType(date: Date, holidays: Holiday[]): HolidayType {
  const dateStr = date.toISOString().split('T')[0];

  for (const holiday of holidays) {
    const holidayDate = new Date(holiday.date).toISOString().split('T')[0];
    if (dateStr === holidayDate) {
      return holiday.type as HolidayType;
    }
  }

  return 'normal';
}

const MS_PER_HOUR = 1000 * 60 * 60;

function roundCurrency(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function normalizeDateOnly(date: Date): Date {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function normalizeHolidayLookup(result: HolidayLookupResult | HolidayType | null | undefined): HolidayLookupResult {
  if (!result) {
    return { type: 'normal' };
  }
  if (typeof result === 'string') {
    return { type: result };
  }
  return result;
}

function buildSegmentBoundaries(segmentStart: Date, segmentEnd: Date): Date[] {
  const boundaries = new Set<number>();
  boundaries.add(segmentStart.getTime());
  boundaries.add(segmentEnd.getTime());

  // Hourly boundaries for easier reporting
  const hourlyCursor = new Date(segmentStart);
  hourlyCursor.setMinutes(0, 0, 0);
  if (hourlyCursor < segmentStart) {
    hourlyCursor.setHours(hourlyCursor.getHours() + 1);
  }
  while (hourlyCursor < segmentEnd) {
    boundaries.add(hourlyCursor.getTime());
    hourlyCursor.setHours(hourlyCursor.getHours() + 1);
  }

  // Night differential boundaries (06:00 and 22:00)
  const sixAm = new Date(segmentStart);
  sixAm.setHours(6, 0, 0, 0);
  if (sixAm > segmentStart && sixAm < segmentEnd) {
    boundaries.add(sixAm.getTime());
  }

  const tenPm = new Date(segmentStart);
  tenPm.setHours(22, 0, 0, 0);
  if (tenPm > segmentStart && tenPm < segmentEnd) {
    boundaries.add(tenPm.getTime());
  }

  return Array.from(boundaries)
    .sort((a, b) => a - b)
    .map((timestamp) => new Date(timestamp));
}

function createDateKey(date: Date): string {
  return date.toISOString().split('T')[0];
}

function getHolidayRates(holidayType: HolidayType) {
  return HOLIDAY_RATES[holidayType] ?? HOLIDAY_RATES.normal;
}

function toDate(value: Date | string | number | null | undefined): Date | null {
  if (value === null || value === undefined) {
    return null;
  }

  const result = value instanceof Date ? new Date(value) : new Date(value);
  return isNaN(result.getTime()) ? null : result;
}

type HolidayResolver = (date: Date) => HolidayLookupResult;

function createHolidayResolver(
  holidays: Holiday[] | undefined,
  override?: (date: Date) => HolidayLookupResult | HolidayType | null,
  fallback?: HolidayLookupResult
): HolidayResolver {
  const normalizedFallback = fallback ?? { type: 'normal' };

  if (override) {
    return (date: Date) => normalizeHolidayLookup(override(date));
  }

  if (holidays && holidays.length > 0) {
    const map = new Map<string, HolidayLookupResult>();
    for (const holiday of holidays) {
      const key = createDateKey(new Date(holiday.date));
      map.set(key, { type: holiday.type as HolidayType, name: holiday.name });
    }

    return (date: Date) => map.get(createDateKey(date)) ?? normalizedFallback;
  }

  return () => normalizedFallback;
}

function intervalOverlapsNightDiff(start: Date, end: Date): boolean {
  if (start >= end) {
    return false;
  }

  const startHour = start.getHours() + start.getMinutes() / 60;
  const endHour = end.getHours() + end.getMinutes() / 60;

  const startInNightWindow = startHour >= NIGHT_DIFF_START || startHour < NIGHT_DIFF_END;

  if (startInNightWindow) {
    return true;
  }

  // Handle rare case where interval crosses into ND window without matching boundary
  if (startHour < NIGHT_DIFF_START && endHour > NIGHT_DIFF_START) {
    return true;
  }

  if (startHour < NIGHT_DIFF_END && endHour > NIGHT_DIFF_END) {
    return true;
  }

  return false;
}

/**
 * Split a cross-midnight shift into separate date segments
 * Required for proper holiday pay calculation when shift crosses midnight
 */
export function splitCrossMidnightShift(startTime: Date, endTime: Date): { start: Date; end: Date; date: Date }[] {
  const segments: { start: Date; end: Date; date: Date }[] = [];
  const current = new Date(startTime);

  while (current < endTime) {
    const segmentStart = new Date(current);
    const nextMidnight = new Date(current);
    nextMidnight.setDate(nextMidnight.getDate() + 1);
    nextMidnight.setHours(0, 0, 0, 0);

    const segmentEnd = nextMidnight < endTime ? nextMidnight : new Date(endTime);

    segments.push({
      start: segmentStart,
      end: segmentEnd,
      date: new Date(segmentStart.getFullYear(), segmentStart.getMonth(), segmentStart.getDate())
    });

    current.setTime(nextMidnight.getTime());
  }

  return segments;
}

/**
 * Calculate hours for a single segment
 */
export function calculateSegmentHours(start: Date, end: Date): number {
  return (end.getTime() - start.getTime()) / (1000 * 60 * 60);
}

/**
 * Check if a date is the employee's rest day
 * Default rest day is Sunday (0), can be configured per employee
 */
export function isRestDay(date: Date, restDay: number = 0): boolean {
  return date.getDay() === restDay;
}

/**
 * Calculate daily hours breakdown with overtime rule
 * After 8 hours in a single day, additional hours are overtime
 */
export function calculateDailyHoursBreakdown(
  shifts: { startTime: Date | string; endTime: Date | string; actualStartTime?: Date | string | null; actualEndTime?: Date | string | null }[],
  holidays: Holiday[],
  restDay: number = 0
): Map<string, ShiftHourBreakdown> {
  const dailyBreakdown = new Map<string, ShiftHourBreakdown>();

  for (const shift of shifts) {
    const startTime = new Date(shift.actualStartTime || shift.startTime);
    const endTime = new Date(shift.actualEndTime || shift.endTime);

    // Split cross-midnight shifts
    const segments = splitCrossMidnightShift(startTime, endTime);

    for (const segment of segments) {
      const dateKey = segment.date.toISOString().split('T')[0];
      const segmentHours = calculateSegmentHours(segment.start, segment.end);
      const nightDiffHours = calculateNightDiffHours(segment.start, segment.end);
      const holidayType = getHolidayType(segment.date, holidays);
      const isRest = isRestDay(segment.date, restDay);

      if (!dailyBreakdown.has(dateKey)) {
        dailyBreakdown.set(dateKey, {
          regularHours: 0,
          overtimeHours: 0,
          nightDiffHours: 0,
          holidayType,
          isRestDay: isRest,
          date: segment.date
        });
      }

      const existing = dailyBreakdown.get(dateKey)!;
      const currentTotalHours = existing.regularHours + existing.overtimeHours;

      // Apply daily 8-hour overtime rule
      if (currentTotalHours >= DAILY_REGULAR_HOURS) {
        // Already exceeded 8 hours, all additional hours are OT
        existing.overtimeHours += segmentHours;
      } else if (currentTotalHours + segmentHours > DAILY_REGULAR_HOURS) {
        // This segment crosses the 8-hour threshold
        const remainingRegular = DAILY_REGULAR_HOURS - currentTotalHours;
        existing.regularHours += remainingRegular;
        existing.overtimeHours += (segmentHours - remainingRegular);
      } else {
        // All hours are regular
        existing.regularHours += segmentHours;
      }

      existing.nightDiffHours += nightDiffHours;
    }
  }

  return dailyBreakdown;
}

/**
 * Calculate pay for all shifts in a period
 */
export function calculatePeriodPay(
  shifts: { startTime: Date | string; endTime: Date | string; actualStartTime?: Date | string | null; actualEndTime?: Date | string | null }[],
  hourlyRate: number,
  holidays: Holiday[],
  restDay: number = 0
): PayCalculation {
  const dailyBreakdown = calculateDailyHoursBreakdown(shifts, holidays, restDay);

  let basicPay = 0;
  let overtimePay = 0;
  let holidayPay = 0;
  let nightDiffPay = 0;
  let restDayPay = 0;
  const breakdown: ShiftHourBreakdown[] = [];

  for (const [, dayData] of dailyBreakdown) {
    breakdown.push(dayData);
    const rates = HOLIDAY_RATES[dayData.holidayType];

    let regularRate = rates.worked;
    let otRate = rates.overtime;

    // Apply rest day premium if applicable
    if (dayData.isRestDay) {
      regularRate = rates.restDay;
      otRate = rates.restDayOT;
    }

    // Calculate base pay for regular hours
    const regularPay = dayData.regularHours * hourlyRate * regularRate;
    const otPay = dayData.overtimeHours * hourlyRate * otRate;

    // Night differential is calculated on top of the applicable rate
    const nightDiffBase = (dayData.nightDiffHours * hourlyRate * regularRate);
    const nightDiff = nightDiffBase * NIGHT_DIFF_RATE;

    // Categorize the pay
    if (dayData.holidayType !== 'normal') {
      // Holiday worked - extra pay goes to holidayPay
      holidayPay += (regularPay - (dayData.regularHours * hourlyRate));
      basicPay += dayData.regularHours * hourlyRate;
    } else if (dayData.isRestDay) {
      // Rest day - extra pay goes to restDayPay
      restDayPay += (regularPay - (dayData.regularHours * hourlyRate));
      basicPay += dayData.regularHours * hourlyRate;
    } else {
      basicPay += regularPay;
    }

    overtimePay += otPay;
    nightDiffPay += nightDiff;
  }

  return {
    basicPay: Math.round(basicPay * 100) / 100,
    overtimePay: Math.round(overtimePay * 100) / 100,
    holidayPay: Math.round(holidayPay * 100) / 100,
    nightDiffPay: Math.round(nightDiffPay * 100) / 100,
    restDayPay: Math.round(restDayPay * 100) / 100,
    totalGrossPay: Math.round((basicPay + overtimePay + holidayPay + nightDiffPay + restDayPay) * 100) / 100,
    breakdown
  };
}

type HolidayRateConfig = typeof HOLIDAY_RATES.regular;

interface InternalDateAccumulator extends DatePayBreakdown {
  regularHoursConsumed: number;
  nonRestHolidayMultiplier: number;
  rateTable: HolidayRateConfig;
}

function createZeroPayBreakdown(notes: string[] = []): PayBreakdown {
  return {
    perDate: [],
    totalHours: 0,
    grossPay: 0,
    taxesNotHandledHereFlag: true,
    notes,
    weeklyOtHoursToReview: 0,
  };
}

export function mergePayBreakdowns(breakdowns: PayBreakdown[]): PayBreakdown {
  if (breakdowns.length === 0) {
    return createZeroPayBreakdown();
  }

  const perDateMap = new Map<string, DatePayBreakdown>();

  for (const breakdown of breakdowns) {
    for (const dateEntry of breakdown.perDate) {
      const existing = perDateMap.get(dateEntry.date);

      if (!existing) {
        perDateMap.set(dateEntry.date, {
          ...dateEntry,
          detailedHourBreakdown: [...dateEntry.detailedHourBreakdown],
        });
      } else {
        existing.hoursWorked += dateEntry.hoursWorked;
        existing.overtimeHours += dateEntry.overtimeHours;
        existing.nightHours += dateEntry.nightHours;
        existing.basePay += dateEntry.basePay;
        existing.holidayPremium += dateEntry.holidayPremium;
        existing.restDayPremium += dateEntry.restDayPremium;
        existing.overtimePay += dateEntry.overtimePay;
        existing.nightDiffPremium += dateEntry.nightDiffPremium;
        existing.totalForDate += dateEntry.totalForDate;
        existing.detailedHourBreakdown = existing.detailedHourBreakdown.concat(dateEntry.detailedHourBreakdown);
      }
    }
  }

  const perDate = Array.from(perDateMap.values())
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((entry) => ({
      ...entry,
      hoursWorked: Number(entry.hoursWorked.toFixed(4)),
      overtimeHours: Number(entry.overtimeHours.toFixed(4)),
      nightHours: Number(entry.nightHours.toFixed(4)),
      basePay: roundCurrency(entry.basePay),
      holidayPremium: roundCurrency(entry.holidayPremium),
      restDayPremium: roundCurrency(entry.restDayPremium),
      overtimePay: roundCurrency(entry.overtimePay),
      nightDiffPremium: roundCurrency(entry.nightDiffPremium),
      totalForDate: roundCurrency(entry.totalForDate),
      detailedHourBreakdown: entry.detailedHourBreakdown.map((bucket) => ({
        ...bucket,
        hours: Number(bucket.hours.toFixed(4)),
        pay: roundCurrency(bucket.pay),
      })),
    }));

  const totalHours = Number(breakdowns.reduce((sum, item) => sum + item.totalHours, 0).toFixed(4));
  const grossPay = roundCurrency(breakdowns.reduce((sum, item) => sum + item.grossPay, 0));
  const taxesNotHandledHereFlag = breakdowns.every((item) => item.taxesNotHandledHereFlag);
  const notes = breakdowns.flatMap((item) => item.notes);
  const weeklyOtHoursToReview = Number(
    breakdowns.reduce((sum, item) => sum + item.weeklyOtHoursToReview, 0).toFixed(4)
  );

  return {
    perDate,
    totalHours,
    grossPay,
    taxesNotHandledHereFlag,
    notes,
    weeklyOtHoursToReview,
  };
}

export function buildPayrollEntryBreakdownPayload(perShift: ShiftPayBreakdown[]): PayrollEntryBreakdownPayload {
  const aggregated = mergePayBreakdowns(perShift.map((shift) => shift.pay));
  return {
    version: 1,
    generatedAt: new Date().toISOString(),
    aggregated,
    perShift,
  };
}

export function calculateShiftPay(params: CalculateShiftPayParams): PayBreakdown {
  const {
    shift,
    hourlyRate,
    holidays,
    restDay = 0,
    holidayLookup,
    options,
    weeklyOtHoursAlreadyAccumulated = 0,
  } = params;

  const notes: string[] = [];

  if (hourlyRate <= 0) {
    notes.push("Hourly rate must be greater than zero");
    return createZeroPayBreakdown(notes);
  }

  const startTime = toDate(shift.actualStartTime ?? shift.startTime);
  const endTime = toDate(shift.actualEndTime ?? shift.endTime);

  if (!startTime || !endTime) {
    notes.push("Shift is missing start or end time");
    return createZeroPayBreakdown(notes);
  }

  if (endTime <= startTime) {
    notes.push("Shift end time must be after start time");
    return createZeroPayBreakdown(notes);
  }

  // Ensure we don't process extremely long shifts
  const shiftDurationHours = (endTime.getTime() - startTime.getTime()) / MS_PER_HOUR;
  if (shiftDurationHours > 24) {
    notes.push("Shift duration exceeds 24 hours and cannot be processed");
    return createZeroPayBreakdown(notes);
  }

  if (!shift.actualStartTime || !shift.actualEndTime) {
    notes.push("Using scheduled shift times (no clock-in/clock-out captured)");
  }

  const normalizedOptions = options ?? {};
  let applyHolidayLogic = normalizedOptions.applyHolidayLogic ?? true;
  if (normalizedOptions.holidayLogicCutoffDate && endTime < normalizedOptions.holidayLogicCutoffDate) {
    applyHolidayLogic = false;
    notes.push(`Holiday premiums skipped for shifts before ${normalizedOptions.holidayLogicCutoffDate.toISOString().split('T')[0]}`);
  }

  const nightDiffRate = normalizedOptions.nightDiffRate ?? NIGHT_DIFF_RATE;

  const holidayResolver: HolidayResolver = applyHolidayLogic
    ? createHolidayResolver(holidays, holidayLookup)
    : () => ({ type: 'normal' });

  const segments = splitCrossMidnightShift(startTime, endTime);
  const perDateMap = new Map<string, InternalDateAccumulator>();

  for (const segment of segments) {
    const dateKey = createDateKey(segment.date);
    let accumulator = perDateMap.get(dateKey);

    if (!accumulator) {
      const holidayInfo = holidayResolver(segment.date);
      const rateTable = getHolidayRates(holidayInfo.type);
      const isRest = isRestDay(segment.date, restDay);
      const baseHolidayMultiplier = isRest ? rateTable.restDay : rateTable.worked;
      const nonRestMultiplier = holidayInfo.type === 'normal' ? 1 : rateTable.worked;
      const overtimeMultiplier = baseHolidayMultiplier === 0
        ? 1
        : (isRest ? rateTable.restDayOT : rateTable.overtime) / baseHolidayMultiplier;

      accumulator = {
        date: dateKey,
        holidayType: holidayInfo.type,
        holidayName: holidayInfo.name,
        isRestDay: isRest,
        hoursWorked: 0,
        overtimeHours: 0,
        nightHours: 0,
        basePay: 0,
        holidayMultiplier: baseHolidayMultiplier,
        overtimeMultiplier,
        nightDiffMultiplier: 1 + nightDiffRate,
        holidayPremium: 0,
        restDayPremium: 0,
        overtimePay: 0,
        nightDiffPremium: 0,
        totalForDate: 0,
        detailedHourBreakdown: [],
        regularHoursConsumed: 0,
        nonRestHolidayMultiplier: nonRestMultiplier,
        rateTable,
      };

      perDateMap.set(dateKey, accumulator);
    }

    const boundaries = buildSegmentBoundaries(segment.start, segment.end);

    for (let i = 0; i < boundaries.length - 1; i++) {
      const intervalStart = boundaries[i];
      const intervalEnd = boundaries[i + 1];
      const intervalHours = (intervalEnd.getTime() - intervalStart.getTime()) / MS_PER_HOUR;

      if (intervalHours <= 0) {
        continue;
      }

      let remainingHours = intervalHours;
      let cursor = new Date(intervalStart);

      while (remainingHours > 1e-9) {
        const regularHoursLeft = Math.max(0, DAILY_REGULAR_HOURS - accumulator.regularHoursConsumed);
        const takingRegularHours = regularHoursLeft > 0;
        const sliceHours = takingRegularHours ? Math.min(remainingHours, regularHoursLeft) : remainingHours;
        const sliceMs = sliceHours * MS_PER_HOUR;
        const sliceEnd = new Date(cursor.getTime() + sliceMs);
        const isOvertime = !takingRegularHours;
        const isNight = intervalOverlapsNightDiff(cursor, sliceEnd);

        const baseHolidayMultiplier = accumulator.holidayMultiplier || 1;
        const nightMultiplier = isNight ? 1 + nightDiffRate : 1;
        const overtimeMultiplier = isOvertime
          ? (accumulator.isRestDay
              ? accumulator.rateTable.restDayOT / baseHolidayMultiplier
              : accumulator.rateTable.overtime / baseHolidayMultiplier)
          : 1;

        const baseComponent = sliceHours * hourlyRate;
        const payBeforeNight = baseComponent * baseHolidayMultiplier * overtimeMultiplier;
        const totalPay = payBeforeNight * nightMultiplier;

        accumulator.basePay += baseComponent;
        accumulator.hoursWorked += sliceHours;
        if (isOvertime) {
          accumulator.overtimeHours += sliceHours;
        } else {
          accumulator.regularHoursConsumed += sliceHours;
        }

        if (isNight) {
          accumulator.nightHours += sliceHours;
          accumulator.nightDiffPremium += payBeforeNight * (nightMultiplier - 1);
        }

        if (accumulator.holidayType !== 'normal') {
          accumulator.holidayPremium += baseComponent * (accumulator.nonRestHolidayMultiplier - 1);
        }

        if (accumulator.isRestDay) {
          const restBaseline = accumulator.holidayType === 'normal'
            ? 1
            : accumulator.nonRestHolidayMultiplier;
          accumulator.restDayPremium += baseComponent * (baseHolidayMultiplier - restBaseline);
        }

        if (isOvertime) {
          accumulator.overtimePay += baseComponent * baseHolidayMultiplier * (overtimeMultiplier - 1);
        }

        accumulator.totalForDate += totalPay;

        accumulator.detailedHourBreakdown.push({
          start: cursor.toISOString(),
          end: sliceEnd.toISOString(),
          hours: sliceHours,
          isNightDiff: isNight,
          isOvertime,
          multipliers: {
            holiday: baseHolidayMultiplier,
            overtime: overtimeMultiplier,
            nightDiff: nightMultiplier,
          },
          pay: totalPay,
        });

        remainingHours -= sliceHours;
        cursor = sliceEnd;
      }
    }
  }

  const perDateBreakdown = Array.from(perDateMap.values())
    .sort((a, b) => a.date.localeCompare(b.date))
    .map(({ regularHoursConsumed, nonRestHolidayMultiplier, rateTable, ...publicFields }) => ({
      ...publicFields,
      hoursWorked: Number(publicFields.hoursWorked.toFixed(4)),
      overtimeHours: Number(publicFields.overtimeHours.toFixed(4)),
      nightHours: Number(publicFields.nightHours.toFixed(4)),
      basePay: roundCurrency(publicFields.basePay),
      holidayPremium: roundCurrency(publicFields.holidayPremium),
      restDayPremium: roundCurrency(publicFields.restDayPremium),
      overtimePay: roundCurrency(publicFields.overtimePay),
      nightDiffPremium: roundCurrency(publicFields.nightDiffPremium),
      totalForDate: roundCurrency(publicFields.totalForDate),
      detailedHourBreakdown: publicFields.detailedHourBreakdown.map((bucket) => ({
        ...bucket,
        hours: Number(bucket.hours.toFixed(4)),
        pay: roundCurrency(bucket.pay),
      })),
    }));

  if (perDateBreakdown.length === 0) {
    notes.push("Shift produced no payable hours");
    return createZeroPayBreakdown(notes);
  }

  const totalHours = Number(perDateBreakdown.reduce((sum, date) => sum + date.hoursWorked, 0).toFixed(4));
  const grossPay = roundCurrency(perDateBreakdown.reduce((sum, date) => sum + date.totalForDate, 0));
  const totalOvertimeHours = Number(perDateBreakdown.reduce((sum, date) => sum + date.overtimeHours, 0).toFixed(4));

  return {
    perDate: perDateBreakdown,
    totalHours,
    grossPay,
    taxesNotHandledHereFlag: true,
    notes,
    weeklyOtHoursToReview: Number((totalOvertimeHours + (weeklyOtHoursAlreadyAccumulated || 0)).toFixed(4)),
  };
}

/**
 * Validate shift times - end time must be after start time
 * Returns error message if invalid, null if valid
 */
export function validateShiftTimes(startTime: Date | string, endTime: Date | string): string | null {
  const start = new Date(startTime);
  const end = new Date(endTime);

  if (isNaN(start.getTime())) {
    return "Invalid start time";
  }

  if (isNaN(end.getTime())) {
    return "Invalid end time";
  }

  if (end <= start) {
    return "End time must be after start time";
  }

  // Maximum shift duration of 24 hours
  const hoursWorked = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
  if (hoursWorked > 24) {
    return "Shift cannot exceed 24 hours";
  }

  return null;
}

/**
 * Get 2025 Philippine holidays
 */
export function get2025PhilippineHolidays(): { name: string; date: Date; type: 'regular' | 'special_non_working' | 'special_working'; year: number }[] {
  return [
    // Regular Holidays (200% if worked)
    { name: "New Year's Day", date: new Date(2025, 0, 1), type: 'regular', year: 2025 },
    { name: "Eid ul-Fitr", date: new Date(2025, 3, 1), type: 'regular', year: 2025 },
    { name: "Araw ng Kagitingan", date: new Date(2025, 3, 9), type: 'regular', year: 2025 },
    { name: "Maundy Thursday", date: new Date(2025, 3, 17), type: 'regular', year: 2025 },
    { name: "Good Friday", date: new Date(2025, 3, 18), type: 'regular', year: 2025 },
    { name: "Labor Day", date: new Date(2025, 4, 1), type: 'regular', year: 2025 },
    { name: "Independence Day", date: new Date(2025, 5, 12), type: 'regular', year: 2025 },
    { name: "National Heroes Day", date: new Date(2025, 7, 25), type: 'regular', year: 2025 },
    { name: "Bonifacio Day", date: new Date(2025, 10, 30), type: 'regular', year: 2025 },
    { name: "Christmas Day", date: new Date(2025, 11, 25), type: 'regular', year: 2025 },
    { name: "Rizal Day", date: new Date(2025, 11, 30), type: 'regular', year: 2025 },

    // Special Non-Working Days (130% if worked, no pay if not)
    { name: "Chinese New Year", date: new Date(2025, 0, 29), type: 'special_non_working', year: 2025 },
    { name: "Black Saturday", date: new Date(2025, 3, 19), type: 'special_non_working', year: 2025 },
    { name: "Ninoy Aquino Day", date: new Date(2025, 7, 21), type: 'special_non_working', year: 2025 },
    { name: "All Saints' Day Eve", date: new Date(2025, 9, 31), type: 'special_non_working', year: 2025 },
    { name: "All Saints' Day", date: new Date(2025, 10, 1), type: 'special_non_working', year: 2025 },
    { name: "Feast of the Immaculate Conception", date: new Date(2025, 11, 8), type: 'special_non_working', year: 2025 },
    { name: "Christmas Eve", date: new Date(2025, 11, 24), type: 'special_non_working', year: 2025 },
    { name: "Last Day of the Year", date: new Date(2025, 11, 31), type: 'special_non_working', year: 2025 },

    // Eid ul-Adha (estimated)
    { name: "Eid ul-Adha", date: new Date(2025, 5, 7), type: 'regular', year: 2025 },
  ];
}