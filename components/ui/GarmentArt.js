// Illustrated garment silhouette used wherever a product has no verified photo.
// Keeps the `.garment-art` / `.garment-shape` hooks the e2e suite relies on.
const SHAPES = {
  tops: "M40 18 L16 36 L27 55 L38 48 L38 122 L82 122 L82 48 L93 55 L104 36 L80 18 Q60 34 40 18Z",
  shirts: "M42 16 L13 42 L19 92 L34 90 L37 56 L37 124 L83 124 L83 56 L86 90 L101 92 L107 42 L78 16 L60 32Z M60 32 V124",
  trousers: "M36 14 H84 L91 130 H66 L60 58 L54 130 H29Z",
  dresses: "M47 14 H73 L75 46 L97 128 H23 L45 46Z M45 46 H75",
  jackets: "M40 16 L11 42 L16 100 L32 98 L35 60 L35 126 L85 126 L85 60 L88 98 L104 100 L109 42 L80 16 L60 30Z M60 30 V126",
  shoes: "M12 88 C12 70 30 66 42 56 L52 68 C66 74 90 72 108 86 C114 92 110 102 102 102 H16 C12 102 12 96 12 88Z",
};

export default function GarmentArt({ category, label }) {
  const d = SHAPES[category] || SHAPES.tops;
  return (
    <div className={`garment-art art-${category}`} aria-hidden="true">
      <div className="garment-shape">
        <svg viewBox="0 0 120 140" fill="none">
          <path d={d} fill="currentColor" fillOpacity=".16" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
        </svg>
      </div>
      <span>{label}</span>
    </div>
  );
}
