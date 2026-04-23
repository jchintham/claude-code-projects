const express = require('express');
const db = require('../db');
const requireAuth = require('../middleware/auth');

const router = express.Router();

router.get('/profile', requireAuth, (req, res) => {
  const user = db.findUserById(req.userId);
  if (!user) return res.status(404).json({ error: 'User not found' });

  const { password_hash, ...safe } = user;
  res.json(safe);
});

router.put('/profile', requireAuth, (req, res) => {
  const { name, dietary_restrictions, dietary_notes, cuisine_preferences, default_party_size } = req.body;

  const updates = {};
  if (name !== undefined) updates.name = name;
  if (dietary_restrictions !== undefined) updates.dietary_restrictions = dietary_restrictions;
  if (dietary_notes !== undefined) updates.dietary_notes = dietary_notes;
  if (cuisine_preferences !== undefined) updates.cuisine_preferences = cuisine_preferences;
  if (default_party_size !== undefined) updates.default_party_size = default_party_size;

  const updated = db.updateUser(req.userId, updates);
  if (!updated) return res.status(404).json({ error: 'User not found' });

  const { password_hash, ...safe } = updated;
  res.json(safe);
});

module.exports = router;
