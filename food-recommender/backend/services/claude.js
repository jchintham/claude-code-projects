const Anthropic = require('@anthropic-ai/sdk');

function getClient() {
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
}

function parseJSON(text) {
  // Strip markdown code fences if Claude wraps the response
  const cleaned = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  return JSON.parse(cleaned);
}

async function summarizeAndScore(restaurant, session, userProfile, visitedHistory = []) {
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

  const prompt = `You are a food recommendation assistant. Analyse the restaurant reviews below and return a JSON summary.

USER DIETARY CONTEXT: ${dietaryContext}
USER CUISINE PREFERENCES: ${(userProfile.cuisine_preferences || []).join(', ') || 'No preference'}
${visitedSection}
SESSION:
- Meal: ${session.meal_type} | Vibe: ${session.vibe} | Craving: ${session.craving || 'not specified'}

RESTAURANT: ${restaurant.name}
Type: ${(restaurant.types || []).filter(t => !['establishment','point_of_interest','food'].includes(t)).join(', ')}
Price: ${'$'.repeat(restaurant.price_level || 2)} | Google: ${restaurant.rating}/5 (${restaurant.user_ratings_total} reviews)${restaurant.yelp_rating ? ` | Yelp: ${restaurant.yelp_rating}/5` : ''}

REVIEWS:
${reviews}

Return ONLY a raw JSON object — no markdown, no code fences, nothing else:
{
  "summary": "2-3 sentences covering the overall dining experience and atmosphere, written in a conversational tone. If the user has visited similar restaurants, briefly mention the similarity.",
  "popular_dishes": ["Exact Dish Name", "Exact Dish Name", "Exact Dish Name"],
  "dietary_dishes": ${hasDietaryRestrictions ? '["Exact Dish Name", ...]' : '[]'},
  "dietary_notes": "One sentence on how this place suits the user's dietary context, or null if no restrictions"
}

Rules:
- popular_dishes: Use exact menu names from reviews, written in Title Case (e.g. "Truffle Pasta", "Spicy Tuna Roll"). List up to 5. Omit if no specific dishes are mentioned in reviews.
- dietary_dishes: ${hasDietaryRestrictions ? `List up to 8 dishes that are suitable for the user's dietary restrictions (${dietaryContext}). Use exact menu names in Title Case. Empty array if none found.` : 'Always return empty array since user has no restrictions.'}
- dietary_notes: Be specific about which menu items or preparation styles suit the user's needs.`;

  try {
    const message = await getClient().messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 600,
      messages: [{ role: 'user', content: prompt }]
    });

    const result = parseJSON(message.content[0].text);
    return {
      summary: result.summary || 'No summary available.',
      popular_dishes: result.popular_dishes || [],
      dietary_dishes: result.dietary_dishes || [],
      dietary_notes: result.dietary_notes || null
    };
  } catch (err) {
    console.error('Claude error:', err.message);
    return { summary: null, popular_dishes: [], dietary_dishes: [], dietary_notes: null };
  }
}

module.exports = { summarizeAndScore };
