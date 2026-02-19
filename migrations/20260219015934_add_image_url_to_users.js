/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function (knex) {
    return knex.schema.table('users', function (table) {
        if (!knex.schema.hasColumn('users', 'image_url')) {
            table.string('image_url').nullable();
        }
    });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function (knex) {
    return knex.schema.table('users', function (table) {
        table.dropColumn('image_url');
    });
};
