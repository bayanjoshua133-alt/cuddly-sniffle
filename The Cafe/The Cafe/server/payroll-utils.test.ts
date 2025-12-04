import { describe, expect, it } from "vitest";
import { calculateShiftPay, HolidayType } from "./payroll-utils";
import { Holiday, Shift } from "../shared/schema";

const HOUR = 60 * 60 * 1000;
const DEFAULT_RATE = 100;

function buildShift(overrides: Partial<Shift> = {}): Shift {
  const defaultStart = new Date("2025-01-06T09:00:00Z");
  const defaultEnd = new Date(defaultStart.getTime() + 8 * HOUR);

  const start = overrides.startTime ?? defaultStart;
  const end = overrides.endTime ?? defaultEnd;

  return {
    id: overrides.id ?? "shift-1",
    userId: overrides.userId ?? "user-1",
    branchId: overrides.branchId ?? "branch-1",
    position: overrides.position ?? "Barista",
    isRecurring: overrides.isRecurring ?? false,
    recurringPattern: overrides.recurringPattern ?? null,
    status: overrides.status ?? "completed",
    startTime: start,
    endTime: end,
    actualStartTime: overrides.actualStartTime ?? start,
    actualEndTime: overrides.actualEndTime ?? end,
    createdAt: overrides.createdAt ?? new Date("2025-01-01T00:00:00Z"),
  } as Shift;
}

function buildHoliday(dateIso: string, type: HolidayType, name: string): Holiday {
  const date = new Date(dateIso);
  return {
    id: `${type}-${dateIso}`,
    name,
    date,
    type,
    year: date.getFullYear(),
    isRecurring: false,
    createdAt: date,
  } as Holiday;
}

describe("calculateShiftPay", () => {
  it("calculates base pay for a regular shift", () => {
    const shift = buildShift();

    const result = calculateShiftPay({
      shift,
      hourlyRate: DEFAULT_RATE,
    });

    expect(result.totalHours).toBeCloseTo(8, 4);
    expect(result.grossPay).toBe(800);
    expect(result.perDate).toHaveLength(1);

    const day = result.perDate[0];
    expect(day.holidayType).toBe("normal");
    expect(day.overtimeHours).toBe(0);
    expect(day.nightHours).toBe(0);
    expect(day.holidayPremium).toBe(0);
    expect(day.restDayPremium).toBe(0);
  });

  it("splits cross-midnight shifts and tracks night differential correctly", () => {
    const start = new Date("2025-01-06T21:00:00Z");
    const end = new Date("2025-01-07T07:00:00Z");
    const shift = buildShift({ id: "shift-night", startTime: start, endTime: end });

    const result = calculateShiftPay({
      shift,
      hourlyRate: DEFAULT_RATE,
    });

    expect(result.totalHours).toBeCloseTo(10, 4);
    expect(result.perDate).toHaveLength(2);
    expect(result.grossPay).toBeCloseTo(1080, 2);

    const totalNightHours = result.perDate.reduce((sum, d) => sum + d.nightHours, 0);
    expect(totalNightHours).toBeCloseTo(8, 4);

    const totalOtHours = result.perDate.reduce((sum, d) => sum + d.overtimeHours, 0);
    expect(totalOtHours).toBeCloseTo(0, 4);

    const totalNightPremium = result.perDate.reduce((sum, d) => sum + d.nightDiffPremium, 0);
    expect(totalNightPremium).toBeCloseTo(80, 1);
  });

  it("adds regular holiday premiums when worked", () => {
    const christmas = buildHoliday("2025-12-25T00:00:00Z", "regular", "Christmas Day");
    const start = new Date("2025-12-25T08:00:00Z");
    const end = new Date("2025-12-25T16:00:00Z");
    const shift = buildShift({ id: "shift-holiday", startTime: start, endTime: end });

    const result = calculateShiftPay({
      shift,
      hourlyRate: DEFAULT_RATE,
      holidays: [christmas],
    });

    expect(result.perDate).toHaveLength(1);
    const day = result.perDate[0];

    expect(day.holidayType).toBe("regular");
    expect(day.holidayName).toBe("Christmas Day");
    expect(day.holidayPremium).toBe(800);
    expect(day.restDayPremium).toBe(0);
    expect(result.grossPay).toBe(1600);
  });

  it("applies rest day premiums on normal days", () => {
    const sunday = new Date("2025-01-05T09:00:00Z");
    const shift = buildShift({
      id: "shift-rest",
      startTime: sunday,
      endTime: new Date(sunday.getTime() + 8 * HOUR),
    });

    const result = calculateShiftPay({
      shift,
      hourlyRate: DEFAULT_RATE,
      restDay: 0, // Sunday
    });

    expect(result.perDate).toHaveLength(1);
    const day = result.perDate[0];

    expect(day.isRestDay).toBe(true);
    expect(day.restDayPremium).toBeCloseTo(240, 2);
    expect(day.holidayPremium).toBe(0);
    expect(result.grossPay).toBeCloseTo(1040, 2);
  });
});
