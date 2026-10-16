import type { ReactNode } from 'react';

/**
 * A small, safe Markdown renderer. It builds React elements (never raw HTML), so script
 * and markup in a file cannot run. Supports headings, bold, italic, inline code, code
 * blocks, lists, quotes, rules and http(s)/mailto links, which covers handbooks and notes.
 */

function safeHref(href: string): string | null {
  return /^(https?:|mailto:)/i.test(href.trim()) ? href.trim() : null;
}

function inline(text: string, keyPrefix: string): ReactNode[] {
  const out: ReactNode[] = [];
  const pattern = /(`[^`]+`)|(\*\*[^*]+\*\*)|(__[^_]+__)|(\*[^*\s][^*]*\*)|(_[^_\s][^_]*_)|(\[[^\]]+\]\([^)]+\))/g;
  let last = 0;
  let match: RegExpExecArray | null;
  let i = 0;
  while ((match = pattern.exec(text))) {
    if (match.index > last) out.push(text.slice(last, match.index));
    const token = match[0];
    const key = `${keyPrefix}-${i++}`;
    if (token.startsWith('`')) {
      out.push(<code key={key} className="px-1 py-0.5 rounded text-[0.9em]" style={{ background: 'var(--t-subtle-bg)' }}>{token.slice(1, -1)}</code>);
    } else if (token.startsWith('**') || token.startsWith('__')) {
      out.push(<strong key={key}>{inline(token.slice(2, -2), key)}</strong>);
    } else if (token.startsWith('[')) {
      const m = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(token)!;
      const href = safeHref(m[2]);
      out.push(href
        ? <a key={key} href={href} target="_blank" rel="noopener noreferrer" className="underline text-accent">{m[1]}</a>
        : <span key={key}>{m[1]}</span>);
    } else {
      out.push(<em key={key}>{inline(token.slice(1, -1), key)}</em>);
    }
    last = match.index + token.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

export function Markdown({ source }: { source: string }) {
  const lines = source.replace(/\r\n?/g, '\n').split('\n');
  const blocks: ReactNode[] = [];
  let i = 0;
  let n = 0;
  const key = () => `b${n++}`;

  while (i < lines.length) {
    const line = lines[i];

    if (line.trim() === '') { i++; continue; }

    const fence = /^```/.exec(line);
    if (fence) {
      const code: string[] = [];
      i++;
      while (i < lines.length && !/^```/.test(lines[i])) code.push(lines[i++]);
      i++;
      blocks.push(<pre key={key()} className="overflow-x-auto rounded-lg p-3 text-sm" style={{ background: 'var(--t-subtle-bg)' }}><code>{code.join('\n')}</code></pre>);
      continue;
    }

    const heading = /^(#{1,6})\s+(.*)$/.exec(line);
    if (heading) {
      const level = heading[1].length;
      const size = ['text-2xl', 'text-xl', 'text-lg', 'text-base', 'text-sm', 'text-sm'][level - 1];
      blocks.push(<div key={key()} role="heading" aria-level={level} className={`${size} font-semibold mt-5 mb-2`}>{inline(heading[2], `h${n}`)}</div>);
      i++;
      continue;
    }

    if (/^(-{3,}|\*{3,})\s*$/.test(line)) {
      blocks.push(<hr key={key()} className="my-4" style={{ borderColor: 'var(--t-border)' }} />);
      i++;
      continue;
    }

    if (/^>\s?/.test(line)) {
      const quote: string[] = [];
      while (i < lines.length && /^>\s?/.test(lines[i])) quote.push(lines[i++].replace(/^>\s?/, ''));
      blocks.push(<blockquote key={key()} className="pl-3 my-3 italic" style={{ borderLeft: '3px solid var(--t-border)', color: 'var(--t-muted)' }}>{inline(quote.join(' '), `q${n}`)}</blockquote>);
      continue;
    }

    const bullet = /^\s*[-*+]\s+/;
    const numbered = /^\s*\d+[.)]\s+/;
    if (bullet.test(line) || numbered.test(line)) {
      const ordered = numbered.test(line);
      const items: string[] = [];
      while (i < lines.length && (ordered ? numbered : bullet).test(lines[i])) items.push(lines[i++].replace(ordered ? numbered : bullet, ''));
      const List = ordered ? 'ol' : 'ul';
      blocks.push(
        <List key={key()} className={`my-3 pl-6 space-y-1 ${ordered ? 'list-decimal' : 'list-disc'}`}>
          {items.map((item, idx) => <li key={idx}>{inline(item, `li${n}-${idx}`)}</li>)}
        </List>,
      );
      continue;
    }

    const para: string[] = [];
    while (i < lines.length && lines[i].trim() !== '' && !/^(#{1,6}\s|```|>\s?|\s*[-*+]\s+|\s*\d+[.)]\s+|-{3,}\s*$)/.test(lines[i])) para.push(lines[i++]);
    blocks.push(<p key={key()} className="my-3 leading-relaxed">{inline(para.join(' '), `p${n}`)}</p>);
  }

  return <div className="text-sm">{blocks}</div>;
}
