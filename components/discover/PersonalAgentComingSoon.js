'use client';

const capabilities = [
  {
    number: '01',
    title: 'Understand your needs',
    description: 'Tell the agent what feels comfortable, what makes dressing easier, and what you would like to avoid. You will review its suggestions before they are used.',
  },
  {
    number: '02',
    title: 'Find clothing that fits your choices',
    description: 'It will search the clothing catalog using your confirmed preferences and explain why each item may be a match.',
  },
  {
    number: '03',
    title: 'Remember what matters to you',
    description: 'With your permission, it will save your confirmed preferences for future searches. You will be able to edit or delete them.',
  },
];

export default function PersonalAgentComingSoon({ onClose }) {
  return (
    <div className="discover-shell agent-preview">
      <section className="agent-preview-hero" aria-labelledby="agent-preview-title">
        <span className="agent-preview-badge">Coming soon</span>
        <p className="eyebrow">Your personal shopping agent</p>
        <h1 id="agent-preview-title">Clothing that understands <em>you.</em></h1>
        <p className="agent-preview-lede">
          A more personal way to find adaptive clothing is on its way. Share what you need in your own words, then stay in control of every choice.
        </p>
      </section>

      <section className="agent-preview-details" aria-labelledby="agent-preview-details-title">
        <h2 id="agent-preview-details-title">What your agent will do</h2>
        <div className="agent-preview-grid">
          {capabilities.map(({ number, title, description }) => (
            <article className="agent-preview-card" key={number}>
              <span className="agent-preview-number" aria-hidden="true">{number}</span>
              <h3>{title}</h3>
              <p>{description}</p>
            </article>
          ))}
        </div>
        <p className="agent-preview-note">If a product does not document an important requirement, the agent will flag it for verification instead of assuming it is suitable.</p>
        <div className="agent-preview-actions">
          <button type="button" className="discover-button" onClick={onClose}>Explore clothing now</button>
          <span>The current Discover experience is ready to use.</span>
        </div>
      </section>
    </div>
  );
}
