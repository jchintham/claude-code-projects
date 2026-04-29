const axios = require('axios');

// Generic words that shouldn't count as a distinctive match
const GENERIC_WORDS = new Set([
  'restaurant', 'bar', 'grill', 'cafe', 'bistro', 'kitchen', 'house', 'room',
  'the', 'and', 'new', 'york', 'nyc', 'manhattan', 'brooklyn', 'city',
  'omakase', 'sushi', 'ramen', 'pizza', 'burger', 'steakhouse', 'tasting', 'menu',
  'japanese', 'italian', 'chinese', 'korean', 'thai', 'indian', 'french',
  'food', 'dining', 'eat', 'eats', 'best', 'great', 'review', 'experience'
]);

// Returns true only if the video title strongly matches the restaurant name AND city
function isRelevant(item, restaurantName, city) {
  const title = (item.snippet?.title || '').toLowerCase();
  const channel = (item.snippet?.channelTitle || '').toLowerCase();
  if (!title) return false;

  // Extract words specific to this restaurant (not generic cuisine/location terms)
  const distinctiveWords = restaurantName.toLowerCase()
    .split(/[\s\-&']+/)
    .filter(w => w.length > 2 && !GENERIC_WORDS.has(w));

  // ALL distinctive words must appear in the title (not just one)
  const nameMatch = distinctiveWords.length === 0
    ? restaurantName.toLowerCase().split(/\s+/).filter(w => w.length > 2).every(w => title.includes(w))
    : distinctiveWords.every(w => title.includes(w));

  if (!nameMatch) return false;

  // City must also appear in the title or channel name to rule out same-named
  // places in other cities (e.g. a "Sando Table" video from Asheville)
  if (city) {
    const cityLower = city.toLowerCase();
    if (!title.includes(cityLower) && !channel.includes(cityLower)) return false;
  }

  return true;
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
      if (!isRelevant(item, restaurantName, city)) continue;
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
