/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function (knex) {
    const hasCredits = await knex.schema.hasColumn('players', 'credits');
    const hasPoints = await knex.schema.hasColumn('players', 'points');
    const hasPlayedLastMatch = await knex.schema.hasColumn('players', 'is_played_last_match');
    const hasSelectionPercent = await knex.schema.hasColumn('players', 'selected_by_percentage');

    return knex.schema.table('players', function (table) {
        if (!hasCredits) {
            table.decimal('credits', 10, 2).defaultTo(0);
        }
        if (!hasPoints) {
            table.decimal('points', 10, 2).defaultTo(0);
        }
        if (!hasPlayedLastMatch) {
            table.boolean('is_played_last_match').defaultTo(false);
        }
        if (!hasSelectionPercent) {
            table.decimal('selected_by_percentage', 10, 2).defaultTo(0);
        }
    });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function (knex) {
    return knex.schema.table('players', function (table) {
        table.dropColumn('credits');
        table.dropColumn('points');
        table.dropColumn('is_played_last_match');
        table.dropColumn('selected_by_percentage');
    });
};
