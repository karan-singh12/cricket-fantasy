/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
    return knex.schema.createTable('countries', function(table) {
        table.increments('id').primary();            
        table.integer('country_id');               
        table.integer('continent_id').nullable();      
        table.string('name').nullable();
        table.string('image_path').nullable(); 
        table.timestamp('updated_at').nullable();
      });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
    return knex.schema.dropTable('countries');
};
