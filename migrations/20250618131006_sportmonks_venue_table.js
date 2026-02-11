/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
    return knex.schema.createTable('venues', function(table) {
        table.increments('id').primary();             
        table.integer('venue_id');                    
        table.integer('country_id').nullable();        
        table.string('name').nullable();             
        table.string('city').nullable();               
        table.string('image_path').nullable();       
        table.integer('capacity').nullable();         
        table.boolean('floodlight').nullable();        
        table.timestamp('updated_at').defaultTo(knex.fn.now()); 
      });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
    return knex.schema.dropTable('venues');
};
