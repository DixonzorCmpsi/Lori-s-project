import { useNavigate, useParams } from 'react-router-dom';
import { usePageTitle } from '@/hooks/usePageTitle';
import { useProduction } from '@/components/theater/BackstageLayout';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';
import { PageHeader, Panel, Pill } from '@/components/ui/page';
import { resetGuides } from '@/components/PageGuide';
import { resetAllTours } from '@/hooks/useTour';
import { GLOSSARY, PERMISSIONS } from '@/content/guides';

const ROLE_TEXT: Record<string, { title: string; body: string }> = {
  director: {
    title: 'You are the Director',
    body: 'You can do everything in this production: run the schedule, invite and manage people, post announcements, send reports, share files and forms, and change settings. Staff can help with most of the day-to-day work, but only you can manage people and change settings.',
  },
  staff: {
    title: 'You are Staff (stage manager or assistant)',
    body: 'You run rehearsals day to day: the schedule, call sheet, reports, announcements, scenes, sign-ups, documents and forms. You can’t invite, promote, remove or block people, and you can’t change production settings. Those belong to the director.',
  },
  cast: {
    title: 'You are Cast',
    body: 'You see your calls, check in, tell the stage manager if you will be late, confirm announcements, sign forms, sign up for crew slots and read shared files. You can’t change the schedule or anything for the rest of the company.',
  },
};

const PAGES: { name: string; path: string; staffOnly?: boolean; text: string }[] = [
  { name: 'Dashboard', path: '', text: 'Your home screen: your next call and everything waiting on you.' },
  { name: 'Schedule', path: '/schedule', text: 'The rehearsal calendar. Staff edit it; everyone can add their calls to their own calendar.' },
  { name: 'Call Sheet', path: '/call-sheet', text: 'Who is called and who has arrived for one rehearsal. Cast check in here and say if they will be late.' },
  { name: 'Scenes', path: '/scenes', staffOnly: true, text: 'Break the show into scenes, cast them, and see who is free on a given day.' },
  { name: 'Reports', path: '/reports', staffOnly: true, text: 'End-of-day rehearsal reports by department, sent to a list of people.' },
  { name: 'Bulletin', path: '/bulletin', text: 'Announcements for everyone, like the callboard backstage.' },
  { name: 'Chat', path: '/chat', text: 'Private messages inside the production.' },
  { name: 'Members', path: '/roster', text: 'Everyone in the production, and (for the director) tools to manage them.' },
  { name: 'Sign-ups', path: '/signups', text: 'Open calls for volunteer jobs such as strike or box office.' },
  { name: 'Documents', path: '/documents', text: 'Shared files (view them in a pop-up) and forms to sign.' },
  { name: 'Settings', path: '/settings', staffOnly: true, text: 'Production details and rules. Director only.' },
];

function Mark({ value }: { value: boolean | 'own' }) {
  return value ? <Pill tone="good">Yes</Pill> : <span style={{ color: 'var(--t-subtle-text)' }}>No</span>;
}

export function HelpPage() {
  usePageTitle('How it works');
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { userRole } = useProduction();
  const role = userRole ?? 'cast';
  const isStaff = role === 'director' || role === 'staff';
  const text = ROLE_TEXT[role] ?? ROLE_TEXT.cast;

  return (
    <div>
      <PageHeader title="How the Call Board works" subtitle="A plain-English guide to every page, and who can do what." />

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2 grid gap-4 content-start">
          <Panel title="Your role">
            <p className="text-base font-semibold" style={{ color: 'var(--t-subtle-text-bright)' }}>{text.title}</p>
            <p className="mt-1 text-sm" style={{ color: 'var(--t-subtle-text-bright)' }}>{text.body}</p>
          </Panel>

          <Panel title="Where everything is">
            <ul className="divide-y" style={{ borderColor: 'var(--t-section-border)' }}>
              {PAGES.filter(p => isStaff || !p.staffOnly).map(p => (
                <li key={p.name} className="py-2.5 flex flex-wrap items-center justify-between gap-2" style={{ borderColor: 'var(--t-section-border)' }}>
                  <div className="min-w-[220px] flex-1">
                    <p className="text-sm font-semibold" style={{ color: 'var(--t-subtle-text-bright)' }}>{p.name}</p>
                    <p className="text-sm" style={{ color: 'var(--t-subtle-text)' }}>{p.text}</p>
                  </div>
                  <Button size="sm" variant="secondary" onClick={() => navigate(`/production/${id}${p.path}`)}>Open</Button>
                </li>
              ))}
            </ul>
          </Panel>

          <Panel title="Who can do what">
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[520px]">
                <thead>
                  <tr className="text-left text-[11px] uppercase tracking-wider" style={{ color: 'var(--t-subtle-text)' }}>
                    <th className="py-2 pr-3 font-semibold">Where</th>
                    <th className="py-2 pr-3 font-semibold">What</th>
                    <th className="py-2 px-2 font-semibold text-center">Director</th>
                    <th className="py-2 px-2 font-semibold text-center">Staff</th>
                    <th className="py-2 px-2 font-semibold text-center">Cast</th>
                  </tr>
                </thead>
                <tbody>
                  {PERMISSIONS.map(row => (
                    <tr key={`${row.area}-${row.what}`} style={{ borderTop: '1px solid var(--t-section-border)', color: 'var(--t-subtle-text-bright)' }}>
                      <td className="py-2 pr-3 font-medium whitespace-nowrap">{row.area}</td>
                      <td className="py-2 pr-3">{row.what}</td>
                      <td className="py-2 px-2 text-center"><Mark value={row.director} /></td>
                      <td className="py-2 px-2 text-center"><Mark value={row.staff} /></td>
                      <td className="py-2 px-2 text-center"><Mark value={row.cast} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>
        </div>

        <div className="grid gap-4 content-start">
          <Panel title="Need a hand?">
            <div className="grid gap-2">
              <Button size="sm" onClick={() => { resetGuides(); toast('Page guides are showing again'); }}>Show the page guides again</Button>
              <Button size="sm" variant="secondary" onClick={() => { resetAllTours(); resetGuides(); window.location.assign(`/production/${id}`); }}>Replay the guided tours</Button>
            </div>
            <p className="mt-3 text-xs" style={{ color: 'var(--t-subtle-text)' }}>Each page also has a “How this page works” box at the top, written for your role.</p>
          </Panel>

          <Panel title="Words you will see">
            <dl className="space-y-2.5">
              {GLOSSARY.map(g => (
                <div key={g.term}>
                  <dt className="text-sm font-semibold" style={{ color: 'var(--t-subtle-text-bright)' }}>{g.term}</dt>
                  <dd className="text-sm" style={{ color: 'var(--t-subtle-text)' }}>{g.meaning}</dd>
                </div>
              ))}
            </dl>
          </Panel>
        </div>
      </div>
    </div>
  );
}
