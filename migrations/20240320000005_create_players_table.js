exports.up = function (knex) {
    return knex.schema.createTable('players', function (table) {
        table.increments('id').primary();
        table.integer('sportmonks_id').unique().notNullable();
        table.string('name').notNullable();
        table.string('short_name');
        table.string('image_url');
        table.string('role'); // batsman, bowler, all-rounder
        table.string('position'); // 'Batsman', 'Bowler', 'All-Rounder', 'Wicketkeeper'
        table.string('batting_style');
        table.string('bowling_style');
        table.date('date_of_birth');
        table.integer('country_id');
        table.string('nationality');
        table.integer('team_id').references('id').inTable('teams');
        table.integer('points').defaultTo(0);
        table.integer('credits').defaultTo(0);
        table.jsonb('metadata');
        table.timestamp('created_at').defaultTo(knex.fn.now());
        table.timestamp('updated_at').defaultTo(knex.fn.now());
    });
};

exports.down = function (knex) {
    return knex.schema.dropTable('players');
}; 