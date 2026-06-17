// Parses plain-text Spotify episode descriptions into React nodes,
// linkifying URLs, bare domains, and @twitter handles, and respecting newlines.

type Segment =
  | { kind: 'text'; value: string }
  | { kind: 'url'; href: string; label: string }
  | { kind: 'twitter'; handle: string }

const SEGMENT_RE =
  /(@[A-Za-z0-9_]{1,15})\b|(https?:\/\/[^\s)>\]]+)|(\b(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+(?:com|org|net|io|me|co|uk|fm|tv|app|podcast)\b(?:\/[^\s)>\]]*)?)/gi

function parseSegments(line: string): Segment[] {
  const segments: Segment[] = []
  let last = 0
  let m: RegExpExecArray | null

  SEGMENT_RE.lastIndex = 0
  while ((m = SEGMENT_RE.exec(line)) !== null) {
    if (m.index > last) segments.push({ kind: 'text', value: line.slice(last, m.index) })

    if (m[1]) {
      segments.push({ kind: 'twitter', handle: m[1].slice(1) })
    } else if (m[2]) {
      segments.push({ kind: 'url', href: m[2], label: m[2] })
    } else if (m[3]) {
      segments.push({ kind: 'url', href: `https://${m[3]}`, label: m[3] })
    }
    last = m.index + m[0].length
  }

  if (last < line.length) segments.push({ kind: 'text', value: line.slice(last) })
  return segments
}

/** Convert Spotify's html_description to plain text with \n paragraph breaks. */
export function htmlToText(html: string): string {
  return html
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCharCode(parseInt(code, 10)))
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

interface RichTextProps {
  text: string
  className?: string
}

export function RichText({ text, className }: RichTextProps) {
  const lines = text.split('\n')

  return (
    <span className={className}>
      {lines.map((line, li) => (
        <span key={li}>
          {li > 0 && (line === '' ? <br /> : <br />)}
          {parseSegments(line).map((seg, si) => {
            if (seg.kind === 'text') return <span key={si}>{seg.value}</span>
            if (seg.kind === 'twitter') {
              return (
                <a
                  key={si}
                  href={`https://twitter.com/${seg.handle}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[var(--color-gold)] underline underline-offset-2"
                >
                  @{seg.handle}
                </a>
              )
            }
            return (
              <a
                key={si}
                href={seg.href}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[var(--color-gold)] underline underline-offset-2 break-all"
              >
                {seg.label}
              </a>
            )
          })}
        </span>
      ))}
    </span>
  )
}

/** First sentence or up to maxChars of the description, plain text only. */
export function descriptionSnippet(text: string, maxChars = 240): string {
  const firstPara = text.split('\n')[0].trim()
  const firstSentence = firstPara.match(/^.{20,}?[.!?](?=\s|$)/)?.[0] ?? firstPara
  return firstSentence.length <= maxChars
    ? firstSentence
    : firstSentence.slice(0, maxChars).trimEnd() + '…'
}
