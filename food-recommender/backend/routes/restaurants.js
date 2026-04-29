const express = require('express');
const requireAuth = require('../middleware/auth');
const db = require('../db');
const { geocodeAddress, searchRestaurants, getPlaceDetails, getPhotoUrl } = require('../services/googlePlaces');
const { matchYelpBusiness, getReviews } = require('../services/yelp');
const { summarizeAndScore } = require('../services/claude');
const { getGoogleMapsLink } = require('../services/reservations');
const { fetchMenuText } = require('../services/menuScraper');
const { searchYouTubeVideo } = require('../services/youtube');

const router = express.Router();

const RADIUS_MAP = {
  under_1:   1600,
  under_2_5: 4000,
  under_10:  16000,
  under_50:  50000  // Google Places API hard-caps at 50,000m (~31mi)
};


router.post('/recommend', requireAuth, async (req, res) => {
  try {
    const { meal_type, vibe, distance, craving, location, party_size, date_time, category } = req.body;

    const userRow = await db.findUserById(req.userId);
    const userProfile = {
      dietary_restrictions: userRow.dietary_restrictions,
      dietary_notes: userRow.dietary_notes || null,
      cuisine_preferences:  userRow.cuisine_preferences  || [],
      drink_preferences:    userRow.drink_preferences    || [],
      coffee_preferences:   userRow.coffee_preferences   || [],
      bakery_preferences:   userRow.bakery_preferences   || []
    };

    const visitedHistory = (await db.getVisited(req.userId)).slice(0, 10);

    // Resolve coordinates
    let coords;
    if (location.lat && location.lng) {
      coords = { lat: location.lat, lng: location.lng };
    } else {
      coords = await geocodeAddress(location.address);
    }

    const radius = RADIUS_MAP[distance] || RADIUS_MAP.under_2_5;

    // Strip vague/non-specific cravings before using as a Google search term
    const vagueTerms = ['surprise me', 'anything', 'whatever', 'any', 'random', 'surprise', 'anything goes', 'no preference'];
    const cravingIsVague = !craving || vagueTerms.some(t => craving.toLowerCase().includes(t));
    const searchCraving = cravingIsVague ? '' : craving;

    // When no specific craving, bias the search with a randomly-picked category-specific preference
    const categoryPrefsMap = {
      dining: userProfile.cuisine_preferences,
      bars:   userProfile.drink_preferences,
      coffee: userProfile.coffee_preferences,
      bakery: userProfile.bakery_preferences
    };
    const activeCategoryPrefs = categoryPrefsMap[category] || userProfile.cuisine_preferences;

    // When craving is specific, use it as the sole search term so Google focuses
    // on the dish/concept rather than being diluted by meal_type or category suffix
    let candidates;
    if (!cravingIsVague) {
      const results = await searchRestaurants({
        lat: coords.lat, lng: coords.lng,
        query: searchCraving, radius, category,
        cravingSpecific: true
      });
      candidates = results;
    } else if (activeCategoryPrefs?.length > 0) {
      // Pick up to 3 distinct preferences and run parallel searches so the
      // results reflect a mix of the user's tastes, not just one cuisine
      const pool = [...activeCategoryPrefs];
      const selected = [];
      const count = Math.min(3, pool.length);
      for (let i = 0; i < count; i++) {
        const idx = Math.floor(Math.random() * pool.length);
        selected.push(pool.splice(idx, 1)[0]);
      }
      const batches = await Promise.all(selected.map(pref => {
        const q = [pref, meal_type].filter(Boolean).join(' ') || 'restaurant';
        return searchRestaurants({ lat: coords.lat, lng: coords.lng, query: q, radius, category, cravingSpecific: false });
      }));
      // Merge and dedup by place_id
      const seen = new Set();
      candidates = batches.flat().filter(p => {
        if (seen.has(p.place_id)) return false;
        seen.add(p.place_id);
        return true;
      });
    } else {
      // No preferences — generic search
      const q = meal_type || 'restaurant';
      candidates = await searchRestaurants({ lat: coords.lat, lng: coords.lng, query: q, radius, category, cravingSpecific: false });
    }

    if (!candidates.length) {
      return res.json({ restaurants: [] });
    }

    // Shuffle so results feel varied across sessions
    for (let i = candidates.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
    }

    const seats = party_size || userRow.default_party_size || 2;
    const date = date_time ? date_time.split('T')[0] : new Date().toISOString().split('T')[0];

    // Enrich top 20 candidates with limited concurrency (5 at a time)
    // to avoid hitting Claude's concurrent-connection rate limit
    async function enrichWithLimit(places, limit) {
      const results = [];
      for (let i = 0; i < places.length; i += limit) {
        const batch = await Promise.all(places.slice(i, i + limit).map(enrichPlace));
        results.push(...batch);
      }
      return results;
    }

    async function enrichPlace(place) {
      try {
        const details = await getPlaceDetails(place.place_id);

        // Yelp cross-reference + menu scraping (run in parallel)
        const [yelpBiz, menuText] = await Promise.all([
          matchYelpBusiness(details.name, coords.lat, coords.lng),
          fetchMenuText(details.website)
        ]);
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

        const session = { meal_type, vibe, craving, party_size: seats, category: category || 'dining' };
        const ai = await summarizeAndScore(restaurantData, session, userProfile, visitedHistory, menuText);

        const cityMatch = (details.formatted_address || '').match(/,\s*([^,]+),\s*[A-Z]{2}/);
        const city = cityMatch?.[1]?.trim() || '';

        const googlePhotos = (details.photos || []).slice(0, 10).map(p => getPhotoUrl(p.photo_reference));
        const yelpPhotos = (yelpBiz?.photos || []).filter(Boolean);
        const blended = [];
        const g = [...googlePhotos], y = [...yelpPhotos];
        while (blended.length < 10 && (g.length || y.length)) {
          if (g.length) blended.push(g.shift());
          if (blended.length < 10 && y.length) blended.push(y.shift());
        }
        const photos = blended;

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
          category: category || 'dining',
          criteria_unmet: ai.criteria_unmet || []
        };
      } catch (err) {
        console.error(`Skipping ${place.name}:`, err.message);
        return null;
      }
    }

    const enriched = await enrichWithLimit(candidates.slice(0, 20), 5);
    const valid = enriched.filter(Boolean);

    // If user had a specific craving, sort so places that don't explicitly
    // fail the craving come first (criteria_unmet doesn't mention the craving keyword)
    if (!cravingIsVague && searchCraving) {
      const kw = searchCraving.toLowerCase();
      valid.sort((a, b) => {
        const aFails = (a.criteria_unmet || []).some(c => c.toLowerCase().includes(kw));
        const bFails = (b.criteria_unmet || []).some(c => c.toLowerCase().includes(kw));
        return aFails - bFails;
      });
    }

    res.json({ restaurants: valid.slice(0, 20) });
  } catch (err) {
    console.error('Recommend error:', err.message);
    res.status(500).json({ error: 'Failed to fetch recommendations. Please try again.' });
  }
});

// ── YouTube: cached lookup per place_id ──
router.get('/youtube/:placeId', requireAuth, async (req, res) => {
  const { placeId } = req.params;
  const { name, city } = req.query;

  // Return cached result (including cached nulls)
  const cached = await db.getYouTubeCache(placeId);
  if (cached !== undefined) {
    return res.json({ video: cached.video_id ? { video_id: cached.video_id, title: cached.title, channel: cached.channel, thumbnail: cached.thumbnail } : null });
  }

  if (!name) return res.json({ video: null });

  const video = await searchYouTubeVideo(name, city || '');
  await db.setYouTubeCache(placeId, video);
  res.json({ video });
});

module.exports = router;
