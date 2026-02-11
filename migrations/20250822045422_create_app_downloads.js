exports.up = function (knex) {
    return knex.schema.createTable("app_downloads", function (table) {
      table.increments("id").primary();
      table.string("file_name", 255).notNullable();
      table.binary("file_data").notNullable(); // store APK as BYTEA
      table.timestamp("created_at").defaultTo(knex.fn.now());
    });
  };
  
  exports.down = function (knex) {
    return knex.schema.dropTableIfExists("app_downloads");
  };
  