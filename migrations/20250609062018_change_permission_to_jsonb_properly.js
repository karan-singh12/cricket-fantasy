/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function(knex) {
    await knex.schema.alterTable('users', function (table) {
      table.dropColumn('permission'); 
    });
  
    await knex.schema.alterTable('users', function (table) {
      table.jsonb('permission').defaultTo(JSON.stringify({ set_isNotification: true }));
    });
  };
  
  /**
   * @param { import("knex").Knex } knex
   * @returns { Promise<void> }
   */
  exports.down = async function(knex) {
    await knex.schema.alterTable('users', function (table) {
      table.dropColumn('permission');
    });
  
    await knex.schema.alterTable('users', function (table) {
      table.specificType('permission', 'text[]').defaultTo('{}');
    });
  };
  