// Google Places API (New) — searches for real stores near a location.
// Docs: https://developers.google.com/maps/documentation/places/web-service/text-search

const API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "";

const FIELDS = [
  "places.id",
  "places.displayName",
  "places.formattedAddress",
  "places.location",
  "places.rating",
  "places.userRatingCount",
  "places.websiteUri",
  "places.googleMapsUri",
  "places.businessStatus",
  "places.photos",
  "places.currentOpeningHours",
  "places.nationalPhoneNumber",
  "places.types",
  "places.editorialSummary",
].join(",");

// Build a photo URL from a Places photo resource name.
function photoUrl(photoName, maxWidth = 400) {
  if (!photoName || !API_KEY) return null;
  return `https://places.googleapis.com/v1/${photoName}/media?maxWidthPx=${maxWidth}&key=${API_KEY}`;
}

// Search Google Places for real stores matching a query + location.
// Returns an array of items shaped for the map (same fields the UI expects).
export async function searchPlaces({ query, location = "Berlin, Germany", radius = 10000 } = {}) {
  if (!API_KEY) return [];

  const body = {
    textQuery: query,
    languageCode: "en",
    maxResultCount: 10,
  };

  // If location looks like "lat,lng" use locationBias, otherwise include it in the query
  const latLng = location.match(/^(-?\d+\.?\d*),\s*(-?\d+\.?\d*)$/);
  if (latLng) {
    body.locationBias = {
      circle: {
        center: { latitude: parseFloat(latLng[1]), longitude: parseFloat(latLng[2]) },
        radius,
      },
    };
  } else {
    // Append location to query for better results
    if (!query.toLowerCase().includes(location.toLowerCase())) {
      body.textQuery = `${query} in ${location}`;
    }
  }

  try {
    const res = await fetch("https://places.googleapis.com/v1/places:searchText", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": API_KEY,
        "X-Goog-FieldMask": FIELDS,
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      console.error("Places API error:", res.status, await res.text());
      return [];
    }

    const data = await res.json();
    if (!data.places?.length) return [];

    return data.places
      .filter((p) => p.businessStatus !== "CLOSED_PERMANENTLY")
      .map((place) => ({
        id: place.id,
        name: place.displayName?.text || "Unknown store",
        store_name: place.displayName?.text || "Unknown store",
        address: place.formattedAddress || "",
        city: extractCity(place.formattedAddress),
        country: extractCountry(place.formattedAddress),
        lat: place.location?.latitude,
        lng: place.location?.longitude,
        rating: place.rating || null,
        review_count: place.userRatingCount || 0,
        website: place.websiteUri || null,
        google_maps_url: place.googleMapsUri || null,
        phone: place.nationalPhoneNumber || null,
        image_url: place.photos?.[0]?.name ? photoUrl(place.photos[0].name) : null,
        description: place.editorialSummary?.text || null,
        opening_hours: formatHours(place.currentOpeningHours),
        types: place.types || [],
      }));
  } catch (err) {
    console.error("Places API fetch failed:", err.message);
    return [];
  }
}

function extractCity(address) {
  if (!address) return "";
  // Typically: "Street, Postcode City, Country"
  const parts = address.split(",").map((s) => s.trim());
  if (parts.length >= 2) {
    // The second-to-last part usually has the city
    const cityPart = parts[parts.length - 2];
    // Remove postcode (digits at start)
    return cityPart.replace(/^\d{4,6}\s*/, "").trim();
  }
  return "";
}

function extractCountry(address) {
  if (!address) return "";
  const parts = address.split(",").map((s) => s.trim());
  return parts[parts.length - 1] || "";
}

function formatHours(hours) {
  if (!hours?.weekdayDescriptions) return null;
  return hours.weekdayDescriptions.join("\n");
}
