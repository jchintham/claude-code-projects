const express = require('express');
const requireAuth = require('../middleware/auth');
const db = require('../db');

const router = express.Router();

router.get('/', requireAuth, async (req, res) => {
  try {
    res.json(await db.getVisited(req.userId));
  } catch (err) {
    console.error('Get visited error:', err.message);
    res.status(500).json({ error: 'Failed to load visited restaurants.' });
  }
});

router.post('/', requireAuth, async (req, res) => {
  try {
    const { place_id, name, address, rating, notes, would_return, category } = req.body;
    if (!place_id || !name) {
      return res.status(400).json({ error: 'place_id and name are required' });
    }
    const record = await db.addVisited(req.userId, { place_id, name, address, rating, notes, would_return, category });
    res.json(record);
  } catch (err) {
    console.error('Add visited error:', err.message);
    res.status(500).json({ error: 'Failed to save visited restaurant.' });
  }
});

router.delete('/:placeId', requireAuth, async (req, res) => {
  try {
    await db.removeVisited(req.userId, req.params.placeId);
    res.json({ ok: true });
  } catch (err) {
    console.error('Remove visited error:', err.message);
    res.status(500).json({ error: 'Failed to remove restaurant.' });
  }
});

module.exports = router;
