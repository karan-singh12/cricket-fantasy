/**
 * Migration: Create player_match_statistics table
 */
exports.up = function (knex) {
    return knex.schema.createTable("player_match_statistics", function (table) {
        table.increments("id").primary();
        table.integer('match_id').references('id').inTable('matches').onDelete('CASCADE');
        table.integer('player_id').references('id').inTable('players').onDelete('CASCADE');
        table.integer("team_id").notNullable();

        // Batting
        table.integer("runs").defaultTo(0);
        table.integer("balls_faced").defaultTo(0);
        table.integer("fours").defaultTo(0);
        table.integer("sixes").defaultTo(0);
        table.decimal("strike_rate", 5, 2);
        table.string("dismissal_type", 50);
        table.string("how_out", 255);

        // Bowling
        table.decimal("overs", 4, 1).defaultTo(0);
        table.integer("maidens").defaultTo(0);
        table.integer("runs_conceded").defaultTo(0);
        table.integer("wickets").defaultTo(0);
        table.integer("dot_balls").defaultTo(0);
        table.integer("no_balls").defaultTo(0);
        table.integer("wides").defaultTo(0);
        table.decimal("economy", 5, 2);

        // Fielding
        table.integer("catches").defaultTo(0);
        table.integer("run_outs").defaultTo(0);
        table.integer("run_outs_direct_hit").defaultTo(0);
        table.integer("stumpings").defaultTo(0);

        table.jsonb("thresholds").defaultTo('{}');
        /**
         * Example:
         * {
         *   "runs_threshold": 125,
         *   "wickets_threshold": 5,
         *   "catches_threshold": 3
         * }
         */

        // Timestamps
        table.timestamp("created_at").defaultTo(knex.fn.now());
        table.timestamp("updated_at").defaultTo(knex.fn.now());
    });
};

exports.down = function (knex) {
    return knex.schema.dropTableIfExists("player_match_statistics");
};
