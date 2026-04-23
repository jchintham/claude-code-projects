const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, 'db.json');

function load() {
  if (!fs.existsSync(DB_PATH)) {
    fs.writeFileSync(DB_PATH, JSON.stringify({ users: [], visited_restaurants: [] }, null, 2));
  }
  const data = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
  if (!data.visited_restaurants) data.visited_restaurants = [];
  return data;
}

function save(data) {
  fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
}

function nextId(collection) {
  if (!collection.length) return 1;
  return Math.max(...collection.map(r => r.id)) + 1;
}

const db = {
  findUserByEmail(email) {
    return load().users.find(u => u.email === email) || null;
  },

  findUserById(id) {
    return load().users.find(u => u.id === id) || null;
  },

  createUser({ email, password_hash, name }) {
    const data = load();
    const user = {
      id: nextId(data.users),
      email,
      password_hash,
      name,
      dietary_restrictions: [],
      dietary_notes: '',
      cuisine_preferences: [],
      default_party_size: 2,
      created_at: new Date().toISOString()
    };
    data.users.push(user);
    save(data);
    return user;
  },

  updateUser(id, fields) {
    const data = load();
    const idx = data.users.findIndex(u => u.id === id);
    if (idx === -1) return null;
    data.users[idx] = { ...data.users[idx], ...fields };
    save(data);
    return data.users[idx];
  },

  // Visited restaurants
  getVisited(userId) {
    return load().visited_restaurants.filter(r => r.user_id === userId);
  },

  addVisited(userId, restaurant) {
    const data = load();
    const existing = data.visited_restaurants.find(
      r => r.user_id === userId && r.place_id === restaurant.place_id
    );
    if (existing) {
      // Update notes/rating if already logged
      Object.assign(existing, { ...restaurant, updated_at: new Date().toISOString() });
    } else {
      data.visited_restaurants.push({
        id: nextId(data.visited_restaurants),
        user_id: userId,
        ...restaurant,
        visited_at: new Date().toISOString()
      });
    }
    save(data);
    return data.visited_restaurants.find(r => r.user_id === userId && r.place_id === restaurant.place_id);
  },

  removeVisited(userId, placeId) {
    const data = load();
    data.visited_restaurants = data.visited_restaurants.filter(
      r => !(r.user_id === userId && r.place_id === placeId)
    );
    save(data);
  },

  // YouTube cache — 30-day TTL, caches null results too (stored as { video: null })
  getYouTubeCache(placeId) {
    const data = load();
    if (!data.youtube_cache) return undefined;
    const entry = data.youtube_cache.find(e => e.place_id === placeId);
    if (!entry) return undefined;
    const ageInDays = (Date.now() - new Date(entry.cached_at).getTime()) / (1000 * 60 * 60 * 24);
    if (ageInDays > 30) return undefined;
    return entry;
  },

  setYouTubeCache(placeId, video) {
    const data = load();
    if (!data.youtube_cache) data.youtube_cache = [];
    data.youtube_cache = data.youtube_cache.filter(e => e.place_id !== placeId);
    data.youtube_cache.push({ place_id: placeId, video, cached_at: new Date().toISOString() });
    save(data);
  }
};

module.exports = db;
