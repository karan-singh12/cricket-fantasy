const cron = require('node-cron');
const axios = require('axios');
const mongoose = require('mongoose');
const Team = require('../models/Team');
const Match = require('../models/Match');

// Helper function to get or create team
async function getOrCreateTeam(teamData, session) {
    let team = await Team.findOne({ name: teamData.name }).session(session);

    if (team) return team._id;

    const [newTeam] = await Team.create([{
        name: teamData.name,
        short_name: teamData.shortName,
        logo_url: teamData.logoUrl,
        country_id: teamData.country // Assuming country maps to country_id
    }], { session });

    return newTeam._id;
}

// Function to sync matches
async function syncMatches() {
    try {
        const response = await axios.get(process.env.CRICKET_API_URL + '/matches');
        const matches = response.data;

        const session = await mongoose.startSession();
        session.startTransaction();

        try {
            for (const match of matches) {
                const team1Id = await getOrCreateTeam(match.team1, session);
                const team2Id = await getOrCreateTeam(match.team2, session);

                await Match.findOneAndUpdate(
                    { team1: team1Id, team2: team2Id, start_time: new Date(match.startTime) },
                    {
                        $set: {
                            venue: match.venue,
                            match_type: match.matchType,
                            status: 'upcoming',
                            is_visible: false
                        }
                    },
                    { upsert: true, session }
                );
            }

            await session.commitTransaction();
            console.log('Match sync successful');
        } catch (error) {
            await session.abortTransaction();
            throw error;
        } finally {
            session.endSession();
        }
    } catch (error) {
        console.error('Match sync failed:', error);
    }
}

// Schedule cron job to run every hour
cron.schedule('0 * * * *', syncMatches);

module.exports = { syncMatches };