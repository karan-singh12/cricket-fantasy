const db = require('./db');

const Contests = {
  async create({ match_id, entry_fee, prize_pool, max_participants, contest_type, created_by }) {
    const result = await db.query(
      'INSERT INTO contests (match_id, entry_fee, prize_pool, max_participants, contest_type, created_by, created_at) VALUES ($1, $2, $3, $4, $5, $6, NOW()) RETURNING *',
      [match_id, entry_fee, prize_pool, max_participants, contest_type, created_by]
    );
    return result.rows[0];
  },

  async findById(id) {
    const result = await db.query('SELECT * FROM contests WHERE id = $1', [id]);
    return result.rows[0];
  },

  async getByMatch(match_id) {
    const result = await db.query('SELECT * FROM contests WHERE match_id = $1', [match_id]);
    return result.rows;
  },

  async update(id, { match_id, entry_fee, prize_pool, max_participants, contest_type, created_by }) {
    const result = await db.query(
      'UPDATE contests SET match_id = $1, entry_fee = $2, prize_pool = $3, max_participants = $4, contest_type = $5, created_by = $6 WHERE id = $7 RETURNING *',
      [match_id, entry_fee, prize_pool, max_participants, contest_type, created_by, id]
    );
    return result.rows[0];
  },

  async delete(id) {
    const result = await db.query('DELETE FROM contests WHERE id = $1 RETURNING *', [id]);
    return result.rows[0];
  },
};

module.exports = Contests;