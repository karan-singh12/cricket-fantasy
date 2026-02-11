exports.up = function (knex) {
    return knex.schema.createTable("match_statistics", function (table) {
        table.increments("id").primary();
        table.integer('match_id').unsigned().notNullable().references('id').inTable('matches').onDelete('CASCADE');

        // Teams
        table.integer("team1_id").notNullable();
        table.integer("team2_id").notNullable();

        // Match Info
        table.string("venue", 255);
        table.timestamp("match_date").notNullable();
        table.string("status", 255);

        // Scores & Results
        table.integer("team1_runs").defaultTo(0);
        table.integer("team1_wickets").defaultTo(0);
        table.decimal("team1_overs", 4, 1).defaultTo(0);

        table.integer("team2_runs").defaultTo(0);
        table.integer("team2_wickets").defaultTo(0);
        table.decimal("team2_overs", 4, 1).defaultTo(0);

        table.integer("winner_team_id");
        table.string("result_type", 50);
        table.string("result_margin", 100);

        // Metadata
        table.timestamp("created_at").defaultTo(knex.fn.now());
        table.timestamp("updated_at").defaultTo(knex.fn.now());
    });
};

exports.down = function (knex) {
    return knex.schema.dropTableIfExists("match_statistics");
};
