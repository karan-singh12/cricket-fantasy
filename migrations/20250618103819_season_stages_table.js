/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
    return knex.schema.createTable('season_stages', function(table) {
        table.increments('id').primary();
        table.integer('tournament_id').references('id').inTable('tournaments');
        table.integer('sm_season_id');
        table.integer('sm_league_id');
        table.integer('sm_stage_id');
        table.string('name');
        table.string('code');
        table.string('type');
        table.string('standings');
        table.timestamp('created_at').defaultTo(knex.fn.now());
        table.timestamp('updated_at').defaultTo(knex.fn.now());
    });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
    return knex.schema.dropTable('season_stages');
};
