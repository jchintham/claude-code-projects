const axios = require('axios');

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
};

function extractText(html) {
  return html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&nbsp;/g, ' ')
    .replace(/&#\d+;/g, ' ')
    .replace(/&[a-z]+;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 6000);
}

async function fetchMenuText(websiteUrl) {
  if (!websiteUrl) return null;

  const base = websiteUrl.replace(/\/$/, '');

  // Try menu-specific paths first
  for (const path of ['/menu', '/menus', '/food', '/our-menu', '/food-menu', '/dine']) {
    try {
      const res = await axios.get(base + path, {
        timeout: 4000,
        headers: HEADERS,
        maxRedirects: 3,
        validateStatus: s => s === 200
      });
      const text = extractText(res.data);
      if (text.length > 300) return text;
    } catch {}
  }

  // Fall back to the homepage
  try {
    const res = await axios.get(websiteUrl, {
      timeout: 4000,
      headers: HEADERS,
      maxRedirects: 3,
      validateStatus: s => s === 200
    });
    return extractText(res.data);
  } catch {
    return null;
  }
}

module.exports = { fetchMenuText };
