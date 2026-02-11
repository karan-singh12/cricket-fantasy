const db = require('./db');

const FantasyTeams = {
  async create({ user_id, match_id, captain_id, vice_captain_id }) {
    const result = await db.query(
      'INSERT INTO fantasy_teams (user_id, match_id, captain_id, vice_captain_id, created_at) VALUES ($1, $2, $3, $4, NOW()) RETURNING *',
      [user_id, match_id, captain_id, vice_captain_id]
    );
    return result.rows[0];
  },

  async findById(id) {
    const result = await db.query('SELECT * FROM fantasy_teams WHERE id = $1', [id]);
    return result.rows[0];
  },

  async getByUserAndMatch(user_id, match_id) {
    const result = await db.query('SELECT * FROM fantasy_teams WHERE user_id = $1 AND match_id = $2', [user_id, match_id]);
    return result.rows;
  },

  async update(id, { user_id, match_id, captain_id, vice_captain_id }) {
    const result = await db.query(
      'UPDATE fantasy_teams SET user_id = $1, match_id = $2, captain_id = $3, vice_captain_id = $4 WHERE id = $5 RETURNING *',
      [user_id, match_id, captain_id, vice_captain_id, id]
    );
    return result.rows[0];
  },

  async delete(id) {
    const result = await db.query('DELETE FROM fantasy_teams WHERE id = $1 RETURNING *', [id]);
    return result.rows[0];
  },
};

module.exports = FantasyTeams;