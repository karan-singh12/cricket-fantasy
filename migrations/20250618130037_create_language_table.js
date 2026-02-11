exports.up = function(knex) {
    return knex.schema.createTable('language', function(table) {
      table.increments('id').primary();
      table.string('language_type').notNullable(); 
      table.string("name").notNullable()
      table.integer('status').defaultTo(1);
      table.timestamp('created_at').defaultTo(knex.fn.now());
      table.timestamp('updated_at').defaultTo(knex.fn.now());
    });
  };
  
  exports.down = function(knex) {
    return knex.schema.dropTable('language');
  };
  