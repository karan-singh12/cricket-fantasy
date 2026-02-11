exports.up = function (knex) {
    return knex.schema.createTable('player_stats', function (table) {
        table.increments('id').primary();
        table.integer('player_id').references('id').inTable('players').onDelete('CASCADE');
        table.integer('match_id').references('id').inTable('matches').onDelete('CASCADE');
        table.integer('runs_scored').defaultTo(0);
        table.integer('balls_faced').defaultTo(0);
        table.integer('fours').defaultTo(0);
        table.integer('sixes').defaultTo(0);
        table.decimal('strike_rate', 5, 2).defaultTo(0);
        table.integer('wickets').defaultTo(0);
        table.decimal('overs_bowled', 5, 2).defaultTo(0);
        table.integer('runs_conceded').defaultTo(0);
        table.integer('maidens').defaultTo(0);
        table.integer('catches').defaultTo(0);
        table.integer('stumpings').defaultTo(0);
        table.integer('run_outs').defaultTo(0);
        table.integer('fantasy_points').defaultTo(0);
        table.jsonb('metadata');
        table.timestamp('created_at').defaultTo(knex.fn.now());
        table.timestamp('updated_at').defaultTo(knex.fn.now());

        // Add unique constraint
        table.unique(['match_id', 'player_id']);
    });
};

exports.down = function (knex) {
    return knex.schema.dropTable('player_stats');
}; 