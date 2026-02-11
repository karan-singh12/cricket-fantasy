exports.up = function(knex) {
    return knex.schema.createTable('emailtemplates', function(table) {
      table.increments('id').primary();
      table.string('title');
      table.string('slug');
      table.string('subject');
      table.text('content');
      table.integer('status').defaultTo(1);
      table.integer('createdBy').unsigned().references('id').inTable('admins').onDelete('SET NULL');
      table.timestamps(true, true); 
    });
  };
  
  exports.down = function(knex) {
    return knex.schema.dropTable('emailtemplates');
  };
  