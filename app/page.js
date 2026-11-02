"use client";
import { useRouter } from "next/navigation";
import Composer from "@/components/Composer";

// PAGE 1 — Homepage: a simple chat box. Sending a message opens the map page.
const SUGGESTIONS = [
  "Shirts I can close with one hand",
  "Trousers that are comfy in a wheelchair",
  "Shoes that fit over my leg braces",
  "Soft, tag-free clothes for sensory needs",
];

export default function HomePage() {
  const router = useRouter();
  const start = (text) => router.push(`/search?q=${encodeURIComponent(text)}`);

  return (
    <section className="chat-home">
      <img src="/logo.svg" alt="" className="hero-logo" />
      <h1>What are you looking for today?</h1>
      <p className="intro">
        Tell me what you need in your own words. I&apos;ll find adaptive clothing that fits — and show you where to get it.
      </p>
      <div className="composer-wrap">
        <Composer onSend={start} autoFocus placeholder="For example: a winter coat with easy zips, in Berlin" />
      </div>
      <div className="suggestions" aria-label="Example searches">
        {SUGGESTIONS.map((s) => (
          <button key={s} type="button" className="suggestion" onClick={() => start(s)}>
            {s}
          </button>
        ))}
      </div>
    </section>
  );
}
