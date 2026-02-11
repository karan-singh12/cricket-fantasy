
exports.up = function(knex) {
    return knex.schema.createTable('faq', function(table) {
      table.increments('id').primary();
      table.string('title');
      table.text('description');
      table.integer('status').defaultTo(1); // 0 = Inactive, 1 = Active, 2 = Deleted
      table.timestamp('createdAt').defaultTo(knex.fn.now());
      table.timestamp('modifiedAt').defaultTo(knex.fn.now());
    });
  };
  
  exports.down = function(knex) {
    return knex.schema.dropTable('faq');
  };
  