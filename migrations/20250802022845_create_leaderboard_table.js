exports.up = function (knex) {
    return knex.schema.createTable('leaderboard', function (table) {
        table.increments('id').primary();
        table.integer('contestId').references('id').inTable('contests').onDelete('CASCADE');
        table.integer('tournamentId').references('id').inTable('tournaments').onDelete('CASCADE');
        table.integer('userId').references('id').inTable('users').onDelete('CASCADE');
        table.integer('matchId').references('id').inTable('matches').onDelete('CASCADE');
        table.integer('fantasyGameId').references('id').inTable('fantasy_games').onDelete('CASCADE');
        table.float('totalScore').notNullable().defaultTo(0);
        table.integer('rank');
        table.boolean('is_finalized').defaultTo(false);
        table.timestamp('created_at').defaultTo(knex.fn.now());
        table.timestamp('modified_at').defaultTo(knex.fn.now());
        table.unique(['contestId', 'userId',"fantasyGameId"]);
    });
};

exports.down = function (knex) {
    return knex.schema.dropTable('leaderboard');
};
