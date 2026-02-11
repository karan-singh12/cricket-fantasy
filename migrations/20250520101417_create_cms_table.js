exports.up = function (knex) {
  return knex.schema.createTable('cms', function (table) {
    table.increments('id').primary();
    table.string('title');
    table.text('description');
    table.string('contentType');
    table.string('image_path');
    table.string('slug');
    table.integer('status').defaultTo(1);
    table.timestamp('createdAt').defaultTo(knex.fn.now());
    table.timestamp('modifiedAt').defaultTo(knex.fn.now());
  });
};

exports.down = function (knex) {
  return knex.schema.dropTable('cms');
};
