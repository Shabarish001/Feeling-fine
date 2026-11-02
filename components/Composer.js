"use client";
import { useEffect, useRef, useState } from "react";

// The rounded text box with a send button (like the Claude chat box).
// Enter sends, Shift+Enter adds a new line.
export default function Composer({ onSend, disabled, placeholder, autoFocus }) {
  const [value, setValue] = useState("");
  const ref = useRef(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 200) + "px";
  }, [value]);

  function submit(e) {
    e?.preventDefault();
    const text = value.trim();
    if (!text || disabled) return;
    onSend(text);
    setValue("");
  }

  return (
    <form className="composer" onSubmit={submit}>
      <label htmlFor="chat-input" className="sr-only">Describe what you're looking for</label>
      <textarea
        id="chat-input"
        ref={ref}
        rows={1}
        value={value}
        autoFocus={autoFocus}
        placeholder={placeholder || "Describe what you're looking for…"}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) submit(e);
        }}
        maxLength={2000}
      />
      <button type="submit" className="send-btn" disabled={disabled || !value.trim()} aria-label="Send message">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M12 19V5M5 12l7-7 7 7" />
        </svg>
      </button>
    </form>
  );
}
