/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function (knex) {
  await knex.schema.createTable('how_to_play', (table) => {
    table.increments('id').primary();
    table.string('tab').notNullable();
    table.string('banner_image');
    table.jsonb('data').notNullable();
    table.boolean('status').defaultTo(true);
    table.timestamps(true, true);
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('how_to_play');
};
