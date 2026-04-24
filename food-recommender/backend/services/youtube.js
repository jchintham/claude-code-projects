const axios = require('axios');

// Returns true if the video title mentions enough words from the restaurant name
function isRelevant(item, restaurantName) {
  const title = (item.snippet?.title || '').toLowerCase();
  const nameParts = restaurantName.toLowerCase().split(/\s+/).filter(w => w.length > 2);
  if (!nameParts.length) return false;
  const matchCount = nameParts.filter(w => title.includes(w)).length;
  return matchCount >= Math.max(1, Math.ceil(nameParts.length / 2));
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
