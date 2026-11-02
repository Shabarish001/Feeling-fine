import Link from "next/link";

// PAGE 3 — About the company. Edit the text to tell your team's story.
export const metadata = { title: "About — FEELING FIND" };

const VALUES = [
  {
    title: "Made with the community",
    text: "Our reviews and recommendations come from disabled people, carers and adaptive designers — the people who know what really works.",
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
      <section className="about-hero">
        <img src="/logo.svg" alt="" width="72" height="72" />
        <h1>About FEELING FIND</h1>
        <p className="lead">
          We help disabled people and their families find adaptive clothing — and the shops that sell it — by simply
          describing what they need.
        </p>
      </section>

      <section className="values" aria-label="What we believe">
        {VALUES.map((v) => (
          <div className="card" key={v.title}>
            <h3>{v.title}</h3>
            <p className="muted" style={{ margin: 0 }}>{v.text}</p>
          </div>
        ))}
      </section>

      <section className="card narrow" style={{ margin: "0 auto" }}>
        <h2 style={{ marginTop: 0 }}>Our story</h2>
        <p>
          Finding clothes that work with a wheelchair, a prosthesis, limited hand movement or sensory needs often
          means hours of searching. FEELING FIND brings it together in one place: chat with our assistant, see
          the results on a map, and visit the shop that suits you.
        </p>
        <p>FEELING FIND started as a hackathon project in Berlin in 2026.</p>
        <h2>Your privacy</h2>
        <p>
          Anything you tell us about your needs is private to your account. We only use it to improve your search
          results if you switch that on in your profile, and you can change or delete it at any time.
        </p>
        <Link href="/" className="btn">Start searching</Link>
      </section>
    </div>
  );
}
