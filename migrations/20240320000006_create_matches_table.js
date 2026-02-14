exports.up = function (knex) {
    return knex.schema.createTable('matches', function (table) {
        table.increments('id').primary();
        table.integer('sportmonks_id').unique().notNullable();
        table.string('title');
        table.string('short_title');
        table.integer('tournament_id').references('id').inTable('tournaments');
        table.integer('team1_id').references('id').inTable('teams');
        table.integer('team2_id').references('id').inTable('teams');
        table.timestamp('start_time').notNullable();
        table.timestamp('end_time');
        table.string('status'); // 'upcoming', 'live', 'completed', 'cancelled'
        table.string('format'); // 'ODI', 'T20', 'Test'
        table.integer('venue_id');
        table.string('venue');
        table.string('city');
        table.string('country');
        table.string('match_number');
        table.string('match_type');
        table.integer('toss_won_team_id');
        table.string('toss_decision');
        table.string('score_team1');
        table.string('score_team2');
        table.string('overs_team1');
        table.string('overs_team2');
        table.integer('winning_team_id');
        table.integer('man_of_the_match_id');
        table.string('result_note');
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