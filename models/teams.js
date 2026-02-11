const db = require('./db');

const Teams = {
  async create({ name, short_code, logo_url }) {
    const result = await db.query(
      'INSERT INTO teams (name, short_code, logo_url) VALUES ($1, $2, $3) RETURNING *',
      [name, short_code, logo_url]
    );
    return result.rows[0];
  },

  async findById(id) {
    const result = await db.query('SELECT * FROM teams WHERE id = $1', [id]);
    return result.rows[0];
  },

  async getAll() {
    const result = await db.query('SELECT * FROM teams');
    return result.rows;
  },

  async update(id, { name, short_code, logo_url }) {
    const result = await db.query(
      'UPDATE teams SET name = $1, short_code = $2, logo_url = $3 WHERE id = $4 RETURNING *',
      [name, short_code, logo_url, id]
    );
    return result.rows[0];
  },

  async delete(id) {
    const result = await db.query('DELETE FROM teams WHERE id = $1 RETURNING *', [id]);
    return result.rows[0];
  },
};

module.exports = Teams;