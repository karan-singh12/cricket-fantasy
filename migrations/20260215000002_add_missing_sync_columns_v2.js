/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function (knex) {
    // Check for columns before attempting to add them to avoid errors if partially applied
    const hasTeamId = await knex.schema.hasColumn('teams', 'team_id');
    const hasSmLeagueId = await knex.schema.hasColumn('teams', 'sm_league_id');
    const hasPlayerImagePath = await knex.schema.hasColumn('players', 'image_path');
    const hasPlayerTeamSeasonId = await knex.schema.hasColumn('player_teams', 'season_id');

    await knex.schema.table('teams', function (table) {
        if (!hasTeamId) {
            table.string('team_id').unique();
        }
        if (!hasSmLeagueId) {
            table.string('sm_league_id');
        }
    });

    await knex.schema.table('players', function (table) {
        if (!hasPlayerImagePath) {
            table.string('image_path');
        }
    });

    await knex.schema.table('player_teams', function (table) {
        if (!hasPlayerTeamSeasonId) {
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
