exports.up = function (knex) {
    return knex.schema.createTable('players', function (table) {
        table.increments('id').primary();
        table.string('name').notNullable();
        table.string('player_id').unique();
        table.string('role'); // batsman, bowler, all-rounder
        table.string('batting_style');
        table.string('bowling_style');
        table.date('date_of_birth');
        table.string('nationality');
        table.integer('team_id').references('id').inTable('teams');
        table.jsonb('metadata');
        table.timestamp('created_at').defaultTo(knex.fn.now());
        table.timestamp('updated_at').defaultTo(knex.fn.now());
    });
};

exports.down = function (knex) {
    return knex.schema.dropTable('players');
}; 