// A slowly turning abstract fabric sculpture: stacked ribbons fanned into a twisted ring.
// Pure CSS 3D (no WebGL, no dependency). Decorative: hidden from assistive tech,
// paused/static under prefers-reduced-motion.
const FOLDS = Array.from({ length: 16 }, (_, i) => i);

export default function FabricSculpture({ className = "" }) {
  return (
    <div className={`sculpture ${className}`} aria-hidden="true">
      <div className="sculpture-glow" />
      <div className="sculpture-stage">
        <div className="sculpture-spin">
          {FOLDS.map((i) => (
            <span key={i} className="fold" style={{ "--i": i }} />
          ))}
        </div>
      </div>
      <div className="sculpture-floor" />
    </div>
  );
}
