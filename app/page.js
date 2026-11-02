"use client";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Composer from "@/components/Composer";
import FabricSculpture from "@/components/ui/FabricSculpture";
import Reveal from "@/components/ui/Reveal";

// HOME — editorial landing. Two entry points: a personalised edit (/discover)
// and nearby store discovery (the search box below sends you to /search).
const SUGGESTIONS = [
  "Shirts I can close with one hand",
  "Trousers that are comfy in a wheelchair",
  "Shoes that fit over my leg braces",
  "Soft, tag-free clothes for sensory needs",
];

const QUALITIES = ["Easy fastening", "Sensory-soft", "Tag-free", "Seated fit", "Allergy-aware", "Your style"];

const STEPS = [
  { n: "01", title: "Tell us what feels right", text: "Pick the details that matter: fastenings, fabrics, fit, budget. No diagnosis needed, and every question is optional." },
  { n: "02", title: "Receive your edit", text: "We match clothing to your needs, never relaxing a restriction you set, and show you exactly why each piece made the cut." },
  { n: "03", title: "Shop online or in person", text: "Follow the retailer link, or find shops near you on the map and get directions in a tap." },
];

export default function HomePage() {
  const router = useRouter();
  const start = (text) => router.push(`/search?q=${encodeURIComponent(text)}`);

  return (
    <>
      <section className="fashion-hero" aria-labelledby="hero-title">
        <div className="hero-copy">
          <p className="eyebrow">Feeling Find · Wear what feels right</p>
          <h1 id="hero-title">Style that moves<br /><em>with you.</em></h1>
          <p className="hero-lede">Discover clothing shaped around your comfort, your body and your taste, from pieces that fasten with one hand to fabrics that are kind to sensitive skin.</p>
          <div className="hero-actions">
            <Link className="discover-button" href="/discover">Find clothes for me <span aria-hidden="true">→</span></Link>
            <a className="discover-secondary" href="#nearby-stores">Explore nearby stores</a>
          </div>
          <ul className="quality-row" aria-label="What we look for">
            {QUALITIES.map((q) => <li key={q} className="tag">{q}</li>)}
          </ul>
        </div>

        <div className="hero-art">
          <FabricSculpture />
          <div className="hero-tag hero-tag-a glass-static" aria-hidden="true"><b>Easy close</b><span>one-hand friendly</span></div>
          <div className="hero-tag hero-tag-b glass-static" aria-hidden="true"><b>Flat seams</b><span>sensory soft</span></div>
          <p className="hero-caption" aria-hidden="true">Your style.<br />Your terms.</p>
        </div>
      </section>

      <section className="journey" aria-label="Two ways to start">
        <Reveal as="article" className="journey-card journey-edit">
          <p className="eyebrow">Personal edit</p>
          <h2>Clothes chosen around you.</h2>
          <p>Answer a few gentle questions and see a curated edit, with the reasons behind every match.</p>
          <Link className="discover-button" href="/discover">Start my edit <span aria-hidden="true">→</span></Link>
        </Reveal>
        <Reveal as="article" className="journey-card journey-stores" delay={100}>
          <p className="eyebrow">Nearby stores</p>
          <h2>Shops worth the trip.</h2>
          <p>Describe what you need and see shops on the map, with details and directions.</p>
          <a className="discover-secondary" href="#nearby-stores">Find stores <span aria-hidden="true">↓</span></a>
        </Reveal>
      </section>

      <section className="how" aria-labelledby="how-title">
        <Reveal><p className="eyebrow">How it works</p><h2 id="how-title">Thoughtful, from first question to checkout.</h2></Reveal>
        <ol className="how-steps">
          {STEPS.map((s, i) => (
            <Reveal as="li" key={s.n} delay={i * 90} className="how-step">
              <span className="how-num" aria-hidden="true">{s.n}</span>
              <h3>{s.title}</h3>
              <p>{s.text}</p>
            </Reveal>
          ))}
        </ol>
      </section>

      <section className="chat-home" id="nearby-stores" aria-labelledby="stores-title">
        <div className="chat-home-bg" aria-hidden="true" />
        <Reveal className="chat-home-inner">
          <img src="/logo.svg" alt="" className="hero-logo" />
          <h2 id="stores-title">What are you looking for today?</h2>
          <p className="intro">Tell us what you need in your own words and we&apos;ll show shops on the map. Results show where to look; call ahead to confirm stock.</p>
          <div className="composer-wrap glass glass-regular">
            <Composer onSend={start} placeholder="For example: a winter coat with easy zips, in Berlin" />
          </div>
          <div className="suggestions" role="group" aria-label="Example searches">
            {SUGGESTIONS.map((s) => (
              <button key={s} type="button" className="suggestion" onClick={() => start(s)}>{s}</button>
            ))}
          </div>
        </Reveal>
      </section>
    </>
  );
}
