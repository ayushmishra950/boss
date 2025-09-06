
const axios = require('axios');

async function geocodeLocation(locationName) {
  const response = await axios.get('https://nominatim.openstreetmap.org/search', {
    params: {
      q: locationName,
      format: 'json',
      limit: 1,
    },
    headers: {
      'User-Agent': 'Instagram-Clone-App',
    }
  });

  const data = response.data[0];
  if (!data) {
    throw new Error('Location not found');
  }

  return {
    lat: parseFloat(data.lat),
    lon: parseFloat(data.lon),
  };
}



module.exports = {geocodeLocation};
