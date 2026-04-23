const axios = require('axios');

function yelpClient() {
  return axios.create({
    baseURL: 'https://api.yelp.com/v3',
    headers: { Authorization: `Bearer ${process.env.YELP_API_KEY}` }
  });
}

async function matchYelpBusiness(name, lat, lng) {
  try {
    const res = await yelpClient().get('/businesses/search', {
      params: { term: name, latitude: lat, longitude: lng, radius: 500, limit: 1 }
    });
    return res.data.businesses[0] || null;
  } catch {
    return null;
  }
}

async function getReviews(businessId) {
  try {
    const res = await yelpClient().get(`/businesses/${businessId}/reviews`);
    return res.data.reviews || [];
  } catch {
    return [];
  }
}

module.exports = { matchYelpBusiness, getReviews };
