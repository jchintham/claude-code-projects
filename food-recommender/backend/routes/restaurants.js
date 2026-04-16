const express = require('express');
const requireAuth = require('../middleware/auth');
const db = require('../db');
const { geocodeAddress, searchRestaurants, getPlaceDetails, getPhotoUrl } = require('../services/googlePlaces');
const { matchYelpBusiness, getReviews } = require('../services/yelp');
const { summarizeAndScore } = require('../services/claude');
const { getOpenTableLink, getResyLink, getGoogleMapsLink } = require('../services/reservations');

const router = express.Router();

const RADIUS_MAP = {
  under_1:   1600,
  '1_to_2.5': 4000,
  '2.5_to_10': 16000,
  '10_to_50':  80000
};

function detectReservationPlatform(reservationsUrl, website) {
  const urls = [reservationsUrl, website].filter(Boolean).map(u => u.toLowerCase());
  for (const url of urls) {
    if (url.includes('opentable.com')) return 'opentable';
    if (url.includes('resy.com')) return 'resy';
    if (url.includes('tock.com')) return 'tock';
    if (url.includes('yelp.com/reservations')) return 'yelp';
  }
  return null;
}

router.post('/recommend', requireAuth, async (req, res) => {
  try {
    const { meal_type, vibe, distance, craving, location, party_size, date_time } = req.body;

    const userRow = db.findUserById(req.userId);
    const userProfile = {
      dietary_restrictions: userRow.dietary_restrictions,
      dietary_notes: userRow.dietary_notes || null,
      cuisine_preferences: userRow.cuisine_preferences
    };

    const visitedHistory = db.getVisited(req.userId).slice(0, 10);

    // Resolve coordinates
    let coords;
    if (location.lat && location.lng) {
      coords = { lat: location.lat, lng: location.lng };
    } else {
      coords = await geocodeAddress(location.address);
    }

    const radius = RADIUS_MAP[distance] || RADIUS_MAP.nearby;

    // Strip vague/non-specific cravings before using as a Google search term
    const vagueTerms = ['surprise me', 'anything', 'whatever', 'any', 'random', 'surprise', 'anything goes', 'no preference'];
    const cravingIsVague = !craving || vagueTerms.some(t => craving.toLowerCase().includes(t));
    const searchCraving = cravingIsVague ? '' : craving;
    const searchQuery = [searchCraving, meal_type].filter(Boolean).join(' ') || 'restaurant';

    const candidates = await searchRestaurants({ lat: coords.lat, lng: coords.lng, query: searchQuery, radius });
    if (!candidates.length) {
      return res.json({ restaurants: [] });
    }

    const seats = party_size || userRow.default_party_size || 2;
    const date = date_time ? date_time.split('T')[0] : new Date().toISOString().split('T')[0];

    // Enrich top 8 candidates in parallel
    const enriched = await Promise.all(
      candidates.slice(0, 8).map(async (place) => {
        try {
          const details = await getPlaceDetails(place.place_id);

          // Yelp cross-reference
          const yelpBiz = await matchYelpBusiness(details.name, coords.lat, coords.lng);
          const yelpReviews = yelpBiz ? await getReviews(yelpBiz.id) : [];

          // Merge reviews
          const allReviews = [
            ...(details.reviews || []).map(r => ({ text: r.text, rating: r.rating })),
            ...yelpReviews.map(r => ({ text: r.text, rating: r.rating }))
          ];

          const restaurantData = {
            ...details,
            reviews: allReviews,
            yelp_rating: yelpBiz?.rating || null
          };

          const session = { meal_type, vibe, craving, party_size: seats };
          const ai = await summarizeAndScore(restaurantData, session, userProfile, visitedHistory);

          // Extract city for reservation links
          const cityMatch = (details.formatted_address || '').match(/,\s*([^,]+),\s*[A-Z]{2}/);
          const city = cityMatch?.[1]?.trim() || '';

          // Determine reservation platform from website URL
          const platform = detectReservationPlatform(null, details.website);

          let reservation = null;
          if (platform === 'opentable') {
            reservation = { type: 'opentable', url: getOpenTableLink(details.name, city, date_time, seats), label: 'Reserve on OpenTable' };
          } else if (platform === 'resy') {
            reservation = { type: 'resy', url: getResyLink(details.name, city, date, seats), label: 'Reserve on Resy' };
          } else if (platform === 'tock') {
            reservation = { type: 'tock', url: details.website, label: 'Reserve on Tock' };
          } else if (platform === 'yelp') {
            reservation = { type: 'yelp', url: details.website, label: 'Reserve on Yelp' };
          }
          // If no platform detected, reservation stays null — frontend shows phone number only

          const photos = (details.photos || []).slice(0, 5).map(p => getPhotoUrl(p.photo_reference));

          return {
            place_id: place.place_id,
            name: details.name,
            address: details.formatted_address || '',
            phone: details.formatted_phone_number || null,
            rating: details.rating || null,
            yelp_rating: yelpBiz?.rating || null,
            user_ratings_total: details.user_ratings_total || 0,
            price_level: details.price_level || null,
            website: details.website || null,
            google_maps_url: details.url || getGoogleMapsLink(details.name, details.formatted_address),
            is_open_now: details.opening_hours?.open_now ?? null,
            photos,
            summary: ai.summary,
            popular_dishes: ai.popular_dishes || [],
            dietary_dishes: ai.dietary_dishes || [],
            dietary_notes: ai.dietary_notes || null,
            reservation
          };
        } catch (err) {
          console.error(`Skipping ${place.name}:`, err.message);
          return null;
        }
      })
    );

    const results = enriched.filter(Boolean).slice(0, 5);
    res.json({ restaurants: results });
  } catch (err) {
    console.error('Recommend error:', err.message);
    res.status(500).json({ error: 'Failed to fetch recommendations. Please try again.' });
  }
});

module.exports = router;
