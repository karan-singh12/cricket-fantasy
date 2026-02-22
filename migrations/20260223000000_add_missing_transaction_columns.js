/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function (knex) {
    const hasTitle = await knex.schema.hasColumn('transactions', 'title');
    const hasDescription = await knex.schema.hasColumn('transactions', 'description');
    const hasBank = await knex.schema.hasColumn('transactions', 'bank');

    return knex.schema.table('transactions', function (table) {
        if (!hasTitle) {
            table.string('title').nullable();
        }
        if (!hasDescription) {
            table.text('description').nullable();
        }
        if (!hasBank) {
            table.string('bank').nullable();
        }
    });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function (knex) {
    return knex.schema.table('transactions', function (table) {
        table.dropColumn('title');
        table.dropColumn('description');
        table.dropColumn('bank');
    });
};
