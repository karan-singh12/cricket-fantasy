exports.up = function (knex) {
    return knex.schema.createTable('match_stats', function (table) {
        table.increments('id').primary();
        table.integer('match_id').unsigned().notNullable().references('id').inTable('matches').onDelete('CASCADE');
        table.integer('player_id').unsigned().notNullable().references('id').inTable('players').onDelete('CASCADE');
        table.integer('team_id').unsigned().notNullable().references('id').inTable('teams').onDelete('CASCADE');

        // Batting Stats
        table.integer('runs').defaultTo(0);
        table.integer('balls_faced').defaultTo(0);
        table.integer('fours').defaultTo(0);
        table.integer('sixes').defaultTo(0);
        table.decimal('strike_rate', 5, 2).defaultTo(0);
        table.string('dismissal_type').nullable();
        table.string('dismissal_bowler').nullable();
        table.string('dismissal_fielders').nullable();
        table.string('batting_status').nullable();

        // Bowling Stats
        table.decimal('overs_bowled', 5, 2).defaultTo(0);
        table.integer('maidens').defaultTo(0);
        table.integer('runs_conceded').defaultTo(0);
        table.integer('wickets').defaultTo(0);
        table.decimal('economy_rate', 5, 2).defaultTo(0);
        table.integer('dots').defaultTo(0);
        table.integer('wides').defaultTo(0);
        table.integer('no_balls').defaultTo(0);

        // Fielding Stats
        table.integer('catches').defaultTo(0);
        table.integer('run_outs').defaultTo(0);
        table.integer('stumpings').defaultTo(0);

        // Additional Info
        table.string('role').nullable();
        table.jsonb('metadata').nullable();
        table.timestamps(true, true);

        // Composite unique constraint to prevent duplicate entries
        table.unique(['match_id', 'player_id']);
    });
};

exports.down = function (knex) {
    return knex.schema.dropTable('match_stats');
}; 