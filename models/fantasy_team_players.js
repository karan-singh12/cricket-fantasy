const db = require('./db');

const FantasyTeamPlayers = {
  async create({ fantasy_team_id, player_id }) {
    const result = await db.query(
      'INSERT INTO fantasy_team_players (fantasy_team_id, player_id) VALUES ($1, $2) RETURNING *',
      [fantasy_team_id, player_id]
    );
    return result.rows[0];
  },

  async findByFantasyTeam(fantasy_team_id) {
    const result = await db.query('SELECT * FROM fantasy_team_players WHERE fantasy_team_id = $1', [fantasy_team_id]);
    return result.rows;
  }
};

module.exports = FantasyTeamPlayers;