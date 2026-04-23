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

async function searchRestaurants({ lat, lng, query, radius }) {
  const res = await axios.get(`${BASE}/textsearch/json`, {
    params: {
      query: `${query} restaurant`,
      location: `${lat},${lng}`,
      radius: radius || 5000,
      type: 'restaurant',
      key: KEY()
    }
  });
  return res.data.results.slice(0, 10);
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
