exports.up = function (knex) {
    return knex.schema.createTable('contests', function (table) {
        table.increments('id').primary();
        table.string('name').notNullable();
        table.integer('tournament_id').references('id').inTable('tournaments');
        table.decimal('entry_fee', 10, 2);
        table.integer('total_spots');
        table.integer('per_user_entry');
        table.decimal('commission_percentage', 5, 2).nullable().defaultTo(null);
        table.integer('filled_spots').defaultTo(0);
        table.string('status').defaultTo('upcoming');
        table.jsonb('prize_pool');
        table.jsonb('rules');
        table.timestamp('start_time');
        table.timestamp('end_time');
        table.timestamp('created_at').defaultTo(knex.fn.now());
        table.timestamp('updated_at').defaultTo(knex.fn.now());
    });
};

exports.down = function (knex) {
    return knex.schema.dropTable('contests');
}; 