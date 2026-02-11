exports.up = function (knex) {
    return knex.schema.createTable('fantasy_team_players', function (table) {
        table.increments('id').primary();
        table.integer('fantasy_team_id').references('id').inTable('fantasy_teams').onDelete('CASCADE');
        table.integer('player_id').references('id').inTable('players').onDelete('CASCADE');
        table.string('role'); // captain, vice-captai
        table.boolean('is_captain').defaultTo(false);
        table.boolean('is_vice_captain').defaultTo(false);
        table.boolean('substitute').defaultTo(false);
        table.integer('points').defaultTo(0);
        table.timestamp('created_at').defaultTo(knex.fn.now());
        table.timestamp('updated_at').defaultTo(knex.fn.now());
    });
};

exports.down = function (knex) {
    return knex.schema.dropTable('fantasy_team_players');
}; 