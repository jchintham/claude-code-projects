const axios = require('axios');

// Generic words that shouldn't count as a distinctive match
const GENERIC_WORDS = new Set([
  'restaurant', 'bar', 'grill', 'cafe', 'bistro', 'kitchen', 'house', 'room',
  'the', 'and', 'new', 'york', 'nyc', 'manhattan', 'brooklyn', 'city',
  'omakase', 'sushi', 'ramen', 'pizza', 'burger', 'steakhouse', 'tasting', 'menu',
  'japanese', 'italian', 'chinese', 'korean', 'thai', 'indian', 'french',
  'food', 'dining', 'eat', 'eats', 'best', 'great', 'review', 'experience'
]);

// Returns true only if a distinctive part of the restaurant name appears in the video title
function isRelevant(item, restaurantName) {
  const title = (item.snippet?.title || '').toLowerCase();
  if (!title) return false;

  // Extract words that are specific to this restaurant (not generic cuisine/location terms)
  const distinctiveWords = restaurantName.toLowerCase()
    .split(/[\s\-&']+/)
    .filter(w => w.length > 2 && !GENERIC_WORDS.has(w));

  if (distinctiveWords.length === 0) {
    // All words are generic — fall back to requiring all non-trivial words to match
    const allWords = restaurantName.toLowerCase().split(/\s+/).filter(w => w.length > 2);
    return allWords.length > 0 && allWords.every(w => title.includes(w));
  }

  // At least one distinctive word must appear in the title
  return distinctiveWords.some(w => title.includes(w));
}

async function searchYouTubeVideo(restaurantName, city) {
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) return null;

  const query = `${restaurantName} ${city} restaurant review`;

  try {
    const response = await axios.get('https://www.googleapis.com/youtube/v3/search', {
      params: {
        part: 'snippet',
        q: query,
        type: 'video',
        maxResults: 5,
        key: apiKey,
        relevanceLanguage: 'en'
      },
      timeout: 5000
    });

    const items = response.data.items || [];
    for (const item of items) {
      if (!isRelevant(item, restaurantName)) continue;
      const videoId = item.id?.videoId;
      if (!videoId) continue;
      return {
        video_id: videoId,
        title: item.snippet.title,
        channel: item.snippet.channelTitle,
        thumbnail: item.snippet.thumbnails?.medium?.url || item.snippet.thumbnails?.default?.url
      };
    }
    return null;
  } catch (err) {
    console.error('YouTube API error:', err.message);
    return null;
  }
}

module.exports = { searchYouTubeVideo };
