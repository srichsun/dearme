// Google Places (New), called straight from the browser with a key that is
// restricted to this site's origins. Two calls: suggestions while typing,
// then the details of the one picked. No Maps SDK — two fetches is all it is.
const KEY = import.meta.env.VITE_PLACES_KEY;
const BASE = "https://places.googleapis.com/v1";

export const placesEnabled = Boolean(KEY);

export async function suggestPlaces(input, near) {
  const text = (input || "").trim();
  if (!text || !KEY) return [];
  const body = { input: text, languageCode: "zh-TW", regionCode: "TW" };
  if (near) {
    // Lean towards where they are; a "石二鍋" search should offer the near one.
    body.locationBias = {
      circle: { center: { latitude: near.lat, longitude: near.lng }, radius: 5000 },
    };
  }
  const res = await fetch(`${BASE}/places:autocomplete`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Goog-Api-Key": KEY },
    body: JSON.stringify(body),
  });
  if (!res.ok) return [];
  const data = await res.json();
  return (data.suggestions || [])
    .map((s) => s.placePrediction)
    .filter(Boolean)
    .map((p) => ({
      placeId: p.placeId,
      main: p.structuredFormat?.mainText?.text || p.text?.text || "",
      secondary: p.structuredFormat?.secondaryText?.text || "",
    }));
}

export async function placeDetails(placeId) {
  if (!placeId || !KEY) return null;
  const res = await fetch(`${BASE}/places/${placeId}?languageCode=zh-TW`, {
    headers: {
      "X-Goog-Api-Key": KEY,
      "X-Goog-FieldMask":
        "id,displayName,formattedAddress,nationalPhoneNumber,location,googleMapsUri",
    },
  });
  if (!res.ok) return null;
  return toPlaceFields(await res.json());
}

// Google's shape → the seven columns the API stores. Pure, so it is tested.
export function toPlaceFields(place) {
  if (!place) return null;
  return {
    place_id: place.id || null,
    place_name: place.displayName?.text || null,
    address: place.formattedAddress || null,
    phone: place.nationalPhoneNumber || null,
    lat: place.location?.latitude ?? null,
    lng: place.location?.longitude ?? null,
    maps_url: place.googleMapsUri || null,
  };
}
