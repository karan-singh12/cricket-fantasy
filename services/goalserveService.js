const axios = require('axios');
const config = require('../config/config');

class GoalserveService {
    constructor() {
        this.baseURL = 'http://www.goalserve.com/getfeed';
        this.apiKey = process.env.CRICKET_API_KEY || '2b705557ec6f478f745f08dd8865ef3a';
    }

    // Live scores and match details
    async getLiveScores() {
        try {
            const response = await axios.get(`${this.baseURL}/${this.apiKey}/cricket/livescore?json=1`);
            return response.data;
        } catch (error) {
            console.error('Error fetching live scores:', error);
            throw error;
        }
    }

    // Match schedules and fixtures
    async getFixtures() {
        try {
            const response = await axios.get(`${this.baseURL}/${this.apiKey}/cricket/schedule?json=1`);
            return response.data;
        } catch (error) {
            console.error('Error fetching fixtures:', error);
            throw error;
        }
    }

    async getFixturesWithOdds() {
        try {
            const response = await axios.get(`${this.baseURL}/${this.apiKey}/cricket/schedule1?json=1`);
            return response.data;
        } catch (error) {
            console.error('Error fetching fixtures with odds:', error);
            throw error;
        }
    }

    // Player information
    async getPlayerProfile(profileId) {
        try {
            const response = await axios.get(`${this.baseURL}/${this.apiKey}/cricket/profile?json=1&id=${profileId}`);
            return response.data;
        } catch (error) {
            console.error('Error fetching player profile:', error);
            throw error;
        }
    }

    // Tournament and series information
    async getUpcomingTours() {
        try {
            const response = await axios.get(`${this.baseURL}/${this.apiKey}/cricketfixtures/tours/tours?json=1`);
            return response.data;
        } catch (error) {
            console.error('Error fetching upcoming tours:', error);
            throw error;
        }
    }

    // IPL specific endpoints
    async getIPLFixtures() {
        try {
            const response = await axios.get(`${this.baseURL}/${this.apiKey}/cricketfixtures/india/ipl?json=1`);
            return response.data;
        } catch (error) {
            console.error('Error fetching IPL fixtures:', error);
            throw error;
        }
    }

    async getIPLSquads() {
        try {
            const response = await axios.get(`${this.baseURL}/${this.apiKey}/cricketfixtures/india/ipl_squads?json=1`);
            return response.data;
        } catch (error) {
            console.error('Error fetching IPL squads:', error);
            throw error;
        }
    }

    async getIPLTable() {
        try {
            const response = await axios.get(`${this.baseURL}/${this.apiKey}/cricketfixtures/india/ipl_table?json=1`);
            return response.data;
        } catch (error) {
            console.error('Error fetching IPL table:', error);
            throw error;
        }
    }

    // International series
    async getInternationalSeries(series) {
        try {
            const response = await axios.get(`${this.baseURL}/${this.apiKey}/cricketfixtures/intl/${series}?json=1`);
            return response.data;
        } catch (error) {
            console.error(`Error fetching ${series} fixtures:`, error);
            throw error;
        }
    }

    async getInternationalSeriesSquads(series) {
        try {
            const response = await axios.get(`${this.baseURL}/${this.apiKey}/cricketfixtures/intl/${series}_squads?json=1`);
            return response.data;
        } catch (error) {
            console.error(`Error fetching ${series} squads:`, error);
            throw error;
        }
    }

    // Tour matches
    async getTourFixtures(tour) {
        try {
            const response = await axios.get(`${this.baseURL}/${this.apiKey}/cricketfixtures/tours/${tour}?json=1`);
            return response.data;
        } catch (error) {
            console.error(`Error fetching ${tour} fixtures:`, error);
            throw error;
        }
    }

    async getTourSquads(tour) {
        try {
            const response = await axios.get(`${this.baseURL}/${this.apiKey}/cricketfixtures/tours/${tour}_squads?json=1`);
            return response.data;
        } catch (error) {
            console.error(`Error fetching ${tour} squads:`, error);
            throw error;
        }
    }

    // Domestic tournaments
    async getDomesticFixtures(country, tournament) {
        try {
            const response = await axios.get(`${this.baseURL}/${this.apiKey}/cricketfixtures/${country}/${tournament}?json=1`);
            return response.data;
        } catch (error) {
            console.error(`Error fetching ${tournament} fixtures:`, error);
            throw error;
        }
    }

    // Match odds and predictions
    async getOdds(country) {
        try {
            const response = await axios.get(`${this.baseURL}/${this.apiKey}/cricketfixtures/odds/${country}_shedule?json=1`);
            return response.data;
        } catch (error) {
            console.error(`Error fetching ${country} odds:`, error);
            throw error;
        }
    }

    // Team information
    async getTeamSquads(series, team) {
        try {
            const response = await axios.get(`${this.baseURL}/${this.apiKey}/cricketfixtures/${series}/${team}_squads?json=1`);
            return response.data;
        } catch (error) {
            console.error(`Error fetching ${team} squads:`, error);
            throw error;
        }
    }

    // Match statistics
    async getMatchStats(matchId) {
        try {
            const response = await axios.get(`${this.baseURL}/${this.apiKey}/cricket/match/${matchId}?json=1`);
            return response.data;
        } catch (error) {
            console.error(`Error fetching match stats:`, error);
            throw error;
        }
    }

    // Player statistics
    async getPlayerStats(playerId) {
        try {
            const response = await axios.get(`${this.baseURL}/${this.apiKey}/cricket/player/${playerId}/stats?json=1`);
            return response.data;
        } catch (error) {
            console.error(`Error fetching player stats:`, error);
            throw error;
        }
    }

    // Series standings and points table
    async getSeriesStandings(series) {
        try {
            const response = await axios.get(`${this.baseURL}/${this.apiKey}/cricketfixtures/${series}_table?json=1`);
            return response.data;
        } catch (error) {
            console.error(`Error fetching ${series} standings:`, error);
            throw error;
        }
    }

    // Tournament squads
    async getTournamentSquads(squadsFile) {
        try {
            const response = await axios.get(`${this.baseURL}/${this.apiKey}/cricketfixtures/${squadsFile}?json=1`);
            return response.data;
        } catch (error) {
            console.error('Error fetching tournament squads:', error);
            throw error;
        }
    }

    // Get tournament matches
    async getTournamentMatches(filePath) {
        try {
            const response = await axios.get(`${this.baseURL}/${this.apiKey}/cricketfixtures${filePath}?json=1`);
            return response.data;
        } catch (error) {
            console.error('Error fetching tournament matches:', error);
            throw error;
        }
    }
}

module.exports = new GoalserveService();



