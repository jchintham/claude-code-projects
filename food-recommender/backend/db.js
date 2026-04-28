const { createClient } = require('@supabase/supabase-js');

function getClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env');
  return createClient(url, key);
}

// Helper — throw on Supabase errors
function check(result) {
  if (result.error) throw new Error(result.error.message);
  return result.data;
}

const db = {
  // ── Users ──
  async findUserByEmail(email) {
    const rows = check(await getClient().from('users').select('*').eq('email', email).limit(1));
    return rows[0] || null;
  },

  async findUserById(id) {
    const rows = check(await getClient().from('users').select('*').eq('id', id).limit(1));
    return rows[0] || null;
  },

  async createUser({ email, password_hash, name }) {
    const rows = check(await getClient()
      .from('users')
      .insert({ email, password_hash, name })
      .select());
    return rows[0];
  },

  async updateUser(id, fields) {
    const rows = check(await getClient()
      .from('users')
      .update(fields)
      .eq('id', id)
      .select());
    return rows[0] || null;
  },

  // ── Visited restaurants ──
  async getVisited(userId) {
    return check(await getClient()
      .from('visited_restaurants')
      .select('*')
      .eq('user_id', userId)
      .order('visited_at', { ascending: false }));
  },

  async addVisited(userId, { place_id, name, address, rating, notes, would_return, category }) {
    const client = getClient();
    const payload = { place_id, name, address, rating, notes, would_return, category: category || 'dining' };
    // Strip undefined so we don't clobber existing values on update
    Object.keys(payload).forEach(k => payload[k] === undefined && delete payload[k]);

    const existing = check(await client
      .from('visited_restaurants')
      .select('id')
      .eq('user_id', userId)
      .eq('place_id', place_id)
      .limit(1));

    if (existing.length) {
      const rows = check(await client
        .from('visited_restaurants')
        .update({ ...payload, updated_at: new Date().toISOString() })
        .eq('user_id', userId)
        .eq('place_id', place_id)
        .select());
      return rows[0];
    } else {
      const rows = check(await client
        .from('visited_restaurants')
        .insert({ user_id: userId, ...payload })
        .select());
      return rows[0];
    }
  },

  async removeVisited(userId, placeId) {
    check(await getClient()
      .from('visited_restaurants')
      .delete()
      .eq('user_id', userId)
      .eq('place_id', placeId));
  },

  // ── YouTube cache — 30-day TTL ──
  async getYouTubeCache(placeId) {
    const rows = check(await getClient()
      .from('youtube_cache')
      .select('*')
      .eq('place_id', placeId)
      .limit(1));
    if (!rows.length) return undefined;
    const entry = rows[0];
    const ageInDays = (Date.now() - new Date(entry.cached_at).getTime()) / (1000 * 60 * 60 * 24);
    if (ageInDays > 30) return undefined;
    return entry;
  },

  async setYouTubeCache(placeId, video) {
    // video is null or { video_id, title, channel, thumbnail }
    const payload = {
      place_id: placeId,
      video_id: video?.video_id || null,
      title: video?.title || null,
      channel: video?.channel || null,
      thumbnail: video?.thumbnail || null,
      cached_at: new Date().toISOString()
    };
    check(await getClient()
      .from('youtube_cache')
      .upsert(payload, { onConflict: 'place_id' }));
  }
};

module.exports = db;
