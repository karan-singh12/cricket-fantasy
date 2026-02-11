exports.up = function (knex) {
    return knex.schema.table('notifications', function (table) {
      table.boolean('status').defaultTo(true); 
    });
  };
  
  exports.down = function (knex) {
    return knex.schema.table('notifications', function (table) {
      table.dropColumn('status');
    });
  };