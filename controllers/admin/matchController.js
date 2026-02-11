const{knex:db} = require('../../config/database');
const axios = require('axios');
const apiResponse = require('../../utils/apiResponse');
const { slugGenrator } = require('../../utils/functions');
const { USER, ERROR, SUCCESS } = require('../../utils/responseMsg');


const matchController = {
    async getAllMatches(req, res) {
        try {
            let {
                pageSize ,
                pageNumber,
                searchItem = "",
                sortOrder = "asc",
                status = []
              } = req.body;

              pageSize = parseInt(pageSize);
              pageNumber = Math.max(1, parseInt(pageNumber));
              const offset = (pageNumber - 1) * pageSize;
            let query = db('matches').where('matches.status', 'NS');

            if (status.length > 0) {
                query.andWhere(qb => qb.whereIn('matches.status', status));
            }

            if (searchItem) {
                query.andWhere(builder =>
                    builder
                        // .whereILike('name', `%${searchItem}%`)
                        // .orWhereILike('email', `%${searchItem}%`)
                );
            }

            const totalRecords = await query.clone().count().first();

            const result = await query
                .select('matches.*',
                    't1.name as team1_name',
                    't2.name as team2_name',
                    'tournaments.name as tournament_name')
                .leftJoin('teams as t1', 'matches.team1_id', 't1.id')
                .leftJoin('teams as t2', 'matches.team2_id', 't2.id')
                .leftJoin('tournaments', 'matches.tournament_id', 'tournaments.id')
                .orderBy('start_time', sortOrder)
                
                .limit(pageSize)
                .offset(offset);

            return apiResponse.successResponseWithData(res, SUCCESS.dataFound, {
                result,
                totalRecords: parseInt(totalRecords.count) || 0,
                pageNumber: pageNumber,
                pageSize,
            });
        } catch (error) {
            console.log(error.message);
            return apiResponse.ErrorResponse(res, ERROR.somethingWrong);
        }
    },
    

    async syncMatches(req, res) {
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
                            status: 'upcoming'
                        })
                        .onConflict(['team1_id', 'team2_id', 'start_time'])
                        .merge();
                }

                await trx.commit();
                res.json({ message: 'Matches synced successfully' });
            } catch (error) {
                await trx.rollback();
                throw error;
            }
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    },

    async updateMatchVisibility(req, res) {
        try {
            const { id } = req.params;
            const { is_visible } = req.body;

            const [match] = await db('matches')
                .where('id', id)
                .update({
                    is_visible,
                    updated_at: db.fn.now()
                })
                .returning('*');

            if (!match) {
                return res.status(404).json({ error: 'Match not found' });
            }

            res.json(match);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    },

    async updateMatchStatus(req, res) {
        try {
            const { id } = req.params;
            const { status } = req.body;

            if (!['upcoming', 'live', 'completed', 'cancelled'].includes(status)) {
                return res.status(400).json({ error: 'Invalid status' });
            }

            const [match] = await db('matches')
                .where('id', id)
                .update({
                    status,
                    updated_at: db.fn.now()
                })
                .returning('*');

            if (!match) {
                return res.status(404).json({ error: 'Match not found' });
            }

            res.json(match);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    },

    async updateMatchResult(req, res) {
        try {
            const { id } = req.params;
            const { winning_team_id, match_result } = req.body;

            const [match] = await db('matches')
                .where('id', id)
                .update({
                    winning_team_id,
                    match_result,
                    status: 'completed',
                    updated_at: db.fn.now()
                })
                .returning('*');

            if (!match) {
                return res.status(404).json({ error: 'Match not found' });
            }

            res.json(match);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    },

    async deleteMatch(req, res) {
        try {
            const { id } = req.params;

            const deleted = await db('matches')
                .where('id', id)
                .del();

            if (!deleted) {
                return res.status(404).json({ error: 'Match not found' });
            }

            res.json({ message: 'Match deleted successfully' });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
};

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

module.exports = matchController; 