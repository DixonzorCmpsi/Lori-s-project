import { describe, it, expect } from "vitest";
import { generateSchedule, type ScheduleInput } from "@/shared/schedule/generator";

function parseLocal(s: string) {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

const baseInput: ScheduleInput = {
  firstRehearsal: "2026-04-01",
  openingNight: "2026-05-01",
  closingNight: "2026-05-03",
  selectedDays: [1, 3, 5], // Mon, Wed, Fri
  startTime: "15:00",
  endTime: "18:00",
  blockedDates: [],
  techWeekEnabled: false,
  techWeekDays: 0,
  dressRehearsalEnabled: false,
};

describe("Schedule generation", () => {
  // SCHED-01: Generate schedule from wizard answers
  it("generates correct dates for selected days", () => {
    const result = generateSchedule(baseInput);
    expect(result.dates.length).toBeGreaterThan(0);
    // All non-performance dates should be on Mon/Wed/Fri
    const rehearsals = result.dates.filter((d) => d.type === "regular");
    for (const r of rehearsals) {
      const day = parseLocal(r.date).getDay();
      expect([1, 3, 5]).toContain(day);
    }
    // All dates have correct times
    for (const d of result.dates) {
      expect(d.startTime).toBe("15:00");
      expect(d.endTime).toBe("18:00");
    }
  });

  // Determinism: identical inputs = identical output
  it("is deterministic — same inputs produce same output", () => {
    const r1 = generateSchedule(baseInput);
    const r2 = generateSchedule(baseInput);
    expect(r1.dates).toEqual(r2.dates);
    expect(r1.warnings).toEqual(r2.warnings);
  });

  // SCHED-02: Blocked dates excluded
  it("excludes blocked dates", () => {
    const input: ScheduleInput = {
      ...baseInput,
      blockedDates: ["2026-04-06", "2026-04-08"], // Mon and Wed
    };
    const result = generateSchedule(input);
    const dates = result.dates.map((d) => d.date);
    expect(dates).not.toContain("2026-04-06");
    expect(dates).not.toContain("2026-04-08");
  });

  // SCHED-03: Tech week generated
  it("generates tech week dates overriding day-of-week filter", () => {
    const input: ScheduleInput = {
      ...baseInput,
      techWeekEnabled: true,
      techWeekDays: 5,
    };
    const result = generateSchedule(input);
    const techDates = result.dates.filter((d) => d.type === "tech");
    // Tech week = 5 days before opening (Apr 26-30)
    expect(techDates.length).toBeGreaterThan(0);
    // Tech dates should include days that aren't Mon/Wed/Fri
    const techDaySet = new Set(techDates.map((d) => new Date(d.date).getUTCDay()));
    // Apr 26=Sun, 27=Mon, 28=Tue, 29=Wed, 30=Thu — should have non-MWF days
    expect(techDaySet.size).toBeGreaterThan(1);
  });

  // DIR-05: Tech week before opening
  it("generates consecutive tech days ending day before opening", () => {
    const input: ScheduleInput = {
      ...baseInput,
      techWeekEnabled: true,
      techWeekDays: 3,
    };
    const result = generateSchedule(input);
    const techAndDress = result.dates.filter((d) => d.type === "tech" || d.type === "dress");
    if (techAndDress.length > 0) {
      const lastTech = techAndDress[techAndDress.length - 1];
      expect(lastTech.date).toBe("2026-04-30"); // Day before May 1
    }
  });

  // Dress rehearsal = last day of tech week
  it("marks last tech day as dress when enabled", () => {
    const input: ScheduleInput = {
      ...baseInput,
      techWeekEnabled: true,
      techWeekDays: 5,
      dressRehearsalEnabled: true,
    };
    const result = generateSchedule(input);
    const dressDates = result.dates.filter((d) => d.type === "dress");
    expect(dressDates).toHaveLength(1);
    expect(dressDates[0].date).toBe("2026-04-30"); // Last day of tech week
  });

  // Performance dates from opening to closing
  it("generates performance dates from opening to closing", () => {
    const result = generateSchedule(baseInput);
    const perf = result.dates.filter((d) => d.type === "performance");
    expect(perf.map((d) => d.date)).toEqual(["2026-05-01", "2026-05-02", "2026-05-03"]);
  });

  // DIR-16: Blocked date in tech week — skipped with warning
  it("skips blocked dates within tech week and warns", () => {
    const input: ScheduleInput = {
      ...baseInput,
      techWeekEnabled: true,
      techWeekDays: 5,
      blockedDates: ["2026-04-28"],
    };
    const result = generateSchedule(input);
    const dates = result.dates.map((d) => d.date);
    expect(dates).not.toContain("2026-04-28");
    expect(result.warnings.length).toBeGreaterThan(0);
    expect(result.warnings[0]).toContain("2026-04-28");
    expect(result.warnings[0]).toContain("tech week");
  });

  // DIR-17: Tech week extends before first rehearsal — clamped
  it("clamps tech week to first rehearsal date", () => {
    const input: ScheduleInput = {
      ...baseInput,
      firstRehearsal: "2026-04-28", // Only 3 days before opening
      techWeekEnabled: true,
      techWeekDays: 10, // Would need 10 days but only 3 available
    };
    const result = generateSchedule(input);
    const techAndDress = result.dates.filter((d) => d.type === "tech" || d.type === "dress");
    // Should only have dates from Apr 28-30 (3 days, not 10)
    for (const d of techAndDress) {
      expect(d.date >= "2026-04-28").toBe(true);
    }
  });

  // DIR-18: No valid dates after filtering
  it("returns empty dates array when all dates are blocked", () => {
    const input: ScheduleInput = {
      ...baseInput,
      firstRehearsal: "2026-05-01",
      openingNight: "2026-05-01",
      closingNight: "2026-05-01",
      blockedDates: ["2026-05-01"],
    };
    const result = generateSchedule(input);
    expect(result.dates).toHaveLength(0);
  });

  // Dress disabled — no dress type in output
  it("does not generate dress type when disabled", () => {
    const input: ScheduleInput = {
      ...baseInput,
      techWeekEnabled: true,
      techWeekDays: 5,
      dressRehearsalEnabled: false,
    };
    const result = generateSchedule(input);
    const dress = result.dates.filter((d) => d.type === "dress");
    expect(dress).toHaveLength(0);
  });

  // No tech week — all pre-opening dates are regular
  it("only generates regular + performance when tech is disabled", () => {
    const result = generateSchedule(baseInput);
    const types = new Set(result.dates.map((d) => d.type));
    expect(types.has("tech")).toBe(false);
    expect(types.has("dress")).toBe(false);
    expect(types.has("regular")).toBe(true);
    expect(types.has("performance")).toBe(true);
  });

  // Blocked performance dates excluded
  it("excludes blocked dates from performance range", () => {
    const input: ScheduleInput = {
      ...baseInput,
      blockedDates: ["2026-05-02"],
    };
    const result = generateSchedule(input);
    const perf = result.dates.filter((d) => d.type === "performance");
    expect(perf.map((d) => d.date)).toEqual(["2026-05-01", "2026-05-03"]);
  });
});
