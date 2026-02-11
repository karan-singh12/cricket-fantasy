const db = require('./db');

const UserContestEntries = {
  async create({ user_id, contest_id, fantasy_team_id, rank, winnings }) {
    const result = await db.query(
      'INSERT INTO user_contest_entries (user_id, contest_id, fantasy_team_id, rank, winnings) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [user_id, contest_id, fantasy_team_id, rank, winnings]
    );
    return result.rows[0];
  },

  async findByContest(contest_id) {
    const result = await db.query('SELECT * FROM user_contest_entries WHERE contest_id = $1', [contest_id]);
    return result.rows;
  },

  async findByUser(user_id) {
    const result = await db.query('SELECT * FROM user_contest_entries WHERE user_id = $1', [user_id]);
    return result.rows;
  }
};

module.exports = UserContestEntries;