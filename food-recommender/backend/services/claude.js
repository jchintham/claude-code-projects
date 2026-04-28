const Anthropic = require('@anthropic-ai/sdk');

function getClient() {
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
}

function parseJSON(text) {
  // Strip markdown code fences if Claude wraps the response
  const cleaned = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  return JSON.parse(cleaned);
}

async function summarizeAndScore(restaurant, session, userProfile, visitedHistory = [], menuText = null) {
  const reviews = restaurant.reviews?.length
    ? restaurant.reviews.map(r => `"${r.text}" — ${r.rating}/5`).join('\n\n')
    : 'No reviews available.';

  const notesArr = Array.isArray(userProfile.dietary_notes)
    ? userProfile.dietary_notes
    : userProfile.dietary_notes ? [userProfile.dietary_notes] : [];

  const dietaryContext = [
    ...(userProfile.dietary_restrictions || []),
    ...notesArr.map(n => `Preference: ${n}`)
  ].filter(Boolean).join(', ') || 'None';

  const hasDietaryRestrictions = (userProfile.dietary_restrictions?.length > 0) || notesArr.length > 0;

  let visitedSection = '';
  if (visitedHistory.length > 0) {
    const lines = visitedHistory
      .filter(v => v.name)
      .map(v => {
        let line = `- ${v.name}`;
        if (v.rating) line += ` (rated ${v.rating}/5)`;
        if (v.notes) line += ` — "${v.notes}"`;
        if (v.would_return === true) line += ' [would return]';
        if (v.would_return === false) line += ' [would not return]';
        return line;
      })
      .join('\n');
    visitedSection = `\nUSER'S PREVIOUSLY VISITED RESTAURANTS (for personalisation context):\n${lines}\n`;
  }

  const menuSection = menuText
    ? `\nMENU DATA (scraped from restaurant website — prefer this over reviews for dish names):\n${menuText}\n`
    : '';

  const cuisinePrefs = (userProfile.cuisine_preferences || []).join(', ') || 'No preference';
  const cravingText = session.craving || null;

  const CATEGORY_FOCUS = {
    dining: 'Focus on food quality, standout dishes, and dining atmosphere.',
    bars:   'Focus on drink selection (cocktails, wine, beer), bar atmosphere, and service. Mention standout drinks or house specialties. Food is secondary.',
    coffee: 'Focus on coffee/tea quality, pastry or food offerings, and atmosphere (e.g. good for working, cozy, lively). Mention signature drinks.',
    bakery: 'Focus on baked goods, pastry quality, specialty items, and the overall sweet/dessert experience.'
  };
  const categoryFocus = CATEGORY_FOCUS[session.category] || CATEGORY_FOCUS.dining;
  const categoryLabel = { dining: 'restaurant', bars: 'bar or drinking establishment', coffee: 'café or coffee shop', bakery: 'bakery or dessert shop' }[session.category] || 'restaurant';

  const prompt = `You are a food and drink recommendation assistant. Analyse the data below and return a JSON summary.

USER DIETARY CONTEXT: ${dietaryContext}
USER CUISINE PREFERENCES: ${cuisinePrefs}
${visitedSection}
SESSION:
- Category: ${categoryLabel} | Meal: ${session.meal_type} | Vibe: ${session.vibe} | Craving: ${cravingText || 'not specified'}

RESTAURANT: ${restaurant.name}
Type: ${(restaurant.types || []).filter(t => !['establishment','point_of_interest','food'].includes(t)).join(', ')}
Price: ${'$'.repeat(restaurant.price_level || 2)} | Google: ${restaurant.rating}/5 (${restaurant.user_ratings_total} reviews)${restaurant.yelp_rating ? ` | Yelp: ${restaurant.yelp_rating}/5` : ''}
${menuSection}
REVIEWS:
${reviews}

Return ONLY a raw JSON object — no markdown, no code fences, nothing else:
{
  "summary": "2-3 sentences. ${categoryFocus} ${cravingText ? `The user is craving/looking for "${cravingText}" — explicitly address whether this place satisfies that.` : ''} ${cuisinePrefs !== 'No preference' ? `If the cuisine aligns with the user's preferences (${cuisinePrefs}), briefly note it.` : ''} If the user has visited similar places, mention the similarity.",
  "popular_dishes": ["Exact Dish Name", "Exact Dish Name", "Exact Dish Name"],
  "dietary_dishes": ${hasDietaryRestrictions ? '["Exact Dish Name", ...]' : '[]'},
  "dietary_notes": "One sentence on how this place suits the user's dietary context, or null if no restrictions",
  "criteria_unmet": ["list any session or dietary criteria this restaurant clearly does NOT satisfy based on reviews/menu/type — e.g. 'No vegan options', 'No outdoor seating', 'Not open for brunch', 'Upscale — not a hole-in-the-wall'. Empty array if all criteria appear to be met or evidence is unclear."]
}

Rules:
- popular_dishes: If menu data is available, extract real dish names directly from the menu. Otherwise use dishes mentioned in reviews. Write in Title Case (e.g. "Truffle Pasta", "Spicy Tuna Roll"). List up to 5.
- dietary_dishes: ${hasDietaryRestrictions ? `List up to 8 dishes that are suitable for the user's dietary restrictions (${dietaryContext}). Prefer menu data over reviews. Use exact menu names in Title Case. Empty array if none found.` : 'Always return empty array since user has no restrictions.'}
- dietary_notes: Be specific about which menu items or preparation styles suit the user's needs.
- criteria_unmet: Only flag something as unmet if you have clear evidence (e.g. reviews/menu confirm no vegan options, reviews say it's very upscale when user wants casual). Do not flag things as unmet just because you lack evidence. ${cuisinePrefs !== 'No preference' ? `If the restaurant's cuisine clearly falls outside ALL of the user's preferences (${cuisinePrefs}), add "Outside your cuisine preferences" to criteria_unmet.` : ''}`;

  try {
    const message = await getClient().messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 700,
      messages: [{ role: 'user', content: prompt }]
    });

    const result = parseJSON(message.content[0].text);
    return {
      summary: result.summary || 'No summary available.',
      popular_dishes: result.popular_dishes || [],
      dietary_dishes: result.dietary_dishes || [],
      dietary_notes: result.dietary_notes || null,
      criteria_unmet: result.criteria_unmet || []
    };
  } catch (err) {
    console.error('Claude error:', err.message);
    return { summary: null, popular_dishes: [], dietary_dishes: [], dietary_notes: null, criteria_unmet: [] };
  }
}

module.exports = { summarizeAndScore };
