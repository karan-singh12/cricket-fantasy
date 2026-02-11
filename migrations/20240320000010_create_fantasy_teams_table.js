exports.up = function (knex) {
    return knex.schema.createTable('fantasy_teams', function (table) {
        table.increments('id').primary();
        table.integer('user_id').references('id').inTable('users');
        table.integer('contest_id').references('id').inTable('contests');
        table.integer('match_id').references('id').inTable('matches');
        table.string('name');
        table.integer('total_points').defaultTo(0);
        table.integer('status').defaultTo(1); // active: 1, inactive: 0 , deleted: 2
        table.jsonb('metadata');
        table.timestamp('created_at').defaultTo(knex.fn.now());
        table.timestamp('updated_at').defaultTo(knex.fn.now());
    });
};

exports.down = function (knex) {
    return knex.schema.dropTable('fantasy_teams');
}; 