/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function (knex) {
    return knex.schema
        .table('teams', function (table) {
            if (!knex.schema.hasColumn('teams', 'team_id')) {
                table.string('team_id').unique();
            }
            if (!knex.schema.hasColumn('teams', 'sm_league_id')) {
                table.string('sm_league_id');
            }
        })
        .table('players', function (table) {
            if (!knex.schema.hasColumn('players', 'image_path')) {
                table.string('image_path');
            }
        })
        .table('player_teams', function (table) {
            if (!knex.schema.hasColumn('player_teams', 'season_id')) {
                table.string('season_id');
            }
        });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function (knex) {
    return knex.schema
        .table('teams', function (table) {
            table.dropColumn('team_id');
            table.dropColumn('sm_league_id');
        })
        .table('players', function (table) {
            table.dropColumn('image_path');
        })
        .table('player_teams', function (table) {
            table.dropColumn('season_id');
        });
};
