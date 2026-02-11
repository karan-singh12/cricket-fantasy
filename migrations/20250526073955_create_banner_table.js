// migrations/20250523121000_create_banners_table.js

exports.up = function (knex) {
    return knex.schema.createTable('banner', function (table) {
        table.increments('id').primary();
        table.integer('tournament_id').references('id').inTable('tournaments');
        table.string('name');
        table.string('description');
        table.text('image_url');
        table.integer('status',).defaultTo(1);
        table.timestamp('start_date');
        table.timestamp('end_date');
        table.timestamp('created_at').defaultTo(knex.fn.now());
        table.timestamp('updated_at').defaultTo(knex.fn.now());
    });
};

exports.down = function (knex) {
    return knex.schema.dropTable('banner');
};