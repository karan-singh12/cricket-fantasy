const knex = require('../config/database');

class Tournaments {
  static tableName = 'tournaments';

  static async create(tournamentData) {
    return knex(this.tableName).insert(tournamentData).returning('*');
  }

  static async findAll() {
    return knex(this.tableName).select('*');
  }

  static async findById(id) {
    return knex(this.tableName).where({ id }).first();
  }

  static async update(id, tournamentData) {
    return knex(this.tableName)
      .where({ id })
      .update(tournamentData)
      .returning('*');
  }

  static async delete(id) {
    return knex(this.tableName).where({ id }).del();
  }
}

module.exports = Tournaments;