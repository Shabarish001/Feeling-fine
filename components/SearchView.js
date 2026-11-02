"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import Composer from "./Composer";
import MessageText from "./MessageText";
import MapPanel from "./MapPanel";

export default function SearchView() {
  const params = useSearchParams();
  const initialQuery = params.get("q") || "";

  const [messages, setMessages] = useState([]);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const messagesRef = useRef([]); // always holds the latest conversation
  const started = useRef(false);
  const bottomRef = useRef(null);

  const send = useCallback(async (text) => {
    const next = [...messagesRef.current, { role: "user", content: text }];
    messagesRef.current = next;
    setMessages(next);
    setLoading(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: next }),
      });
      const data = await res.json();
      const reply = data.reply || data.error || "Something went wrong. Please try again.";
      messagesRef.current = [...next, { role: "assistant", content: reply }];
      setMessages(messagesRef.current);
      if (data.items?.length) setItems(data.items);
    } catch {
      messagesRef.current = [...next, { role: "assistant", content: "I couldn't connect. Please check your internet and try again." }];
      setMessages(messagesRef.current);
    } finally {
      setLoading(false);
    }
  }, []);

  // Send the question typed on the homepage once.
  useEffect(() => {
    if (initialQuery && !started.current) {
      started.current = true;
      send(initialQuery);
    }
  }, [initialQuery, send]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, loading]);

  return (
    <div className="search-layout">
      <section className="search-chat" aria-label="Chat">
        <div className="messages" aria-live="polite">
          {messages.length === 0 && !loading && (
            <p className="muted">Ask me about any clothing you need — I&apos;ll show matching shops on the map.</p>
          )}
          {messages.map((m, i) =>
            m.role === "user" ? (
              <div key={i} className="msg-user">{m.content}</div>
            ) : (
              <div key={i} className="msg-assistant">
                <img src="/logo.svg" alt="" />
                <div className="body">
                  <span className="sr-only">FEELING FIND assistant says:</span>
                  <MessageText text={m.content} />
                </div>
              </div>
            )
          )}
          {loading && (
            <div className="msg-assistant">
              <img src="/logo.svg" alt="" />
              <div className="typing" role="status" aria-label="Looking for clothes…">
                <span /><span /><span />
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>
        <Composer onSend={send} disabled={loading} placeholder="Ask a follow-up question…" />
      </section>

      <section className="search-map" aria-label="Map of results">
        <MapPanel items={items} loading={loading && items.length === 0} />
      </section>
    </div>
  );
}
