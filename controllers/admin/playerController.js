const { knex: db } = require('../../config/database');
const apiResponse = require('../../utils/apiResponse');
const { slugGenrator } = require('../../utils/functions');
const { USER, ERROR, SUCCESS } = require('../../utils/responseMsg');

const playerController = {
    async getAllPlayers(req, res) {
        try {
            const players = await db('players')
                .select('players.*', 'teams.name as team_name')
                .leftJoin('teams', 'players.team_id', 'teams.id')
                .orderBy('players.name');

            res.json(players);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    },

    async createPlayer(req, res) {
        try {
            const {
                name,
                team_id,
                role,
                base_price,
                batting_style,
                bowling_style,
                nationality,
                date_of_birth
            } = req.body;



            // Validate team exists
            const team = await db('teams').where('id', team_id).first();
            if (!team) {
                return res.status(400).json({ error: 'Invalid team' });
            }

            // Validate role
            if (!['batsman', 'bowler', 'all-rounder', 'wicket-keeper'].includes(role)) {
                return res.status(400).json({ error: 'Invalid role' });
            }

            const [player] = await db('players')
                .insert({
                    name,
                    team_id,
                    role,
                    base_price,
                    batting_style,
                    bowling_style,
                    nationality,
                    date_of_birth
                })
                .returning('*');

            res.status(201).json(player);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    },

    async updatePlayer(req, res) {
        try {
            const { id } = req.params;
            const {
                name,
                team_id,
                role,
                base_price,
                batting_style,
                bowling_style,
                nationality,
                date_of_birth
            } = req.body;

            if (team_id) {
                const team = await db('teams').where('id', team_id).first();
                if (!team) {
                    return res.status(400).json({ error: 'Invalid team' });
                }
            }

            if (role && !['batsman', 'bowler', 'all-rounder', 'wicket-keeper'].includes(role)) {
                return res.status(400).json({ error: 'Invalid role' });
            }

            const [player] = await db('players')
                .where('id', id)
                .update({
                    name,
                    team_id,
                    role,
                    base_price,
                    batting_style,
                    bowling_style,
                    nationality,
                    date_of_birth,
                    updated_at: db.fn.now()
                })
                .returning('*');

            if (!player) {
                return res.status(404).json({ error: 'Player not found' });
            }

            res.json(player);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    },

    async updatePlayerStatus(req, res) {
        try {
            const { id } = req.params;
            const { is_active } = req.body;

            const [player] = await db('players')
                .where('id', id)
                .update({
                    is_active,
                    updated_at: db.fn.now()
                })
                .returning('*');

            if (!player) {
                return res.status(404).json({ error: 'Player not found' });
            }

            res.json(player);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    },

    async updatePlayerStats(req, res) {
        try {
            const { id } = req.params;
            const {
                match_id,
                runs_scored,
                balls_faced,
                fours,
                sixes,
                wickets_taken,
                overs_bowled,
                runs_conceded,
                catches_taken,
                stumpings,
                run_outs
            } = req.body;

            // Validate player and match exist
            const player = await db('players').where('id', id).first();
            const match = await db('matches').where('id', match_id).first();

            if (!player || !match) {
                return res.status(400).json({ error: 'Invalid player or match' });
            }

            // Calculate fantasy points based on stats
            const fantasyPoints = calculateFantasyPoints({
                runs_scored,
                balls_faced,
                fours,
                sixes,
                wickets_taken,
                overs_bowled,
                runs_conceded,
                catches_taken,
                stumpings,
                run_outs
            });

            const [stats] = await db('player_stats')
                .insert({
                    player_id: id,
                    match_id,
                    runs_scored,
                    balls_faced,
                    fours,
                    sixes,
                    wickets: wickets_taken,
                    overs_bowled,
                    runs_conceded,
                    catches: catches_taken,
                    stumpings,
                    run_outs,
                    fantasy_points: fantasyPoints
                })
                .onConflict(['player_id', 'match_id'])
                .merge()
                .returning('*');

            res.json(stats);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    },

    async getPlayersByTeam(req, res) {
        try {
            const { teamId } = req.params;

            const players = await db('players')
                .select('players.*')
                .where('team_id', teamId)
                .orderBy('name');

            res.json(players);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    },

    async getPlayersByMatch(req, res) {
        try {
            const { matchId } = req.params;

            const match = await db('matches')
                .where('id', matchId)
                .first();

            if (!match) {
                return res.status(404).json({ error: 'Match not found' });
            }

            const players = await db('players')
                .select('players.*', 'teams.name as team_name')
                .leftJoin('teams', 'players.team_id', 'teams.id')
                .where('team_id', match.team1_id)
                .orWhere('team_id', match.team2_id)
                .orderBy(['teams.name', 'players.name']);

            res.json(players);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    },

    async deletePlayer(req, res) {
        try {
            const { id } = req.params;

            // Check if player exists in any fantasy teams
            const fantasyTeamCount = await db('fantasy_team_players')
                .where('player_id', id)
                .count()
                .first();

            if (parseInt(fantasyTeamCount.count) > 0) {
                return res.status(400).json({ error: 'Cannot delete player who is part of fantasy teams' });
            }

            const deleted = await db('players')
                .where('id', id)
                .del();

            if (!deleted) {
                return res.status(404).json({ error: 'Player not found' });
            }

            res.json({ message: 'Player deleted successfully' });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    },

    async updatePlayersWithRandomData(req, res) {
        try {
            const players = await db('players').select('id');

            for (const player of players) {
                await db('players')
                    .where({ id: player.id })
                    .update({
                        points: Math.floor(Math.random() * (300 - 80 + 1)) + 80,
                        credits: parseFloat((Math.random() * (11.0 - 7.0) + 7.0).toFixed(1)),
                        is_played_last_match: Math.random() < 0.5,
                        selected_by_percentage: parseFloat((Math.random() * 100).toFixed(2)),
                        updated_at: db.fn.now()
                    });
            }

            return res.status(200).json({
                success: true,
                message: `✅ Updated ${players.length} players with random data.`,
            });
        } catch (error) {
            console.error('❌ Error updating players:', error);
            return res.status(500).json({
                success: false,
                message: 'Failed to update players.',
                error: error.message,
            });
        }
    },
};


// Helper function to calculate fantasy points
function calculateFantasyPoints(stats) {
    let points = 0;

    // Batting points
    points += stats.runs_scored * 1; // 1 point per run
    if (stats.runs_scored >= 50) points += 5; // Bonus for half-century
    if (stats.runs_scored >= 100) points += 10; // Bonus for century
    points += stats.fours * 1; // 1 point per four
    points += stats.sixes * 2; // 2 points per six

    // Bowling points
    points += stats.wickets_taken * 25; // 25 points per wicket
    if (stats.wickets_taken >= 3) points += 5; // Bonus for 3+ wickets
    if (stats.wickets_taken >= 5) points += 10; // Bonus for 5+ wickets

    // Fielding points
    points += stats.catches_taken * 10; // 10 points per catch
    points += stats.stumpings * 15; // 15 points per stumping
    points += stats.run_outs * 10; // 10 points per run-out

    return points;
}

module.exports = playerController; 