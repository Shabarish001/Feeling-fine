import Link from "next/link";
import Reveal from "@/components/ui/Reveal";

// PAGE 3 — About the company. Edit the text to tell your team's story.
export const metadata = { title: "About — FEELING FINE" };

const VALUES = [
  {
    title: "Made with the community",
    text: "Our reviews and recommendations come from people with visible and invisible disabilities, carers and adaptive designers — the people who know what really works.",
  },
  {
    title: "Style without compromise",
    text: "Clothing should be easy to put on and feel like you. We look for pieces that are practical and look great.",
  },
  {
    title: "Find it near you",
    text: "Like a travel guide for clothes: see which shops carry what you need, how to get there, and what others thought.",
  },
];

export default function AboutPage() {
  return (
    <div className="container">
      {/* Hero: the photo is the background; the text sits on a soft fade on the left (photo above text on phones). */}
      <section className="about-banner" aria-labelledby="about-title">
        <div className="about-banner-media">
          <img
            src="/about-bg.jpeg"
            width="1672"
            height="941"
            alt="Four smiling young people in a clothing store: a man with a white cane, a woman using a wheelchair, a woman with a prosthetic arm and a man with a prosthetic leg."
          />
        </div>
        <div className="about-banner-text">
          <p className="eyebrow">About Feeling Fine</p>
          <h1 id="about-title">Fashion for <em>everyone.</em> Without limits.</h1>
          <p className="lead">
            At Feeling Fine, we believe that style is a right, not a privilege. Our mission is to help people with
            visible and invisible disabilities find adaptive clothing easily, so they can feel confident, comfortable
            and independent.
          </p>
          <a className="btn" href="#our-story">Discover our mission <span aria-hidden="true">→</span></a>
        </div>
      </section>

      <section className="values" aria-label="What we believe">
        {VALUES.map((v, i) => (
          <Reveal className="card value-card" key={v.title} delay={i * 90}>
            <span className="how-num" aria-hidden="true">0{i + 1}</span>
            <h3>{v.title}</h3>
            <p className="muted">{v.text}</p>
          </Reveal>
        ))}
      </section>

      <section className="card narrow story-card" id="our-story">
        <h2>Our story</h2>
        <p>
          Finding clothes that work with a wheelchair, a prosthesis, limited hand movement or sensory needs often
          means hours of searching. FEELING FINE brings it together in one place: chat with our assistant, see
          the results on a map, and visit the shop that suits you.
        </p>
        <p>FEELING FINE started as a hackathon project in Berlin in 2026.</p>
        <h2>Your privacy</h2>
        <p>
          Anything you tell us about your needs is private to your account. We only use it to improve your search
          results if you switch that on in your profile, and you can change or delete it at any time.
        </p>
        <Link href="/discover" className="btn">Find clothes for me <span aria-hidden="true">→</span></Link>
      </section>
    </div>
  );
}
