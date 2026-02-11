exports.up = function(knex) {
    return knex.schema.createTable('social_links', function(table) {
      table.increments('id').primary();
      table.string('telegram').nullable();
      table.bigInteger('whatsapp').nullable();
      table.string('facebook').nullable();
      table.string('instagram').nullable();
      table.string('x').nullable();
      table.string('email').nullable();
      table.string('address').nullable();
      table.timestamps(true, true);
    });
  };
  
  exports.down = function(knex) {
    return knex.schema.dropTable('social_links');
  };
  