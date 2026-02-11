exports.up = function (knex) {
    return knex.schema.createTable('matches', function (table) {
        table.increments('id').primary();
        table.integer('tournament_id').references('id').inTable('tournaments');
        table.integer('team1_id').references('id').inTable('teams');
        table.integer('team2_id').references('id').inTable('teams');
        table.integer('victory_team_id').references('id').inTable('teams').nullable();
        table.string('venue');
        table.string('city');
        table.string('country');
        table.string('match_number');
        table.string('match_type');
        table.timestamp('start_time');
        table.timestamp('end_time');
        table.string('status'); // upcoming, live, completed, cancelled
        table.string('toss');
        table.string('man_of_match');
        table.string('referee');
        table.jsonb('scorecard');
        table.jsonb('metadata');
        table.integer('sm_match_id');
        table.timestamp('created_at').defaultTo(knex.fn.now());
        table.timestamp('updated_at').defaultTo(knex.fn.now());
    });
};

exports.down = function (knex) {
    return knex.schema.dropTable('matches');
}; 