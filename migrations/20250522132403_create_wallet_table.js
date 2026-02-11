exports.up = function(knex) {
    return knex.schema.createTable('wallet', function(table) {
      table.increments('id').primary();
      table.integer('user_id').unsigned().notNullable().references('id').inTable('users').onDelete('CASCADE');
      table.decimal('balance', 12, 2).defaultTo(0.00);
      table.string('currency').defaultTo('BDT');
      table.timestamp('created_at').defaultTo(knex.fn.now());
      table.timestamp('updated_at').defaultTo(knex.fn.now());
    });
  };
  
  exports.down = function(knex) {
    return knex.schema.dropTable('wallet');
  };
  