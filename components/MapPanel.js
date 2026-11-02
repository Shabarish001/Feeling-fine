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
  const [query, setQuery] = useState("");
  const [tag, setTag] = useState("");

  // Tags that exist on the current results (used for the filter chips).
  const tags = useMemo(() => [...new Set(numbered.flatMap((i) => i.relevance_tags || []))].slice(0, 6), [numbered]);

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return numbered.filter((i) =>
      (!needle || [i.name, i.store_name, i.address].filter(Boolean).join(" ").toLowerCase().includes(needle)) &&
      (!tag || (i.relevance_tags || []).includes(tag)));
  }, [numbered, query, tag]);
  const current = visible[active] || null;

  // New results or a new filter → reset to the first one.
  useEffect(() => {
    setActive(0);
    setCardOpen(true);
  }, [items, query, tag]);

  const select = (index) => {
    setActive(index);
    setCardOpen(true);
  };
  const step = (dir) => select((active + dir + visible.length) % visible.length);

  return (
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

      {/* Floating Regular glass: search + filters over the map */}
      <div className="map-toolbar glass glass-regular" role="search" aria-label="Filter stores">
        <label className="map-search">
          <span className="sr-only">Search these stores</span>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="6.5" /><path d="M16 16l4 4" /></svg>
          <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Filter stores by name or area" disabled={numbered.length === 0} />
        </label>
        {tags.length > 0 && (
          <div className="map-filters" role="group" aria-label="Filter by tag">
            {tags.map((t) => (
              <button key={t} type="button" className="filter-chip" aria-pressed={tag === t} onClick={() => setTag(tag === t ? "" : t)}>{t}</button>
            ))}
          </div>
        )}
        {numbered.length > 0 && <span className="map-count" aria-live="polite">{visible.length} {visible.length === 1 ? "store" : "stores"}</span>}
      </div>

      {numbered.length === 0 && (
        <div className="map-empty">
          <p>{loading ? "Searching nearby stores…" : "Your results will appear on this map."}</p>
        </div>
      )}
      {numbered.length > 0 && visible.length === 0 && (
        <div className="map-empty"><p>No stores match that filter.</p></div>
      )}

      {visible.length > 0 && (
        <div className={`result-strip ${current && cardOpen ? "has-detail" : ""}`} role="group" aria-label="Results list">
          {visible.map((item, i) => (
            <button key={item.id} type="button" className={`result-chip ${i === active && cardOpen ? "is-active" : ""}`} aria-pressed={i === active && cardOpen} onClick={() => select(i)}>
              <span className="num">{item.number}</span>
              <span className="result-text">
                <span className="result-name">{item.store_name || item.name}</span>
                <span className="result-sub">{item.rating != null ? `★ ${Number(item.rating).toFixed(1)} · ` : ""}{item.address}</span>
              </span>
            </button>
          ))}
        </div>
      )}

      {current && cardOpen && (
        <DetailCard item={current} position={active + 1} total={visible.length} onPrev={() => step(-1)} onNext={() => step(1)} onClose={() => setCardOpen(false)} />
      )}
    </div>
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
    const wide = window.innerWidth > 900;
    // Phones: top padding clears the floating search and filter toolbar.
    map.fitBounds(bounds, wide ? { top: 90, bottom: 150, left: 40, right: 420 } : { top: 128, bottom: 60, left: 30, right: 30 });
    if (items.length === 1) map.setZoom(15);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, ids]);
  useEffect(() => {
    if (!map || !current) return;
    map.panTo({ lat: Number(current.lat), lng: Number(current.lng) });
    // Phones: the detail sheet covers the lower part of the map, so move the selected pin up into the visible band.
    if (window.innerWidth <= 960 && window.google) {
      window.google.maps.event.addListenerOnce(map, "idle", () => {
        map.panBy(0, Math.round(map.getDiv().offsetHeight * 0.23));
      });
    }
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
      <p className="map-fallback-note">Map preview — add a Google Maps key to see the real map.</p>
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

  // Thick Regular glass sheet: bottom sheet on phones, side panel on desktop.
  return (
    <article className="detail-card glass glass-thick" aria-labelledby="detail-title">
      <div className="detail-image">
        {item.image_url ? (
          <img src={item.image_url} alt={item.name} referrerPolicy="no-referrer" />
        ) : (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true">
            <path d="M4 9.5 5.5 4h13L20 9.5M4 9.5V20h16V9.5M4 9.5h16M9 20v-5h6v5" strokeLinejoin="round" />
          </svg>
        )}
        <button type="button" className="detail-close" onClick={onClose} aria-label="Close details">✕</button>
      </div>
      <div className="detail-body">
        <p className="eyebrow">Store {item.number}</p>
        <h3 id="detail-title">
          {item.website ? (
            <a href={item.website} target="_blank" rel="noopener noreferrer">{item.name}</a>
          ) : item.name}
        </h3>

        <div className="detail-meta">
          <Stars rating={item.rating} />
          {item.review_count ? <span className="muted"> ({item.review_count} reviews)</span> : ""}
        </div>

        {item.relevance_tags?.length > 0 && (
          <div className="detail-tags">
            {item.relevance_tags.map((tag) => (
              <span key={tag} className="tag">{tag}</span>
            ))}
          </div>
        )}

        {item.description && <p className="detail-desc">{item.description}</p>}

        <div className="detail-section-title">Location</div>
        <p className="detail-text">{item.address}</p>

        {item.phone && (
          <>
            <div className="detail-section-title">Phone</div>
            <p className="detail-text"><a href={`tel:${item.phone}`}>{item.phone}</a></p>
          </>
        )}

        {item.opening_hours && (
          <>
            <div className="detail-section-title">Opening hours</div>
            <p className="detail-text detail-hours">{item.opening_hours}</p>
          </>
        )}

        <p className="stock-note">Listed as a nearby clothing store. Stock hasn&apos;t been verified, so call ahead to confirm they carry what you need.</p>

      </div>
      <div className="detail-footer">
        <div className="detail-actions">
          <a className="btn btn-small" href={directions} target="_blank" rel="noopener noreferrer">Get directions <span aria-hidden="true">↗</span></a>
          {item.website && (
            <a className="btn btn-small btn-secondary" href={item.website} target="_blank" rel="noopener noreferrer">Website</a>
          )}
          {item.google_maps_url && (
            <a className="btn btn-small btn-secondary" href={item.google_maps_url} target="_blank" rel="noopener noreferrer">Google Maps</a>
          )}
        </div>
        <div className="detail-nav">
          <button type="button" className="icon-btn" onClick={onPrev} aria-label="Previous result" disabled={total < 2}>←</button>
          <span aria-live="polite">{position} of {total}</span>
          <button type="button" className="icon-btn" onClick={onNext} aria-label="Next result" disabled={total < 2}>→</button>
        </div>
      </div>
    </article>
  );
}
