const db = require('./db');

const MatchPlayers = {
  async create({ match_id, player_id, is_playing_xi, is_substitute }) {
    const result = await db.query(
      'INSERT INTO match_players (match_id, player_id, is_playing_xi, is_substitute) VALUES ($1, $2, $3, $4) RETURNING *',
      [match_id, player_id, is_playing_xi, is_substitute]
    );
    return result.rows[0];
  },

  async findByMatch(match_id) {
    const result = await db.query('SELECT * FROM match_players WHERE match_id = $1', [match_id]);
    return result.rows;
  },

  async findByPlayer(player_id) {
    const result = await db.query('SELECT * FROM match_players WHERE player_id = $1', [player_id]);
    return result.rows;
  },

  async update(id, { match_id, player_id, is_playing_xi, is_substitute }) {
    const result = await db.query(
      'UPDATE match_players SET match_id = $1, player_id = $2, is_playing_xi = $3, is_substitute = $4 WHERE id = $5 RETURNING *',
      [match_id, player_id, is_playing_xi, is_substitute, id]
    );
    return result.rows[0];
  },

  async delete(id) {
    const result = await db.query('DELETE FROM match_players WHERE id = $1 RETURNING *', [id]);
    return result.rows[0];
  },
};

module.exports = MatchPlayers;