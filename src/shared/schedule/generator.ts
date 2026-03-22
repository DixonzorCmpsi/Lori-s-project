import { addDays, eachDayOfInterval, max as dateMax } from "date-fns";

/** Parse YYYY-MM-DD as a local date (not UTC) to avoid timezone offset bugs */
function parseLocalDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function formatDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export type RehearsalType = "regular" | "tech" | "dress" | "performance";

export type GeneratedDate = {
  date: string; // YYYY-MM-DD
  startTime: string; // HH:MM
  endTime: string; // HH:MM
  type: RehearsalType;
};

export type ScheduleInput = {
  firstRehearsal: string; // YYYY-MM-DD
  openingNight: string;
  closingNight: string;
  selectedDays: number[]; // 0=Sun, 1=Mon, ... 6=Sat
  startTime: string; // HH:MM
  endTime: string; // HH:MM
  blockedDates: string[]; // YYYY-MM-DD[]
  techWeekEnabled: boolean;
  techWeekDays: number;
  dressRehearsalEnabled: boolean;
};

export type ScheduleResult = {
  dates: GeneratedDate[];
  warnings: string[];
};

/**
 * Deterministic schedule generation. Same inputs = same output.
 * Implements SPEC-006 Section 2.2 algorithm exactly.
 */
export function generateSchedule(input: ScheduleInput): ScheduleResult {
  const {
    firstRehearsal,
    openingNight,
    closingNight,
    selectedDays,
    startTime,
    endTime,
    blockedDates,
    techWeekEnabled,
    techWeekDays,
    dressRehearsalEnabled,
  } = input;

  const blockedSet = new Set(blockedDates);
  const warnings: string[] = [];
  const dateMap = new Map<string, GeneratedDate>();

  const firstDate = parseLocalDate(firstRehearsal);
  const openDate = parseLocalDate(openingNight);
  const closeDate = parseLocalDate(closingNight);
  const dayBeforeOpening = addDays(openDate, -1);

  // Step 1: Regular rehearsal dates (firstRehearsal to day before openingNight)
  if (firstDate <= dayBeforeOpening) {
    const regularRange = eachDayOfInterval({ start: firstDate, end: dayBeforeOpening });
    for (const d of regularRange) {
      const dateStr = formatDate(d);
      const dayOfWeek = d.getDay();
      if (selectedDays.includes(dayOfWeek) && !blockedSet.has(dateStr)) {
        dateMap.set(dateStr, { date: dateStr, startTime, endTime, type: "regular" });
      }
    }
  }

  // Step 2: Tech week (overrides day-of-week filter)
  if (techWeekEnabled && techWeekDays > 0) {
    const techStartRaw = addDays(openDate, -techWeekDays);
    const techStart = dateMax([firstDate, techStartRaw]);
    const techEnd = dayBeforeOpening;

    if (techStart <= techEnd) {
      const techRange = eachDayOfInterval({ start: techStart, end: techEnd });
      for (const d of techRange) {
        const dateStr = formatDate(d);
        if (blockedSet.has(dateStr)) {
          warnings.push(`Blocked date ${dateStr} falls within tech week and will be skipped`);
          continue;
        }
        dateMap.set(dateStr, { date: dateStr, startTime, endTime, type: "tech" });
      }
    }
  }

  // Step 3: Dress rehearsal (last day of tech week becomes dress)
  if (dressRehearsalEnabled && techWeekEnabled) {
    const techDates = Array.from(dateMap.values())
      .filter((d) => d.type === "tech")
      .sort((a, b) => a.date.localeCompare(b.date));
    if (techDates.length > 0) {
      const lastTech = techDates[techDates.length - 1];
      dateMap.set(lastTech.date, { ...lastTech, type: "dress" });
    }
  }

  // Step 4: Performance dates (openingNight to closingNight)
  const perfRange = eachDayOfInterval({ start: openDate, end: closeDate });
  for (const d of perfRange) {
    const dateStr = formatDate(d);
    if (!blockedSet.has(dateStr)) {
      dateMap.set(dateStr, { date: dateStr, startTime, endTime, type: "performance" });
    }
  }

  // Step 5: Sort by date ascending
  const dates = Array.from(dateMap.values()).sort((a, b) => a.date.localeCompare(b.date));

  return { dates, warnings };
}
