const db = require('./db');

const PlayerStats = {
  async create({ match_id, player_id, runs, fours, sixes, wickets, overs, maiden_overs, economy, catches, stumpings, runouts, is_duck }) {
    const result = await db.query(
      'INSERT INTO player_stats (match_id, player_id, runs, fours, sixes, wickets, overs, maiden_overs, economy, catches, stumpings, runouts, is_duck, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, NOW()) RETURNING *',
      [match_id, player_id, runs, fours, sixes, wickets, overs, maiden_overs, economy, catches, stumpings, runouts, is_duck]
    );
    return result.rows[0];
  },

  async findByMatch(match_id) {
    const result = await db.query('SELECT * FROM player_stats WHERE match_id = $1', [match_id]);
    return result.rows;
  },

  async findByPlayer(player_id) {
    const result = await db.query('SELECT * FROM player_stats WHERE player_id = $1', [player_id]);
    return result.rows;
  },

  async update(id, { match_id, player_id, runs, fours, sixes, wickets, overs, maiden_overs, economy, catches, stumpings, runouts, is_duck }) {
    const result = await db.query(
      'UPDATE player_stats SET match_id = $1, player_id = $2, runs = $3, fours = $4, sixes = $5, wickets = $6, overs = $7, maiden_overs = $8, economy = $9, catches = $10, stumpings = $11, runouts = $12, is_duck = $13 WHERE id = $14 RETURNING *',
      [match_id, player_id, runs, fours, sixes, wickets, overs, maiden_overs, economy, catches, stumpings, runouts, is_duck, id]
    );
    return result.rows[0];
  },

  async delete(id) {
    const result = await db.query('DELETE FROM player_stats WHERE id = $1 RETURNING *', [id]);
    return result.rows[0];
  },
};

module.exports = PlayerStats;