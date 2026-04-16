const express = require('express');
const axios = require('axios');
const requireAuth = require('../middleware/auth');

const router = express.Router();

router.get('/', requireAuth, async (req, res) => {
  const { input, type } = req.query;
  if (!input || input.length < 2) return res.json([]);

  const autocompleteTypes = type === 'location' ? 'geocode' : 'establishment';

  try {
    const response = await axios.get('https://maps.googleapis.com/maps/api/place/autocomplete/json', {
      params: {
        input,
        types: autocompleteTypes,
        key: process.env.GOOGLE_PLACES_API_KEY
      }
    });

    const suggestions = (response.data.predictions || []).map(p => ({
      place_id: p.place_id,
      name: p.structured_formatting.main_text,
      address: p.structured_formatting.secondary_text || ''
    }));

    res.json(suggestions);
  } catch (err) {
    console.error('Autocomplete error:', err.message);
    res.json([]);
  }
});

module.exports = router;
