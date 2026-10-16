import type { ReactNode } from 'react';
import { ChalkText } from '@/components/theater/Chalkboard';

/** Title row shared by every page: heading on the left, actions on the right. */
export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3 mb-5">
      <div className="min-w-0">
        <ChalkText size="lg">{title}</ChalkText>
        {subtitle && (
          <p className="mt-1 text-sm" style={{ color: 'var(--t-subtle-text)' }}>{subtitle}</p>
        )}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

/** A titled card. Styled by the active theme (a plain card in Default, a chalk panel in Fancy). */
export function Panel({ title, action, children, className = '' }: {
  title?: string; action?: ReactNode; children: ReactNode; className?: string;
}) {
  return (
    <section
      className={`rounded-sm p-5 ${className}`}
      style={{ background: 'var(--t-subtle-bg)', border: '1px solid var(--t-section-border)' }}
    >
      {(title || action) && (
        <div className="flex items-center justify-between gap-3 mb-3">
          {title && (
            <h2 className="text-[11px] uppercase tracking-widest font-bold" style={{ color: 'var(--t-subtle-text)' }}>{title}</h2>
          )}
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

type Tone = 'neutral' | 'good' | 'warn' | 'bad' | 'accent';

const tones: Record<Tone, { bg: string; fg: string }> = {
  neutral: { bg: 'var(--t-subtle-bg)', fg: 'var(--t-subtle-text-bright)' },
  good: { bg: 'rgb(var(--c-100-200-100) / 0.14)', fg: 'rgb(var(--c-150-220-150) / 0.95)' },
  warn: { bg: 'rgb(var(--c-251-191-36) / 0.16)', fg: 'rgb(var(--c-251-191-36))' },
  bad: { bg: 'rgb(var(--c-255-80-80) / 0.14)', fg: 'rgb(var(--c-255-150-150) / 0.95)' },
  accent: { bg: 'var(--t-tab-active-bg)', fg: 'var(--t-tab-active-text)' },
};

/** Small status chip. */
export function Pill({ tone = 'neutral', children, title }: { tone?: Tone; children: ReactNode; title?: string }) {
  const t = tones[tone];
  return (
    <span
      title={title}
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold whitespace-nowrap"
      style={{ background: t.bg, color: t.fg }}
    >
      {children}
    </span>
  );
}

/** A friendly empty state inside a page. */
export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="text-center py-12">
      <ChalkText size="md">{title}</ChalkText>
      {children && <div className="mt-2 text-xs" style={{ color: 'var(--t-subtle-text)' }}>{children}</div>}
    </div>
  );
}

/** A compact secondary button used in dense lists. */
export function MiniButton({ children, onClick, tone = 'neutral', disabled, active, title }: {
  children: ReactNode; onClick?: () => void; tone?: Tone; disabled?: boolean; active?: boolean; title?: string;
}) {
  const t = tones[tone];
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      disabled={disabled}
      aria-pressed={active}
      className="px-2.5 py-1 rounded-md text-xs font-medium cursor-pointer disabled:opacity-40 disabled:cursor-default"
      style={{
        background: active ? t.bg : 'transparent',
        color: active ? t.fg : 'var(--t-subtle-text)',
        border: `1px solid ${active ? 'transparent' : 'var(--t-section-border)'}`,
      }}
    >
      {children}
    </button>
  );
}

/** A labelled number, e.g. "12 present". */
export function Stat({ label, value, tone = 'neutral' }: { label: string; value: number | string; tone?: Tone }) {
  const t = tones[tone];
  return (
    <div className="rounded-md px-3 py-2 min-w-[88px]" style={{ background: t.bg }}>
      <p className="text-lg font-semibold leading-tight" style={{ color: t.fg }}>{value}</p>
      <p className="text-[11px]" style={{ color: 'var(--t-subtle-text)' }}>{label}</p>
    </div>
  );
}
