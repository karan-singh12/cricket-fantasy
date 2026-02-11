const axios = require('axios');

// Configurable API endpoint
let API_BASE_URL = process.env.CRICKET_API_BASE_URL || 'https://example.com/api';

function setApiBaseUrl(url) {
  API_BASE_URL = url;
}

async function fetchMatches() {
  const response = await axios.get(`${API_BASE_URL}/matches`);
  return response.data;
}

async function fetchTournaments() {
  const response = await axios.get(`${API_BASE_URL}/tournaments`);
  return response.data;
}

async function fetchPlayers() {
  const response = await axios.get(`${API_BASE_URL}/players`);
  return response.data;
}

module.exports = {
  fetchMatches,
  fetchTournaments,
  fetchPlayers,
  setApiBaseUrl
};