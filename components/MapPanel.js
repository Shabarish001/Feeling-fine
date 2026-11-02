"use client";
import { useEffect, useMemo, useState } from "react";
import { APIProvider, Map, AdvancedMarker, useMap } from "@vis.gl/react-google-maps";

const API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "";
const MAP_ID = process.env.NEXT_PUBLIC_GOOGLE_MAP_ID || "DEMO_MAP_ID";
const BERLIN = { lat: 52.52, lng: 13.405 };

// The map box with numbered pins, category tabs and a detail card
// (layout based on the itinerary-map screenshot).
export default function MapPanel({ items, loading }) {
  const numbered = useMemo(() => items.map((item, i) => ({ ...item, number: i + 1 })), [items]);
  const [active, setActive] = useState(0);
  const [cardOpen, setCardOpen] = useState(true);

  const visible = numbered;
  const current = visible[active] || null;

  // New results → reset to the first one.
  useEffect(() => {
    setActive(0);
    setCardOpen(true);
  }, [items]);

  const select = (index) => {
    setActive(index);
    setCardOpen(true);
  };
  const step = (dir) => select((active + dir + visible.length) % visible.length);

  return (
    <>
      <div className="map-box">
        {API_KEY ? (
          <APIProvider apiKey={API_KEY}>
            <Map
              mapId={MAP_ID}
              defaultCenter={BERLIN}
              defaultZoom={12}
              gestureHandling="greedy"
              disableDefaultUI={false}
              mapTypeControl={false}
              streetViewControl={false}
              style={{ width: "100%", height: "100%" }}
            >
              {visible.map((item, i) => (
                <AdvancedMarker
                  key={item.id}
                  position={{ lat: Number(item.lat), lng: Number(item.lng) }}
                  title={`${item.number}. ${item.name}`}
                  onClick={() => select(i)}
                  zIndex={i === active ? 100 : 1}
                >
                  <div className={`pin-wrap ${i === active ? "active" : ""}`}>
                    <div className={`pin ${i === active ? "active" : ""}`}><span>{item.number}</span></div>
                    <div className="pin-label">{item.store_name || item.name}</div>
                  </div>
                </AdvancedMarker>
              ))}
              <FitToItems items={visible} current={cardOpen ? current : null} />
            </Map>
          </APIProvider>
        ) : (
          <SketchMap items={visible} active={active} onSelect={select} />
        )}

        {numbered.length === 0 && (
          <div className="map-empty">
            <p>{loading ? "Searching the catalogue…" : "Your results will appear on this map."}</p>
          </div>
        )}

        {current && cardOpen && (
          <DetailCard item={current} position={active + 1} total={visible.length} onPrev={() => step(-1)} onNext={() => step(1)} onClose={() => setCardOpen(false)} />
        )}
      </div>

      {visible.length > 0 && (
        <div className="result-strip" role="group" aria-label="Results list">
          {visible.map((item, i) => (
            <button key={item.id} type="button" className="result-chip" aria-pressed={i === active && cardOpen} onClick={() => select(i)}>
              <span className="num">{item.number}</span>
              <span>{item.store_name || item.name}</span>
            </button>
          ))}
        </div>
      )}
    </>
  );
}

// Zooms the Google map so every pin is visible, and pans to the selected one.
function FitToItems({ items, current }) {
  const map = useMap();
  const ids = items.map((i) => i.id).join(",");
  useEffect(() => {
    if (!map || !items.length || !window.google) return;
    const bounds = new window.google.maps.LatLngBounds();
    items.forEach((i) => bounds.extend({ lat: Number(i.lat), lng: Number(i.lng) }));
    map.fitBounds(bounds, { top: 70, bottom: 40, left: 40, right: 420 });
    if (items.length === 1) map.setZoom(15);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, ids]);
  useEffect(() => {
    if (map && current) map.panTo({ lat: Number(current.lat), lng: Number(current.lng) });
  }, [map, current]);
  return null;
}

// Shown when no Google Maps key is set: pins drawn on a paper grid so you can still demo.
function SketchMap({ items, active, onSelect }) {
  if (!items.length) return <div className="map-fallback" />;
  // Frame the pins near the first result; far-away ones sit at the edge.
  const near = items.filter((i) => Math.abs(i.lat - items[0].lat) < 0.5 && Math.abs(i.lng - items[0].lng) < 0.5);
  const lats = near.map((i) => Number(i.lat));
  const lngs = near.map((i) => Number(i.lng));
  const [minLat, maxLat, minLng, maxLng] = [Math.min(...lats), Math.max(...lats), Math.min(...lngs), Math.max(...lngs)];
  const pos = (v, min, max) => (max - min < 1e-6 ? 0.5 : Math.min(1, Math.max(0, (v - min) / (max - min))));
  return (
    <div className="map-fallback" aria-label="Simple map preview">
      <p style={{ position: "absolute", bottom: 10, left: 14, margin: 0, fontSize: "0.85rem" }}>
        Map preview — add a Google Maps key to see the real map.
      </p>
      {items.map((item, i) => (
        <button
          key={item.id}
          type="button"
          onClick={() => onSelect(i)}
          aria-label={`${item.number}. ${item.name}`}
          className={`pin ${i === active ? "active" : ""}`}
          style={{
            position: "absolute",
            left: `calc(6% + ${pos(Number(item.lng), minLng, maxLng)} * var(--pin-w))`,
            top: `calc(18% + ${1 - pos(Number(item.lat), minLat, maxLat)} * var(--pin-h))`,
            padding: 0,
          }}
        >
          <span>{item.number}</span>
        </button>
      ))}
    </div>
  );
}

function Stars({ rating }) {
  if (rating == null) return null;
  const full = Math.round(Number(rating));
  return (
    <span>
      <span className="stars" aria-hidden="true">{"★".repeat(full)}{"☆".repeat(5 - full)}</span>{" "}
      <span>{Number(rating).toFixed(1)}</span>
      <span className="sr-only"> out of 5</span>
    </span>
  );
}

function DetailCard({ item, position, total, onPrev, onNext, onClose }) {
  const directions = item.google_maps_url
    || `https://www.google.com/maps/dir/?api=1&destination=${item.lat},${item.lng}`;

  return (
    <article className="detail-card" aria-labelledby="detail-title">
      <div className="detail-image">
        {item.image_url ? (
          <img src={item.image_url} alt={item.name} referrerPolicy="no-referrer" />
        ) : (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
            <path d="M12 4a2 2 0 1 1 2 2c-.8 0-2 .6-2 1.7V9M12 9 3.5 15c-.6.4-.3 1.3.4 1.3h16.2c.7 0 1-.9.4-1.3L12 9z" />
          </svg>
        )}
        <button type="button" className="detail-close" onClick={onClose} aria-label="Close details">✕</button>
      </div>
      <div className="detail-body">
        <h3 id="detail-title">
          {item.number}. {item.website ? (
            <a href={item.website} target="_blank" rel="noopener noreferrer" style={{ color: "var(--ink)", textDecoration: "underline" }}>{item.name}</a>
          ) : item.name}
        </h3>

        <div className="detail-meta">
          <Stars rating={item.rating} />
          {item.review_count ? <span className="muted"> ({item.review_count} reviews)</span> : ""}
        </div>

        {item.relevance_tags?.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 4, margin: "8px 0" }}>
            {item.relevance_tags.map((tag) => (
              <span key={tag} className="tag">{tag}</span>
            ))}
          </div>
        )}

        {item.description && (
          <p style={{ margin: "8px 0" }}>{item.description}</p>
        )}

        {item.phone && (
          <div style={{ margin: "4px 0" }}>
            <span className="muted">Phone:</span>{" "}
            <a href={`tel:${item.phone}`} style={{ color: "var(--accent)" }}>{item.phone}</a>
          </div>
        )}

        <div className="detail-section-title">Location</div>
        <p style={{ margin: "0 0 12px" }}>
          <span className="muted">{item.address}</span>
        </p>

        {item.opening_hours && (
          <>
            <div className="detail-section-title">Opening hours</div>
            <p style={{ margin: "0 0 12px", fontSize: "0.85rem", whiteSpace: "pre-line" }}>{item.opening_hours}</p>
          </>
        )}

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <a className="btn btn-small" href={directions} target="_blank" rel="noopener noreferrer">📍 Get directions</a>
          {item.website && (
            <a className="btn btn-small btn-secondary" href={item.website} target="_blank" rel="noopener noreferrer">🌐 Website</a>
          )}
          {item.google_maps_url && (
            <a className="btn btn-small btn-secondary" href={item.google_maps_url} target="_blank" rel="noopener noreferrer">🗺️ Google Maps</a>
          )}
        </div>
      </div>
      <div className="detail-nav">
        <button type="button" className="icon-btn" onClick={onPrev} aria-label="Previous result" disabled={total < 2}>←</button>
        <span aria-live="polite">{position} of {total}</span>
        <button type="button" className="icon-btn" onClick={onNext} aria-label="Next result" disabled={total < 2}>→</button>
      </div>
    </article>
  );
}
