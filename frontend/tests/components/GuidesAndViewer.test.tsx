import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { GUIDES, PERMISSIONS, GLOSSARY, guideFor, type GuideId } from '@/content/guides';
import { Markdown } from '@/components/ui/Markdown';
import { parseCsv } from '@/utils/csv';
import { viewKind } from '@/services/documents';
import { directorTourSteps, staffTourSteps, castTourSteps } from '@/tours/productionTour';
import * as pageTours from '@/tours/pageTours';

describe('page guides', () => {
  const ids = Object.keys(GUIDES) as GuideId[];

  it('give every page text for the people who can open it', () => {
    for (const id of ids) {
      expect(Object.keys(GUIDES[id]).length, id).toBeGreaterThan(0);
      for (const guide of Object.values(GUIDES[id])) {
        expect(guide!.what.length, `${id} summary`).toBeGreaterThan(20);
        expect(guide!.can.length, `${id} can`).toBeGreaterThan(0);
      }
    }
  });

  it('tell cast what they cannot do on pages where staff can do more', () => {
    for (const id of ['schedule', 'callsheet', 'scenes', 'reports', 'bulletin', 'signups', 'files'] as GuideId[]) {
      expect(GUIDES[id].cast?.cannot?.length, id).toBeGreaterThan(0);
    }
  });

  it('pick the right text for each role', () => {
    expect(guideFor('settings', 'director')?.can[0]).toMatch(/conflicts/i);
    expect(guideFor('settings', 'staff')?.cannot?.[0]).toMatch(/only the director/i);
    expect(guideFor('members', 'cast')?.cannot?.length).toBeGreaterThan(0);
    expect(guideFor('members', null)).not.toBeNull();
  });

  it('keep the permission table and glossary filled in', () => {
    expect(PERMISSIONS.length).toBeGreaterThan(15);
    const invite = PERMISSIONS.find(p => p.what.includes('Invite'))!;
    expect(invite).toMatchObject({ director: true, staff: false, cast: false });
    expect(GLOSSARY.map(g => g.term)).toContain('Call sheet');
  });
});

describe('Markdown viewer', () => {
  it('renders headings, lists and emphasis', () => {
    render(<Markdown source={'# Cast handbook\n\n- Arrive **early**\n- Bring a pencil\n\nSee *notes*.'} />);
    expect(screen.getByRole('heading', { name: 'Cast handbook' })).toBeInTheDocument();
    expect(screen.getByText('early').tagName).toBe('STRONG');
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
    expect(screen.getByText('notes').tagName).toBe('EM');
  });

  it('never turns text into live HTML or script links', () => {
    const { container } = render(<Markdown source={'<script>alert(1)</script>\n\n[bad](javascript:alert(1)) and [ok](https://example.com)'} />);
    expect(container.querySelector('script')).toBeNull();
    const links = [...container.querySelectorAll('a')];
    expect(links.map(a => a.getAttribute('href'))).toEqual(['https://example.com']);
    expect(container.textContent).toContain('<script>alert(1)</script>');
  });

  it('keeps code blocks as text', () => {
    const { container } = render(<Markdown source={'```\n<b>not bold</b>\n```'} />);
    expect(container.querySelector('pre')?.textContent).toBe('<b>not bold</b>');
    expect(container.querySelector('b')).toBeNull();
  });
});

describe('CSV and file kinds', () => {
  it('reads quoted commas, quotes and blank trailing lines', () => {
    expect(parseCsv('name,role\n"Walker, Aiden",Phantom\n"She said ""hi""",Raoul\n\n')).toEqual([
      ['name', 'role'],
      ['Walker, Aiden', 'Phantom'],
      ['She said "hi"', 'Raoul'],
    ]);
  });

  it('decides how each file can be shown', () => {
    expect(viewKind('Script.PDF')).toBe('pdf');
    expect(viewKind('notes.md')).toBe('markdown');
    expect(viewKind('handbook.docx')).toBe('docx');
    expect(viewKind('budget.xlsx')).toBe('xlsx');
    expect(viewKind('old.doc')).toBe('none');
    expect(viewKind('deck.pptx')).toBe('none');
    expect(viewKind('track.mp3')).toBe('audio');
  });
});

describe('tours', () => {
  const targets = (steps: { target: unknown }[]) => steps.map(s => String(s.target));

  it('cover the new pages in every production tour', () => {
    for (const steps of [directorTourSteps, staffTourSteps, castTourSteps]) {
      const t = targets(steps);
      expect(t).toContain('[data-tour="nav-callsheet"]');
      expect(t).toContain('[data-tour="nav-signups"]');
      expect(t).toContain('[data-tour="nav-documents"]');
      expect(t).toContain('[data-tour="nav-help"]');
    }
    expect(targets(directorTourSteps)).toContain('[data-tour="nav-reports"]');
    expect(targets(castTourSteps)).not.toContain('[data-tour="nav-reports"]');
  });

  it('give every step a title and plain text', () => {
    const all = Object.values(pageTours).flat() as { title?: string; content?: string }[];
    expect(all.length).toBeGreaterThan(40);
    for (const step of all) {
      expect(step.title?.length).toBeGreaterThan(2);
      expect(String(step.content).length).toBeGreaterThan(20);
      expect(String(step.content)).not.toMatch(/sticky note|chalkboard|curtain/i);
    }
  });
});
