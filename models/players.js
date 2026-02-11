const db = require('./db');

const Players = {
  async create({ team_id, name, role, credit, image_url }) {
    const result = await db.query(
      'INSERT INTO players (team_id, name, role, credit, image_url) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [team_id, name, role, credit, image_url]
    );
    return result.rows[0];
  },

  async findById(id) {
    const result = await db.query('SELECT * FROM players WHERE id = $1', [id]);
    return result.rows[0];
  },

  async getAll() {
    const result = await db.query('SELECT * FROM players');
    return result.rows;
  },

  async getByTeam(team_id) {
    const result = await db.query('SELECT * FROM players WHERE team_id = $1', [team_id]);
    return result.rows;
  },

  async update(id, { team_id, name, role, credit, image_url }) {
    const result = await db.query(
      'UPDATE players SET team_id = $1, name = $2, role = $3, credit = $4, image_url = $5 WHERE id = $6 RETURNING *',
      [team_id, name, role, credit, image_url, id]
    );
    return result.rows[0];
  },

  async delete(id) {
    const result = await db.query('DELETE FROM players WHERE id = $1 RETURNING *', [id]);
    return result.rows[0];
  },
};

module.exports = Players;