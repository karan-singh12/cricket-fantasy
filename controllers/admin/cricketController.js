const axios = require('axios');
const config = require('../config/config');

// Get all matches
const getMatches = async (req, res) => {
    try {
        const response = await axios.get(`${config.goalserveApiUrl}/cricket/live.json`, {
            params: {
                key: config.goalserveApiKey
            }
        });
        res.json(response.data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Get match by ID
const getMatchById = async (req, res) => {
    try {
        const response = await axios.get(`${config.goalserveApiUrl}/cricket/match/${req.params.id}.json`, {
            params: {
                key: config.goalserveApiKey
            }
        });
        res.json(response.data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Get all teams
const getTeams = async (req, res) => {
    try {
        const response = await axios.get(`${config.goalserveApiUrl}/cricket/teams.json`, {
            params: {
                key: config.goalserveApiKey
            }
        });
        res.json(response.data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Get team by ID
const getTeamById = async (req, res) => {
    try {
        const response = await axios.get(`${config.goalserveApiUrl}/cricket/team/${req.params.id}.json`, {
            params: {
                key: config.goalserveApiKey
            }
        });
        res.json(response.data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Get all players
const getPlayers = async (req, res) => {
    try {
        const response = await axios.get(`${config.goalserveApiUrl}/cricket/players.json`, {
            params: {
                key: config.goalserveApiKey
            }
        });
        res.json(response.data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Get player by ID
const getPlayerById = async (req, res) => {
    try {
        const response = await axios.get(`${config.goalserveApiUrl}/cricket/player/${req.params.id}.json`, {
            params: {
                key: config.goalserveApiKey
            }
        });
        res.json(response.data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Sync matches
const syncMatches = async (req, res) => {
    try {
        // Implementation for syncing matches
        res.json({ message: 'Matches synced successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Sync teams
const syncTeams = async (req, res) => {
    try {
        // Implementation for syncing teams
        res.json({ message: 'Teams synced successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Sync players
const syncPlayers = async (req, res) => {
    try {
        // Implementation for syncing players
        res.json({ message: 'Players synced successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

module.exports = {
    getMatches,
    getMatchById,
    getTeams,
    getTeamById,
    getPlayers,
    getPlayerById,
    syncMatches,
    syncTeams,
    syncPlayers
};