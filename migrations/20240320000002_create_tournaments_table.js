exports.up = function (knex) {
    return knex.schema.createTable('tournaments', function (table) {
        table.increments('id').primary();
        table.string('name').notNullable().unique();
        table.string('short_name');
        table.integer('sportmonks_id').unique();
        table.string('tournament_id').unique();
        table.string('season');
        table.date('start_date');
        table.date('end_date');
        table.string('status').defaultTo('active'); // 'active', 'completed'
        table.string('category');
        table.jsonb('metadata');
        table.timestamp('created_at').defaultTo(knex.fn.now());
        table.timestamp('updated_at').defaultTo(knex.fn.now());
    });
};

exports.down = function (knex) {
    return knex.schema.dropTable('tournaments');
}; 