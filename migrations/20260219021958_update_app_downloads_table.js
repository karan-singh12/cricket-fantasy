/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function (knex) {
    return knex.schema.table('app_downloads', function (table) {
        table.string('file_path').nullable();
        table.string('current_version').nullable();
        table.string('previous_version').nullable();
        table.string('platform').nullable();
        table.timestamp('updated_at').defaultTo(knex.fn.now());
        table.dropColumn('file_data');
    });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function (knex) {
    return knex.schema.table('app_downloads', function (table) {
        table.binary('file_data').nullable();
        table.dropColumn('file_path');
        table.dropColumn('current_version');
        table.dropColumn('previous_version');
        table.dropColumn('platform');
        table.dropColumn('updated_at');
    });
};
