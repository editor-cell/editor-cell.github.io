import { paragraphs } from "@/lib/text";

export function Prose({
  body,
  sourceNums,
  sourceWord,
  first = true,
}: {
  body: string;
  sourceNums: Set<number>;
  sourceWord: string;
  /** Whether the first paragraph opens the reading (with the dropped first letter). */
  first?: boolean;
}) {
  return (
    <div className="reading-flow">
      {paragraphs(body).map((para, index) => (
        <p
          key={index}
          className={first && index === 0 ? "reading-para reading-first" : "reading-para"}
        >
          <Cited text={para} sourceNums={sourceNums} sourceWord={sourceWord} />
        </p>
      ))}
    </div>
  );
}

function Cited({
  text,
  sourceNums,
  sourceWord,
}: {
  text: string;
  sourceNums: Set<number>;
  sourceWord: string;
}) {
  const nodes: React.ReactNode[] = [];
  const re = /\[(\d+)\]/g;
  let last = 0;
  let match: RegExpExecArray | null;
  while ((match = re.exec(text)) !== null) {
    const n = Number(match[1]);
    let before = text.slice(last, match.index);
    // A source number sits against the word before it, as a superscript does, so it never
    // wraps alone to the start of the next line. Between two numbers the space stays.
    if (sourceNums.has(n) && before.trim()) before = before.trimEnd();
    if (before) nodes.push(before);
    const key = `${match.index}-${n}`;
    if (sourceNums.has(n)) {
      nodes.push(
        <a
          key={key}
          href={`#source-${n}`}
          className="cite"
          onClick={(event) => {
            if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
            event.preventDefault();
            const el = document.getElementById(`source-${n}`);
            if (!el) return;
            document.querySelectorAll(".source-row.is-lit").forEach((node) => node.classList.remove("is-lit"));
            // The chain at the foot starts closed: open it first, then go once it has unfolded.
            const closed = el.closest('.chain-panel[data-open="false"]') !== null;
            if (closed) window.dispatchEvent(new Event("orbis:open-chain"));
            const go = () => {
              // Read the layout once so a second tap on the same number restarts the fade.
              void el.offsetWidth;
              el.classList.add("is-lit");
              el.scrollIntoView({ behavior: "smooth", block: "center" });
            };
            if (closed) window.setTimeout(go, 240);
            else go();
          }}
        >
          <span aria-hidden="true">{n}</span>
          <span className="sr-only">
            {sourceWord} {n}
          </span>
        </a>,
      );
    } else {
      nodes.push(
        <span key={key} className="text-muted">
          [{n}]
        </span>,
      );
    }
    last = match.index + match[0].length;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return <>{nodes}</>;
}
