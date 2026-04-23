function getOpenTableLink(name, city, dateTime, partySize) {
  const query = encodeURIComponent(`${name} ${city}`);
  const dt = dateTime ? `&dateTime=${encodeURIComponent(dateTime)}` : '';
  return `https://www.opentable.com/s/?query=${query}&covers=${partySize}${dt}`;
}

function getResyLink(name, city, date, partySize) {
  const query = encodeURIComponent(name);
  const citySlug = (city || 'nyc').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-$/, '');
  return `https://resy.com/cities/${citySlug}?date=${date}&seats=${partySize}&query=${query}`;
}

function getGoogleMapsLink(name, address) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${name} ${address}`)}`;
}

module.exports = { getOpenTableLink, getResyLink, getGoogleMapsLink };
