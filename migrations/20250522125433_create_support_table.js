exports.up = function(knex) {
    return knex.schema.createTable('support', function(table) {
      table.increments('id').primary();
      table.integer('user_id').unsigned().notNullable().references('id').inTable('users').onDelete('CASCADE');
      table.string('type').defaultTo('general');
      table.text('message').notNullable();
      table.integer('status').defaultTo(1);
      table.timestamp('created_at').defaultTo(knex.fn.now());
      table.timestamp('updated_at').defaultTo(knex.fn.now());
    });
  };
  
  exports.down = function(knex) {
    return knex.schema.dropTable('support');
  };
  
