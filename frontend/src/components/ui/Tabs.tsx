import { useState, type ReactNode } from 'react';

interface Tab {
  id: string;
  label: string;
  content: ReactNode;
}

interface TabsProps {
  tabs: Tab[];
  defaultTab?: string;
}

export function Tabs({ tabs, defaultTab }: TabsProps) {
  const [active, setActive] = useState(defaultTab || tabs[0]?.id);

  return (
    <div>
      <div className="flex border-b border-border" role="tablist">
        {tabs.map(tab => (
          <button
            key={tab.id}
            role="tab"
            aria-selected={active === tab.id}
            onClick={() => setActive(tab.id)}
            className={`
              px-4 py-2.5 text-sm font-medium transition-colors
              ${active === tab.id
                ? 'text-accent border-b-2 border-accent'
                : 'text-muted hover:text-foreground'}
            `}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div className="pt-4" role="tabpanel">
        {tabs.find(t => t.id === active)?.content}
      </div>
    </div>
  );
}
