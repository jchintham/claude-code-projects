const axios = require('axios');

const BASE = 'https://maps.googleapis.com/maps/api/place';
const KEY = () => process.env.GOOGLE_PLACES_API_KEY;

async function geocodeAddress(address) {
  const res = await axios.get('https://maps.googleapis.com/maps/api/geocode/json', {
    params: { address, key: KEY() }
  });
  if (!res.data.results.length) throw new Error(`Could not geocode: "${address}"`);
  return res.data.results[0].geometry.location; // { lat, lng }
}

const CATEGORY_TYPE = {
  dining: { type: 'restaurant', suffix: 'restaurant' },
  bars:   { type: 'bar',        suffix: 'bar'        },
  coffee: { type: 'cafe',       suffix: 'cafe'       },
  bakery: { type: 'bakery',     suffix: 'bakery'     }
};

async function searchRestaurants({ lat, lng, query, radius, category }) {
  const { type, suffix } = CATEGORY_TYPE[category] || CATEGORY_TYPE.dining;
  const res = await axios.get(`${BASE}/textsearch/json`, {
    params: {
      query: `${query} ${suffix}`.trim(),
      location: `${lat},${lng}`,
      radius: radius || 5000,
      type,
      key: KEY()
    }
  });
  return res.data.results.slice(0, 20);
}

async function getPlaceDetails(placeId) {
  const res = await axios.get(`${BASE}/details/json`, {
    params: {
      place_id: placeId,
      fields: [
        'name', 'rating', 'reviews', 'photos', 'formatted_phone_number',
        'website', 'price_level', 'opening_hours', 'formatted_address',
        'geometry', 'url', 'types', 'user_ratings_total'
      ].join(','),
      key: KEY()
    }
  });
  return res.data.result;
}

function getPhotoUrl(photoReference, maxWidth = 800) {
  return `${BASE}/photo?maxwidth=${maxWidth}&photo_reference=${photoReference}&key=${KEY()}`;
}

module.exports = { geocodeAddress, searchRestaurants, getPlaceDetails, getPhotoUrl };
