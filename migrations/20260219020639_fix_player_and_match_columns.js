/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function (knex) {
    if (!(await knex.schema.hasColumn('players', 'base_price'))) {
        await knex.schema.table('players', function (table) {
            table.decimal('base_price', 10, 2).nullable();
        });
    }
    if (!(await knex.schema.hasColumn('matches', 'is_visible'))) {
        await knex.schema.table('matches', function (table) {
            table.boolean('is_visible').defaultTo(true);
        });
    }
};

exports.down = async function (knex) {
    await knex.schema.table('players', function (table) {
        table.dropColumn('base_price');
    });
    await knex.schema.table('matches', function (table) {
        table.dropColumn('is_visible');
    });
};
