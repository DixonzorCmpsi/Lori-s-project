import { useMemo } from 'react';
import type { Production, RehearsalDate } from '@/types';

const DAY = 86_400_000;

function parse(d: string): number {
  const [y, m, day] = d.split('-').map(Number);
  return new Date(y, m - 1, day).getTime();
}

function fmt(ms: number): string {
  return new Date(ms).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

interface Phase {
  key: string;
  name: string;
  start: number;
  end: number;
  color: string;
}

const COLORS = { rehearsal: '#2563eb', tech: '#6d28d9', dress: '#be185d', show: '#b91c1c' };

/** Builds the phases from the production dates and the types of the scheduled calls. */
function buildPhases(production: Production, dates: RehearsalDate[]): Phase[] {
  const first = parse(production.first_rehearsal);
  const opening = parse(production.opening_night);
  const closing = Math.max(parse(production.closing_night), opening);
  const live = dates.filter(d => !d.is_deleted && !d.is_cancelled);
  const range = (type: RehearsalDate['type']) => {
    const times = live.filter(d => d.type === type).map(d => parse(d.date)).filter(t => t < opening);
    return times.length ? { start: Math.min(...times), end: Math.max(...times) } : null;
  };
  const tech = range('tech');
  const dress = range('dress');
  const phases: Phase[] = [];
  const rehearsalEnd = Math.min(tech?.start ?? opening, dress?.start ?? opening) - DAY;
  if (rehearsalEnd >= first) phases.push({ key: 'rehearsal', name: 'Rehearsals', start: first, end: rehearsalEnd, color: COLORS.rehearsal });
  if (tech) phases.push({ key: 'tech', name: 'Tech', ...tech, color: COLORS.tech });
  if (dress) phases.push({ key: 'dress', name: 'Dress', ...dress, color: COLORS.dress });
  phases.push({ key: 'show', name: 'Performances', start: opening, end: closing, color: COLORS.show });
  return phases;
}

function headline(production: Production, now: number): { big: string; small: string } {
  const first = parse(production.first_rehearsal);
  const opening = parse(production.opening_night);
  const closing = parse(production.closing_night);
  const toOpen = Math.round((opening - now) / DAY);
  const small = `First rehearsal ${fmt(first)} · Opens ${fmt(opening)} · Closes ${fmt(closing)}`;
  if (now > closing) return { big: 'This production has closed', small };
  if (toOpen > 1) return { big: `${toOpen} days to opening night`, small };
  if (toOpen === 1) return { big: 'Opening night is tomorrow', small };
  if (toOpen === 0) return { big: 'Opening night is tonight', small };
  const left = Math.round((closing - now) / DAY);
  return { big: left === 0 ? 'Final performance today' : `Now playing · closes in ${left} day${left === 1 ? '' : 's'}`, small };
}

/**
 * "Road to opening" bar for the Calendar style. Shows rehearsal, tech, dress and
 * performance phases drawn from the production dates and the schedule, with a
 * "you are here" marker.
 */
export function PhaseBar({ production, dates }: { production: Production | null | undefined; dates: RehearsalDate[] | null | undefined }) {
  const model = useMemo(() => {
    if (!production?.first_rehearsal || !production.opening_night || !production.closing_night) return null;
    const phases = buildPhases(production, Array.isArray(dates) ? dates : []);
    const now = parse(new Date().toLocaleDateString('en-CA'));
    // Bar widths are not strictly to scale: very long or very short phases are
    // clamped so every phase stays readable. The marker uses the same widths.
    const weights = phases.map(p => Math.min(40, Math.max(10, Math.round((p.end - p.start) / DAY) + 1)));
    const total = weights.reduce((a, b) => a + b, 0);
    let pct = 0;
    if (now >= phases[0].start) {
      let acc = 0;
      pct = 100;
      for (let i = 0; i < phases.length; i++) {
        const p = phases[i];
        const span = p.end + DAY - p.start;
        if (now < p.end + DAY) {
          pct = ((acc + weights[i] * Math.min(1, Math.max(0, (now - p.start) / span))) / total) * 100;
          break;
        }
        acc += weights[i];
      }
    }
    const weeks = Math.floor((now - parse(production.first_rehearsal)) / (7 * DAY)) + 1;
    return { phases, weights, now, pct, weeks, head: headline(production, now) };
  }, [production, dates]);

  if (!model) return null;
  const { phases, weights, now, pct, weeks, head } = model;
  const lastEnd = phases[phases.length - 1].end;
  const daysToStart = Math.round((phases[0].start - now) / DAY);
  const marker = now < phases[0].start
    ? `TODAY · REHEARSALS START IN ${daysToStart} DAY${daysToStart === 1 ? '' : 'S'}`
    : now > lastEnd ? 'CLOSED' : weeks >= 1 ? `TODAY · WEEK ${weeks}` : 'TODAY';

  return (
    <div
      data-tour="phase-bar"
      aria-label="Road to opening"
      className="cal-phasebar mb-5 flex flex-col gap-3"
    >
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="text-[11px] tracking-[0.12em] uppercase" style={{ color: 'var(--t-muted)', fontFamily: 'var(--font-mono)' }}>The road to opening</p>
          <h2 className="text-2xl sm:text-[28px] font-extrabold tracking-tight leading-tight" style={{ color: 'var(--t-foreground)' }}>{head.big}</h2>
        </div>
        <p className="text-xs" style={{ color: 'var(--t-muted)', fontFamily: 'var(--font-mono)' }}>{head.small}</p>
      </div>
      <div className="relative pt-9">
        <span
          className="absolute top-0 text-[11px] px-2 py-0.5 rounded whitespace-nowrap pointer-events-none"
          style={{ left: `min(max(0px, calc(${pct}% - 60px)), calc(100% - 300px))`, background: 'var(--t-foreground)', color: 'var(--t-background)', fontFamily: 'var(--font-mono)' }}
        >{marker}</span>
        <span className="absolute top-[22px] w-0.5 h-[14px] pointer-events-none" style={{ left: `${pct}%`, background: 'var(--t-foreground)' }} />
        <div className="flex gap-1 h-14">
          {phases.map((p, i) => {
            const done = p.end < now;
            return (
              <div
                key={p.key}
                className="min-w-0 rounded-md px-2.5 py-1.5 flex flex-col justify-center text-white"
                style={{ flex: `${weights[i]} 1 0`, background: p.color, opacity: done ? 0.55 : 1 }}
                title={`${p.name}: ${fmt(p.start)} to ${fmt(p.end)}`}
              >
                <span className="text-sm font-bold leading-tight truncate">{p.name}</span>
                <span className="hidden sm:block text-[11px] opacity-90 truncate" style={{ fontFamily: 'var(--font-mono)' }}>{fmt(p.start)}{p.end > p.start ? `–${fmt(p.end)}` : ''}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
