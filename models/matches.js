const db = require('./db');

const Matches = {
  async create({ tournament_id, team1_id, team2_id, venue, start_time, status, winner_team_id }) {
    const result = await db.query(
      'INSERT INTO matches (tournament_id, team1_id, team2_id, venue, start_time, status, winner_team_id) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *',
      [tournament_id, team1_id, team2_id, venue, start_time, status, winner_team_id]
    );
    return result.rows[0];
  },

  async findById(id) {
    const result = await db.query('SELECT * FROM matches WHERE id = $1', [id]);
    return result.rows[0];
  },

  async getAll() {
    const result = await db.query('SELECT * FROM matches');
    return result.rows;
  },

  async getByTournament(tournament_id) {
    const result = await db.query('SELECT * FROM matches WHERE tournament_id = $1', [tournament_id]);
    return result.rows;
  },

  async update(id, { tournament_id, team1_id, team2_id, venue, start_time, status, winner_team_id }) {
    const result = await db.query(
      'UPDATE matches SET tournament_id = $1, team1_id = $2, team2_id = $3, venue = $4, start_time = $5, status = $6, winner_team_id = $7 WHERE id = $8 RETURNING *',
      [tournament_id, team1_id, team2_id, venue, start_time, status, winner_team_id, id]
    );
    return result.rows[0];
  },

  async delete(id) {
    const result = await db.query('DELETE FROM matches WHERE id = $1 RETURNING *', [id]);
    return result.rows[0];
  },
};

module.exports = Matches;