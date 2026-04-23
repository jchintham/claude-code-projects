require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const restaurantRoutes = require('./routes/restaurants');
const visitedRoutes = require('./routes/visited');
const autocompleteRoutes = require('./routes/autocomplete');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Serve frontend static files
app.use(express.static(path.join(__dirname, '../frontend')));

// Expose Google API key to frontend (for Places Autocomplete)
app.get('/api/config', (req, res) => {
  res.json({ googleApiKey: process.env.GOOGLE_PLACES_API_KEY });
});

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/restaurants', restaurantRoutes);
app.use('/api/visited', visitedRoutes);
app.use('/api/autocomplete', autocompleteRoutes);

// Fallback: serve index.html for non-API routes
app.get(/^(?!\/api).*/, (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

app.listen(PORT, () => {
  console.log(`Crave running at http://localhost:${PORT}`);
});
