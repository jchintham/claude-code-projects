const express = require('express');
const db = require('../db');
const requireAuth = require('../middleware/auth');

const router = express.Router();

router.get('/profile', requireAuth, async (req, res) => {
  try {
    const user = await db.findUserById(req.userId);
    if (!user) return res.status(404).json({ error: 'User not found' });
    const { password_hash, ...safe } = user;
    res.json(safe);
  } catch (err) {
    console.error('Profile get error:', err.message);
    res.status(500).json({ error: 'Failed to load profile.' });
  }
});

router.put('/profile', requireAuth, async (req, res) => {
  try {
    const { name, dietary_restrictions, dietary_notes, cuisine_preferences, default_party_size,
            drink_preferences, coffee_preferences, bakery_preferences } = req.body;

    const updates = {};
    if (name !== undefined) updates.name = name;
    if (dietary_restrictions !== undefined) updates.dietary_restrictions = dietary_restrictions;
    if (dietary_notes !== undefined) updates.dietary_notes = dietary_notes;
    if (cuisine_preferences !== undefined) updates.cuisine_preferences = cuisine_preferences;
    if (default_party_size !== undefined) updates.default_party_size = default_party_size;
    if (drink_preferences !== undefined) updates.drink_preferences = drink_preferences;
    if (coffee_preferences !== undefined) updates.coffee_preferences = coffee_preferences;
    if (bakery_preferences !== undefined) updates.bakery_preferences = bakery_preferences;

    const updated = await db.updateUser(req.userId, updates);
    if (!updated) return res.status(404).json({ error: 'User not found' });

    const { password_hash, ...safe } = updated;
    res.json(safe);
  } catch (err) {
    console.error('Profile update error:', err.message);
    res.status(500).json({ error: 'Failed to update profile.' });
  }
});

module.exports = router;
