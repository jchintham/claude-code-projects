/**
 * One-time migration: db.json → Supabase
 * Run AFTER adding SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to .env
 *
 *   node migrate_to_supabase.js
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function run() {
  console.log('Starting migration…');

  // ── 1. Insert user ──────────────────────────────────────────────────────────
  const { data: user, error: userErr } = await supabase
    .from('users')
    .upsert({
      id: 1,
      email: 'jchintham@mba2027.hbs.edu',
      password_hash: '$2a$12$lEw9AJgZTl4/g7jIrpWt6uyVryz92lf0wwHltwm.xL/wmkHx9dHpi',
      name: 'Jayanth',
      dietary_restrictions: [],
      dietary_notes: ["don't like too much cheese but not lactose-intolerant"],
      cuisine_preferences: ['Japanese','Chinese','Indian','Korean','Vietnamese','Seafood','Sushi','Pizza','shawarma'],
      default_party_size: 2,
      created_at: '2026-04-06T02:42:30.313Z'
    }, { onConflict: 'id' })
    .select();

  if (userErr) { console.error('User insert failed:', userErr.message); process.exit(1); }
  console.log('✓ User migrated:', user[0].email);


  // ── 2. Insert visited restaurants ───────────────────────────────────────────
  const visited = [
    { id: 1, user_id: 1, place_id: 'ChIJdVdb9xN544kRii3-KtFxwgU', name: 'Mountain House',        address: 'Brighton Avenue, Boston, MA, USA',                              rating: 5, notes: 'Szechuan Numbing Chicken',   would_return: true,  visited_at: '2026-04-08T16:00:31.295Z' },
    { id: 2, user_id: 1, place_id: 'ChIJ-8xRWQ5744kRZPEb34f88yk', name: 'Capri Italian Steakhouse', address: 'Harrison Avenue, Boston, MA, USA',                           rating: 5, notes: 'Rigatoni Alla Vodka',         would_return: true,  visited_at: '2026-04-16T02:03:27.184Z' },
    { id: 3, user_id: 1, place_id: 'ChIJA_zOjx1744kRlOv6BxIGGLs', name: 'Omi Korean Grill',      address: 'United States, Massachusetts, Boston, Huntington Avenue',       rating: 4, notes: '',                          would_return: true,  visited_at: '2026-04-16T02:03:42.183Z' },
    { id: 4, user_id: 1, place_id: 'ChIJF2tUqNh344kR_PAitH52QRc', name: 'Too Hot',                address: 'Eliot Street, Cambridge, MA, USA',                             rating: 5, notes: '',                          would_return: true,  visited_at: '2026-04-16T02:03:58.206Z' },
    { id: 5, user_id: 1, place_id: 'ChIJmZ7GUV1344kRjBf1i2C_FMA', name: 'Nine Tastes',            address: 'John F. Kennedy Street, Cambridge, MA, USA',                   rating: 3, notes: '',                          would_return: false, visited_at: '2026-04-16T02:04:49.068Z' },
    { id: 6, user_id: 1, place_id: 'ChIJvTOa-Wd344kR2ZETPB17DYE', name: 'Gyu-Kaku Japanese BBQ', address: 'Eliot Street, Cambridge, MA, USA',                             rating: 5, notes: 'All you can eat KBBQ',       would_return: true,  visited_at: '2026-04-23T01:07:52.264Z' },
    { id: 7, user_id: 1, place_id: 'ChIJOUqatilawokRguvFSj0wX7Y', name: "Scarr's Pizza",          address: 'Orchard Street, New York, NY, USA',                            rating: 5, notes: 'Hot Honey Pizza',            would_return: true,  visited_at: '2026-04-23T12:21:28.168Z' },
  ];

  const { error: visitedErr } = await supabase
    .from('visited_restaurants')
    .upsert(visited, { onConflict: 'id' });

  if (visitedErr) { console.error('Visited insert failed:', visitedErr.message); process.exit(1); }
  console.log(`✓ ${visited.length} visited restaurants migrated`);

  // ── 3. Insert YouTube cache ─────────────────────────────────────────────────
  const ytCache = [
    { place_id: 'ChIJGRfZp4FZwokRc5bLX3yR5wI', video_id: 'NGUOT6D6QFE', title: 'New Sushi Restaurant in New York, Shiki Omakase 🍣 Is Omakase Sushi Worth it? Our Review', channel: 'New Yorker Juhui', thumbnail: 'https://i.ytimg.com/vi/NGUOT6D6QFE/mqdefault.jpg', cached_at: '2026-04-24T11:54:40.549Z' },
    { place_id: 'ChIJe_sJd6RbwokRK4aNXd3I6dw', video_id: 'pOD-gRZOoj8', title: 'Hidden Gem Omakase Sushi Experience in NYC: Domo Sushi',                                   channel: 'MRwiteout',       thumbnail: 'https://i.ytimg.com/vi/pOD-gRZOoj8/mqdefault.jpg', cached_at: '2026-04-24T11:54:40.586Z' },
    { place_id: 'ChIJP4PSptBZwokR6CQkCAGUbDI', video_id: 'Cvzh-uOuMjY', title: "HIDDEN GEM! Reviewing Sushi W's $38 Omakase in NYC",                                       channel: 'UA Eats',         thumbnail: 'https://i.ytimg.com/vi/Cvzh-uOuMjY/mqdefault.jpg',  cached_at: '2026-04-24T11:54:40.598Z' },
    // null-cached (no video found)
    { place_id: 'ChIJ7YfUtXdZwokR0L-qNCk0fC0', video_id: null, title: null, channel: null, thumbnail: null, cached_at: '2026-04-24T11:54:40.538Z' },
    { place_id: 'ChIJ5f4-XjNZwokRXfGKAEanCh0', video_id: null, title: null, channel: null, thumbnail: null, cached_at: '2026-04-24T11:54:40.546Z' },
  ];

  const { error: ytErr } = await supabase
    .from('youtube_cache')
    .upsert(ytCache, { onConflict: 'place_id' });

  if (ytErr) { console.error('YouTube cache insert failed:', ytErr.message); process.exit(1); }
  console.log(`✓ ${ytCache.length} YouTube cache entries migrated`);

  // ── 4. Fix serial sequences so new rows don't conflict ──────────────────────
  // Supabase SQL: SELECT setval('users_id_seq', (SELECT MAX(id) FROM users));
  //               SELECT setval('visited_restaurants_id_seq', (SELECT MAX(id) FROM visited_restaurants));
  // Run these manually in SQL Editor if auto-increment starts from 1 again.

  console.log('\nMigration complete!');
  console.log('\nIMPORTANT: Run this in Supabase SQL Editor to fix auto-increment sequences:');
  console.log("  SELECT setval('users_id_seq', (SELECT MAX(id) FROM users));");
  console.log("  SELECT setval('visited_restaurants_id_seq', (SELECT MAX(id) FROM visited_restaurants));");
}

run().catch(err => { console.error('Migration error:', err.message); process.exit(1); });
