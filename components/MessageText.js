// Shows the assistant's reply with simple formatting:
// paragraphs, "- " bullet lists and **bold**. (No raw HTML, so it's safe.)

function inline(text, keyBase) {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith("**") && part.endsWith("**") ? (
      <strong key={`${keyBase}-${i}`}>{part.slice(2, -2)}</strong>
    ) : (
      part
    )
  );
}

export default function MessageText({ text }) {
  const blocks = [];
  let list = null;
  text.split("\n").forEach((raw, i) => {
    const line = raw.trimEnd();
    const bullet = line.match(/^\s*[-*•]\s+(.*)/);
    if (bullet) {
      if (!list) {
        list = [];
        blocks.push({ type: "ul", items: list, key: i });
      }
      list.push(bullet[1]);
    } else {
      list = null;
      if (line.trim()) blocks.push({ type: "p", text: line.replace(/^#+\s*/, ""), key: i });
    }
  });

  return blocks.map((b) =>
    b.type === "ul" ? (
      <ul key={b.key}>
        {b.items.map((it, j) => (
          <li key={j}>{inline(it, `${b.key}-${j}`)}</li>
        ))}
      </ul>
    ) : (
      <p key={b.key}>{inline(b.text, b.key)}</p>
    )
  );
}
