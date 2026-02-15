const cron = require('node-cron');
const axios = require('axios');
const db = require('../config/database');

// Helper function to get or create team
async function getOrCreateTeam(teamData, trx) {
    const team = await trx('teams')
        .where('name', teamData.name)
        .first();

    if (team) return team.id;

    const [newTeam] = await trx('teams')
        .insert({
            name: teamData.name,
            short_name: teamData.shortName,
            logo_url: teamData.logoUrl,
            country: teamData.country
        })
        .returning('id');

    return newTeam.id;
}

// Function to sync matches
async function syncMatches() {
   
    try {
        // Fetch matches from external API
        const response = await axios.get(process.env.CRICKET_API_URL + '/matches');
        const matches = response.data;

        // Begin transaction
        const trx = await db.transaction();

        try {
            for (const match of matches) {
                // Check if teams exist, create if not
                const team1Id = await getOrCreateTeam(match.team1, trx);
                const team2Id = await getOrCreateTeam(match.team2, trx);

                // Update or create match
                await trx('matches')
                    .insert({
                        team1_id: team1Id,
                        team2_id: team2Id,
                        start_time: match.startTime,
                        venue: match.venue,
                        match_type: match.matchType,
                        status: 'upcoming',
                        is_visible: false // Admin needs to make it visible
                    })
                    .onConflict(['team1_id', 'team2_id', 'start_time'])
                    .merge();
            }

            await trx.commit();
         
        } catch (error) {
            await trx.rollback();
            throw error;
        }
    } catch (error) {
        console.error('Match sync failed:', error);
    }
}

// Schedule cron job to run every hour
cron.schedule('0 * * * *', syncMatches);

// Export for manual execution
module.exports = {
    syncMatches
}; 