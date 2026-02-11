const db = require('./db');

const FantasyPoints = {
  async create({ player_id, match_id, points }) {
    const result = await db.query(
      'INSERT INTO fantasy_points (player_id, match_id, points) VALUES ($1, $2, $3) RETURNING *',
      [player_id, match_id, points]
    );
    return result.rows[0];
  },

  async findByPlayerAndMatch(player_id, match_id) {
    const result = await db.query('SELECT * FROM fantasy_points WHERE player_id = $1 AND match_id = $2', [player_id, match_id]);
    return result.rows[0];
  },

  async findByMatch(match_id) {
    const result = await db.query('SELECT * FROM fantasy_points WHERE match_id = $1', [match_id]);
    return result.rows;
  }
};

module.exports = FantasyPoints;