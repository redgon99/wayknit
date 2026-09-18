import type { ReactNode } from 'react';
import {
  cleanSourceUrl,
  isFaviconUrl,
  isHttpUrl,
  labelFromCiteAlt,
  labelFromCiteCaption,
  labelFromUrl,
} from './guideSources';

function splitTableRow(line: string): string[] {
  const trimmed = line.trim().replace(/^\|/, '').replace(/\|$/, '');
  return trimmed.split('|').map((c) => c.trim());
}

function isTableSeparator(line: string): boolean {
  const cells = splitTableRow(line);
  return cells.length > 0 && cells.every((c) => /^:?-{3,}:?$/.test(c));
}

function SourceChip({ href, label }: { href: string; label: string }) {
  return (
    <a
      className="guide-source-chip"
      href={href}
      target="_blank"
      rel="noopener noreferrer"
    >
      {label}
    </a>
  );
}

function sourceLabel(alt: string, href: string, image: boolean): string {
  if (image) return labelFromCiteAlt(alt) || labelFromUrl(href);
  const named = alt.trim();
  if (named && !/^https?:/i.test(named) && named.length <= 40) {
    return labelFromCiteAlt(named) || named;
  }
  return labelFromUrl(href);
}

/** Minimal markdown for guide bodies (headings, lists, tables, paragraphs, bold/italic, links). */
export function renderGuideMarkdown(md: string): ReactNode[] {
  const lines = md.replace(/\r\n/g, '\n').split('\n');
  const nodes: ReactNode[] = [];
  let listItems: string[] = [];
  let listOrdered = false;
  let key = 0;

  const inline = (text: string): ReactNode => {
    const parts: ReactNode[] = [];
    const re =
      /(\*\*[^*]+\*\*|\*[^*]+\*|\[!\[[^\]]*\]\([^)]+\)[^\]]*\]\([^)]+\)|!?\[[^\]]*\]\([^)]+\))/g;
    let last = 0;
    let m: RegExpExecArray | null;
    let i = 0;
    while ((m = re.exec(text)) !== null) {
      let start = m.index;
      let end = m.index + m[0].length;
      if (start > 0 && text[start - 1] === '(' && text[end] === ')') {
        start -= 1;
        end += 1;
      }
      if (start > last) parts.push(text.slice(last, start));
      const token = m[0];
      if (token.startsWith('**')) {
        parts.push(<strong key={`b-${i++}`}>{token.slice(2, -2)}</strong>);
      } else if (token.startsWith('*') && !token.startsWith('*[')) {
        parts.push(<em key={`e-${i++}`}>{token.slice(1, -1)}</em>);
      } else {
        const nested = token.match(
          /^\[!\[([^\]]*)\]\(([^)]+)\)([^\]]*)\]\(([^)]+)\)$/
        );
        if (nested) {
          const href = nested[4].trim();
          if (isHttpUrl(href)) {
            parts.push(
              <SourceChip
                key={`s-${i++}`}
                href={cleanSourceUrl(href)}
                label={labelFromCiteCaption(nested[3], href)}
              />
            );
          }
        } else {
          const simple = token.match(/^!?\[([^\]]*)\]\(([^)]+)\)$/);
          if (simple) {
            const href = simple[2].trim();
            const image = token.startsWith('![');
            if (isHttpUrl(href) && !isFaviconUrl(href)) {
              parts.push(
                <SourceChip
                  key={`s-${i++}`}
                  href={cleanSourceUrl(href)}
                  label={sourceLabel(simple[1], href, image)}
                />
              );
            } else if (!isFaviconUrl(href)) {
              parts.push(
                <a key={`a-${i++}`} href={href} target="_blank" rel="noopener noreferrer">
                  {simple[1] || href}
                </a>
              );
            }
          }
        }
      }
      last = end;
    }
    if (last < text.length) parts.push(text.slice(last));
    return parts.length === 1 ? parts[0] : <>{parts}</>;
  };

  const flushList = () => {
    if (listItems.length === 0) return;
    const Tag = listOrdered ? 'ol' : 'ul';
    nodes.push(
      <Tag key={`list-${key++}`}>
        {listItems.map((item, i) => (
          <li key={i}>{inline(item)}</li>
        ))}
      </Tag>
    );
    listItems = [];
  };

  for (let idx = 0; idx < lines.length; idx++) {
    const line = lines[idx].trimEnd();
    const trimmed = line.trim();
    if (!trimmed) {
      flushList();
      continue;
    }

    if (
      trimmed.includes('|') &&
      idx + 1 < lines.length &&
      isTableSeparator(lines[idx + 1].trim())
    ) {
      flushList();
      const headers = splitTableRow(trimmed);
      idx += 2;
      const rows: string[][] = [];
      while (idx < lines.length) {
        const rowLine = lines[idx].trim();
        if (!rowLine.includes('|')) break;
        rows.push(splitTableRow(rowLine));
        idx++;
      }
      idx--;
      nodes.push(
        <div key={`table-wrap-${key}`} className="guide-md-table-wrap">
          <table key={`table-${key++}`} className="guide-md-table">
            <thead>
              <tr>
                {headers.map((h, i) => (
                  <th key={i}>{inline(h)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, ri) => (
                <tr key={ri}>
                  {headers.map((_, ci) => (
                    <td key={ci}>{inline(row[ci] ?? '')}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
      continue;
    }

    const ol = trimmed.match(/^\d+\.\s+(.*)$/);
    const ul = trimmed.match(/^[-*]\s+(.*)$/);
    if (ol) {
      if (listItems.length > 0 && !listOrdered) flushList();
      listOrdered = true;
      listItems.push(ol[1]);
      continue;
    }
    if (ul) {
      if (listItems.length > 0 && listOrdered) flushList();
      listOrdered = false;
      listItems.push(ul[1]);
      continue;
    }
    flushList();
    if (trimmed.startsWith('### ')) {
      nodes.push(<h3 key={`h3-${key++}`}>{inline(trimmed.slice(4))}</h3>);
    } else if (trimmed.startsWith('## ')) {
      nodes.push(<h2 key={`h2-${key++}`}>{inline(trimmed.slice(3))}</h2>);
    } else if (trimmed.startsWith('# ')) {
      nodes.push(<h1 key={`h1-${key++}`}>{inline(trimmed.slice(2))}</h1>);
    } else {
      nodes.push(<p key={`p-${key++}`}>{inline(trimmed)}</p>);
    }
  }
  flushList();
  return nodes;
}
