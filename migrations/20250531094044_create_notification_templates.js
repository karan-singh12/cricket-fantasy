exports.up = function (knex) {
    return knex.schema.createTable('notification_templates', function (table) {
        table.increments('id').primary();
        table.string('notification_type'); // e.g., 'info', 'reminder', 'custom'
        table.string('title').notNullable();
        table.string('title_hi');
        table.text('content').notNullable();
        table.text('content_hi');
        // status: 0 = inactive, 1 = active, 2 = deleted
        table.integer('status').defaultTo(1);
        table.timestamp('created_at').defaultTo(knex.fn.now());
        table.timestamp('modified_at').defaultTo(knex.fn.now());
    });
};

exports.down = function (knex) {
    return knex.schema.dropTable('notification_templates');
};
