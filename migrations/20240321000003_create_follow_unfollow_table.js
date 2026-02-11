exports.up = function (knex) {
  return knex.schema.createTable("follow_unfollow", (table) => {
    table.increments("id").primary();
    table.integer("follower_id").unsigned().notNullable();
    table.integer("following_id").unsigned().notNullable();
    table.timestamp("created_at").defaultTo(knex.fn.now());
    table.timestamp("updated_at").defaultTo(knex.fn.now());

 
    table.foreign("follower_id").references("users.id").onDelete("CASCADE");
    table.foreign("following_id").references("users.id").onDelete("CASCADE");

    
    table.unique(["follower_id", "following_id"]);

 
    table.index("follower_id");
    table.index("following_id");
  });
};

exports.down = function (knex) {
  return knex.schema.dropTable("follow_unfollow");
}; 