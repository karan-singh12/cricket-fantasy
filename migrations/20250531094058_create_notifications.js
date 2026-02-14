exports.up = function (knex) {
    return knex.schema.createTable('notifications', function (table) {
        table.increments('id').primary();
        table.integer('user_id').unsigned().references('id').inTable('users').onDelete('CASCADE');
        table.string('title');
        table.string('content');
        table.string('type').defaultTo('general');
        table.boolean('is_read').defaultTo(false);
        table.integer('match_id').nullable();
        table.timestamp('sent_at').defaultTo(knex.fn.now());
        table.timestamp('read_at');
        table.timestamp('created_at').defaultTo(knex.fn.now());
    });
};

exports.down = function (knex) {
    return knex.schema.dropTable('notifications');
};
