import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { callLabel, localISO } from '@/hooks/useCalls';
import { describeDoubleBooking } from '@/utils/doubleBooking';
import { formatBytes } from '@/services/documents';
import { feedUrl, webcalUrl } from '@/services/calendar';
import { MoreSheet } from '@/components/layout/MoreSheet';
import { Pill, Panel } from '@/components/ui/page';

describe('call helpers', () => {
  it('formats a call as a short readable label', () => {
    const label = callLabel({ date: '2026-10-22', start_time: '18:30', type: 'tech' });
    expect(label).toContain('6:30 PM');
    expect(label).toContain('Tech');
  });

  it('builds a local ISO date without shifting the day', () => {
    expect(localISO(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05');
  });
});

describe('double-booking sentences', () => {
  const items = [
    { id: 'a', type: 'regular', start_time: '18:00', end_time: '20:00', location: 'Studio A' },
    { id: 'b', type: 'regular', start_time: '19:00', end_time: '21:00', location: 'Studio A' },
  ];

  it('names the room that is booked twice', () => {
    const text = describeDoubleBooking({ kind: 'room', date: '2026-10-22', location: 'Studio A', items, people: [] });
    expect(text).toContain('Studio A is booked twice');
    expect(text).toContain('6:00 PM–8:00 PM');
  });

  it('names the people who are called twice', () => {
    const text = describeDoubleBooking({
      kind: 'person', date: '2026-10-22', location: null, items,
      people: [{ user_id: '1', name: 'Aiden Walker' }, { user_id: '2', name: 'Bianca Reyes' }],
    });
    expect(text).toContain('Aiden Walker, Bianca Reyes are called to overlapping calls');
  });

  it('uses the singular for one person', () => {
    const text = describeDoubleBooking({ kind: 'person', date: '2026-10-22', location: null, items, people: [{ user_id: '1', name: 'Aiden Walker' }] });
    expect(text).toContain('Aiden Walker is called');
  });

  it('explains a sign-up that clashes with a call', () => {
    const text = describeDoubleBooking({
      kind: 'signup', date: '2026-10-22', location: null, items: [items[0]],
      people: [{ user_id: '1', name: 'Aiden Walker' }],
      slot: { id: 's', title: 'Strike crew', start_time: '19:00', end_time: '20:00' },
    });
    expect(text).toContain('signed up for “Strike crew”');
  });
});

describe('document and calendar helpers', () => {
  it('shows file sizes in plain units', () => {
    expect(formatBytes(512)).toBe('512 B');
    expect(formatBytes(2048)).toBe('2 KB');
    expect(formatBytes(5 * 1024 * 1024)).toBe('5.0 MB');
  });

  it('makes both an https feed link and a webcal link', () => {
    const link = { token: 'abc', path: '/api/calendar/abc.ics' };
    expect(feedUrl(link)).toBe(`${window.location.origin}/api/calendar/abc.ics`);
    expect(webcalUrl(link).startsWith('webcal://')).toBe(true);
    expect(webcalUrl(link).endsWith('/api/calendar/abc.ics')).toBe(true);
  });
});

describe('MoreSheet', () => {
  const items = [
    { label: 'Dashboard', path: '/p', tourId: 't1', icon: '◈' },
    { label: 'Scenes', path: '/p/scenes', tourId: 't2', icon: '◐' },
    { label: 'Documents', path: '/p/documents', tourId: 't3', icon: '▣' },
  ];
  const navigate = vi.fn();
  const close = vi.fn();

  beforeEach(() => { navigate.mockReset(); close.mockReset(); });

  it('lists every page and navigates when one is tapped', async () => {
    render(<MemoryRouter><MoreSheet open onClose={close} items={items} isActive={p => p === '/p'} onNavigate={navigate} /></MemoryRouter>);
    expect(screen.getByRole('dialog', { name: /all pages/i })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /Scenes/ }));
    expect(close).toHaveBeenCalled();
    expect(navigate).toHaveBeenCalledWith('/p/scenes');
  });

  it('marks the current page', () => {
    render(<MemoryRouter><MoreSheet open onClose={close} items={items} isActive={p => p === '/p/documents'} onNavigate={navigate} /></MemoryRouter>);
    expect(screen.getByRole('button', { name: /Documents/ })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('button', { name: /Dashboard/ })).not.toHaveAttribute('aria-current');
  });

  it('renders nothing while closed', async () => {
    render(<MemoryRouter><MoreSheet open={false} onClose={close} items={items} isActive={() => false} onNavigate={navigate} /></MemoryRouter>);
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('runs extra actions such as sign out', async () => {
    const signOut = vi.fn();
    render(<MemoryRouter><MoreSheet open onClose={close} items={items} isActive={() => false} onNavigate={navigate} extra={[{ label: 'Sign out', onClick: signOut }]} /></MemoryRouter>);
    await userEvent.click(screen.getByRole('button', { name: 'Sign out' }));
    expect(signOut).toHaveBeenCalled();
  });
});

describe('page building blocks', () => {
  it('shows a pill and a titled panel', () => {
    render(<Panel title="Who is called"><Pill tone="good">Present</Pill></Panel>);
    expect(screen.getByText('Who is called')).toBeInTheDocument();
    expect(screen.getByText('Present')).toBeInTheDocument();
  });
});
