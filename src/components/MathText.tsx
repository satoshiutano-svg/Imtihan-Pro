import katex from 'katex';
import 'katex/dist/katex.min.css';

interface MathTextProps {
  text: string;
  className?: string;
  block?: boolean;
}

interface Segment {
  kind: 'text' | 'inline' | 'display';
  value: string;
}

function tokenizeLatex(input: string): Segment[] {
  if (!input) return [];
  const segments: Segment[] = [];
  let cursor = 0;

  while (cursor < input.length) {
    // Check block math $$...$$
    if (input[cursor] === '$' && input[cursor + 1] === '$') {
      const end = input.indexOf('$$', cursor + 2);
      if (end !== -1) {
        segments.push({ kind: 'display', value: input.slice(cursor + 2, end).trim() });
        cursor = end + 2;
        continue;
      }
    }

    // Check escaped \$
    if (input[cursor] === '\\' && input[cursor + 1] === '$') {
      segments.push({ kind: 'text', value: '$' });
      cursor += 2;
      continue;
    }

    // Check inline math $...$
    if (input[cursor] === '$') {
      let end = cursor + 1;
      while (end < input.length) {
        if (input[end] === '\\' && input[end + 1] === '$') {
          end += 2;
          continue;
        }
        if (input[end] === '$' && input[end + 1] !== '$') {
          break;
        }
        end += 1;
      }
      if (end < input.length && input[end] === '$') {
        segments.push({ kind: 'inline', value: input.slice(cursor + 1, end).trim() });
        cursor = end + 1;
        continue;
      }
    }

    // Plain text up to next $ or \$
    let nextSpecial = input.indexOf('$', cursor + 1);
    while (nextSpecial > 0 && input[nextSpecial - 1] === '\\') {
      nextSpecial = input.indexOf('$', nextSpecial + 1);
    }
    const sliceEnd = nextSpecial === -1 ? input.length : nextSpecial;
    segments.push({ kind: 'text', value: input.slice(cursor, sliceEnd) });
    cursor = sliceEnd;
  }

  return segments;
}

export function MathText({ text, className = '', block = false }: MathTextProps) {
  if (!text) return null;

  // Optimization: if no '$' at all, return plain span/div without parsing
  if (!text.includes('$')) {
    return block ? <div className={className}>{text}</div> : <span className={className}>{text}</span>;
  }

  const segments = tokenizeLatex(text);
  const Wrapper = block ? 'div' : 'span';

  return (
    <Wrapper className={className}>
      {segments.map((seg, idx) => {
        if (seg.kind === 'text') {
          return <span key={idx}>{seg.value}</span>;
        }
        const html = katex.renderToString(seg.value, {
          displayMode: seg.kind === 'display',
          throwOnError: false,
          trust: false,
          strict: false,
        });
        return (
          <span
            key={idx}
            className={seg.kind === 'display' ? 'my-1.5 block overflow-x-auto py-0.5' : 'inline-block align-middle'}
            dangerouslySetInnerHTML={{ __html: html }}
          />
        );
      })}
    </Wrapper>
  );
}
