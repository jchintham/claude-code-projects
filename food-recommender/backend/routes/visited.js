const express = require('express');
const requireAuth = require('../middleware/auth');
const db = require('../db');

const router = express.Router();

// Get all visited restaurants for the user
router.get('/', requireAuth, (req, res) => {
  res.json(db.getVisited(req.userId));
});

// Add or update a visited restaurant
router.post('/', requireAuth, (req, res) => {
  const { place_id, name, address, rating, notes, would_return } = req.body;
  if (!place_id || !name) {
    return res.status(400).json({ error: 'place_id and name are required' });
  }
  const record = db.addVisited(req.userId, { place_id, name, address, rating, notes, would_return });
  res.json(record);
});

// Remove a visited restaurant
router.delete('/:placeId', requireAuth, (req, res) => {
  db.removeVisited(req.userId, req.params.placeId);
  res.json({ ok: true });
});

module.exports = router;
