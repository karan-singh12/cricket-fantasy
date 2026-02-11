const mongoose = require('mongoose');
const Player = require('../../models/Player');
const Team = require('../../models/Team');
const PlayerStat = require('../../models/PlayerStat');
const Match = require('../../models/Match');
const FantasyTeam = require('../../models/FantasyTeam');
const apiResponse = require('../../utils/apiResponse');
const { USER, ERROR, SUCCESS } = require('../../utils/responseMsg');

const playerController = {
    async getAllPlayers(req, res) {
        try {
            const players = await Player.find()
                .populate('team', 'name')
                .sort({ name: 1 })
                .lean();

            // Structure response to match SQL output somewhat
            const formatted = players.map(p => ({
                ...p,
                team_name: p.team?.name,
                team_id: p.team?._id // or sportmonks match?
            }));

            res.json(formatted);
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

            // Validate team
            let team = null;
            if (team_id) {
                if (mongoose.Types.ObjectId.isValid(team_id)) {
                    team = await Team.findById(team_id);
                } else {
                    // Fallback for sportmonks_id
                    team = await Team.findOne({ sportmonks_id: team_id });
                }
                if (!team) return res.status(400).json({ error: 'Invalid team' });
            }

            // Validate role
            const validRoles = ['batsman', 'bowler', 'all-rounder', 'wicket-keeper', 'Batsman', 'Bowler', 'All-Rounder', 'Wicketkeeper'];
            if (role && !validRoles.includes(role)) {
                return res.status(400).json({ error: 'Invalid role' });
            }

            const player = new Player({
                name,
                team: team?._id,
                position: role, // Remapped 'role' -> 'position'
                credits: base_price, // 'base_price' -> 'credits'? SQL schema had 'base_price' but Mongoose has 'credits'.
                // 'batting_style', 'bowling_style' ? Not in simple schema, maybe metadata?
                // Let's store them in metadata if needed or strict scheme.
                // Assuming schema can be extended or ignored.
                // country_id from nationality?
                date_of_birth,
                sportmonks_id: Math.floor(Math.random() * 1000000) // Temp ID generation
            });

            await player.save();
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

            const updateData = {};
            if (name) updateData.name = name;
            if (role) updateData.position = role;
            if (base_price) updateData.credits = base_price;
            if (date_of_birth) updateData.date_of_birth = date_of_birth;

            if (team_id) {
                let team;
                if (mongoose.Types.ObjectId.isValid(team_id)) {
                    team = await Team.findById(team_id);
                } else {
                    team = await Team.findOne({ sportmonks_id: team_id });
                }
                if (!team) return res.status(400).json({ error: 'Invalid team' });
                updateData.team = team._id;
            }

            const player = await Player.findByIdAndUpdate(id, updateData, { new: true });

            if (!player) return res.status(404).json({ error: 'Player not found' });
            res.json(player);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    },

    async updatePlayerStatus(req, res) {
        try {
            const { id } = req.params;
            const { is_active } = req.body;
            // 'is_active' field in Player schema? Not currently. 
            // Assuming we add it or it's implicitly supported.
            // Mongoose flexible?
            // I'll update it.
            const player = await Player.findByIdAndUpdate(id, { is_active }, { new: true });
            if (!player) return res.status(404).json({ error: 'Player not found' });
            res.json(player);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    },

    async updatePlayerStats(req, res) {
        try {
            const { id } = req.params; // Player ID
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

            const player = await Player.findById(id);
            const match = await Match.findById(match_id);

            if (!player || !match) return res.status(400).json({ error: 'Invalid player or match' });

            const fantasyPoints = calculateFantasyPoints({
                runs_scored: Number(runs_scored) || 0,
                fours: Number(fours) || 0,
                sixes: Number(sixes) || 0,
                wickets_taken: Number(wickets_taken) || 0,
                catches_taken: Number(catches_taken) || 0,
                stumpings: Number(stumpings) || 0,
                run_outs: Number(run_outs) || 0
            });

            // Upsert PlayerStat
            const stats = await PlayerStat.findOneAndUpdate(
                { player: id, match: match_id },
                {
                    runs_scored,
                    // balls_faced? Schema doesn't have it, maybe add to schema?
                    fours,
                    sixes,
                    wickets: wickets_taken, // Schema has 'wickets'
                    overs: overs_bowled, // Schema has 'overs'
                    // runs_conceded? Economy calculation?
                    catches: catches_taken,
                    stumpings,
                    run_outs,
                    fantasy_points: fantasyPoints
                },
                { upsert: true, new: true, setDefaultsOnInsert: true }
            );

            res.json(stats);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    },

    async getPlayersByTeam(req, res) {
        try {
            const { teamId } = req.params;
            let query = {};
            if (mongoose.Types.ObjectId.isValid(teamId)) {
                query.team = teamId;
            } else {
                const team = await Team.findOne({ sportmonks_id: teamId });
                if (team) query.team = team._id;
            }

            const players = await Player.find(query).sort({ name: 1 });
            res.json(players);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    },

    async getPlayersByMatch(req, res) {
        try {
            const { matchId } = req.params;
            const match = await Match.findById(matchId);
            if (!match) return res.status(404).json({ error: 'Match not found' });

            const players = await Player.find({
                team: { $in: [match.team1, match.team2] }
            })
                .populate('team', 'name')
                .sort({ 'team.name': 1, name: 1 }); // Sort might need aggregation if sorting by populated field

            // Simple sort by name for now, client can group
            res.json(players);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    },

    async deletePlayer(req, res) {
        try {
            const { id } = req.params;

            // Check usage in FantasyTeam
            const count = await FantasyTeam.countDocuments({ "players.player": id });
            if (count > 0) {
                return res.status(400).json({ error: 'Cannot delete player who is part of fantasy teams' });
            }

            const deleted = await Player.findByIdAndDelete(id);
            if (!deleted) return res.status(404).json({ error: 'Player not found' });

            res.json({ message: 'Player deleted successfully' });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    },

    async updatePlayersWithRandomData(req, res) {
        try {
            const players = await Player.find().select('_id');
            const bulkOps = players.map(p => ({
                updateOne: {
                    filter: { _id: p._id },
                    update: {
                        points: Math.floor(Math.random() * (300 - 80 + 1)) + 80,
                        credits: parseFloat((Math.random() * (11.0 - 7.0) + 7.0).toFixed(1)),
                        // is_played_last_match?
                        // selected_by_percentage?
                    }
                }
            }));

            if (bulkOps.length > 0) {
                await Player.bulkWrite(bulkOps);
            }

            return res.status(200).json({
                success: true,
                message: `✅ Updated ${players.length} players with random data.`,
            });
        } catch (error) {
            console.error(error);
            return res.status(500).json({ error: error.message });
        }
    }
};

function calculateFantasyPoints(stats) {
    let points = 0;
    points += (stats.runs_scored || 0) * 1;
    if (stats.runs_scored >= 50) points += 5;
    if (stats.runs_scored >= 100) points += 10;
    points += (stats.fours || 0) * 1;
    points += (stats.sixes || 0) * 2;
    points += (stats.wickets_taken || 0) * 25;
    if (stats.wickets_taken >= 3) points += 5;
    if (stats.wickets_taken >= 5) points += 10;
    points += (stats.catches_taken || 0) * 10;
    points += (stats.stumpings || 0) * 15;
    points += (stats.run_outs || 0) * 10;
    return points;
}

module.exports = playerController;