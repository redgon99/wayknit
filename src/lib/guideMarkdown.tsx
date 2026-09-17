import type { ReactNode } from 'react';

function splitTableRow(line: string): string[] {
  const trimmed = line.trim().replace(/^\|/, '').replace(/\|$/, '');
  return trimmed.split('|').map((c) => c.trim());
}

function isTableSeparator(line: string): boolean {
  const cells = splitTableRow(line);
  return cells.length > 0 && cells.every((c) => /^:?-{3,}:?$/.test(c));
}

/** Minimal markdown for guide bodies (headings, lists, tables, paragraphs, bold/italic, links). */
export function renderGuideMarkdown(md: string): ReactNode[] {
  const lines = md.replace(/\r\n/g, '\n').split('\n');
  const nodes: ReactNode[] = [];
  let listItems: string[] = [];
  let listOrdered = false;
  let key = 0;

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

  const inline = (text: string): ReactNode => {
    const parts: ReactNode[] = [];
    const re = /(\*\*[^*]+\*\*|\*[^*]+\*|\[([^\]]+)\]\(([^)]+)\))/g;
    let last = 0;
    let m: RegExpExecArray | null;
    let i = 0;
    while ((m = re.exec(text)) !== null) {
      if (m.index > last) parts.push(text.slice(last, m.index));
      const token = m[0];
      if (token.startsWith('**')) {
        parts.push(<strong key={`b-${i++}`}>{token.slice(2, -2)}</strong>);
      } else if (token.startsWith('*')) {
        parts.push(<em key={`e-${i++}`}>{token.slice(1, -1)}</em>);
      } else if (m[2] && m[3]) {
        parts.push(
          <a key={`a-${i++}`} href={m[3]} target="_blank" rel="noopener noreferrer">
            {m[2]}
          </a>
        );
      }
      last = m.index + token.length;
    }
    if (last < text.length) parts.push(text.slice(last));
    return parts.length === 1 ? parts[0] : <>{parts}</>;
  };

  for (let idx = 0; idx < lines.length; idx++) {
    const line = lines[idx].trimEnd();
    const trimmed = line.trim();
    if (!trimmed) {
      flushList();
      continue;
    }

    // GFM-style table: header | sep | rows…
    if (
      trimmed.includes('|') &&
      idx + 1 < lines.length &&
      isTableSeparator(lines[idx + 1].trim())
    ) {
      flushList();
      const headers = splitTableRow(trimmed);
      idx += 2; // skip separator
      const rows: string[][] = [];
      while (idx < lines.length) {
        const rowLine = lines[idx].trim();
        if (!rowLine.includes('|')) break;
        rows.push(splitTableRow(rowLine));
        idx++;
      }
      idx--; // outer loop will ++
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
