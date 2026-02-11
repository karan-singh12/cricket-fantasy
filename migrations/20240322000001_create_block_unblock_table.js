exports.up = function (knex) {
  return knex.schema.createTable("block_unblock", (table) => {
    table.increments("id").primary();
    table.integer("blocker_id").unsigned().references("id").inTable("users").onDelete("CASCADE");
    table.integer("blocked_id").unsigned().references("id").inTable("users").onDelete("CASCADE");
    table.timestamp("created_at").defaultTo(knex.fn.now());
    table.timestamp("updated_at").defaultTo(knex.fn.now());
    
    // Add unique constraint to prevent duplicate blocks
    table.unique(["blocker_id", "blocked_id"]);
  });
};

exports.down = function (knex) {
  return knex.schema.dropTable("block_unblock");
}; 