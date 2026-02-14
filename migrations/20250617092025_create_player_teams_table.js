
exports.up = function (knex) {
  return knex.schema.createTable('player_teams', function (table) {
    table.increments('id').primary();
    table.integer('player_id').references('id').inTable('players').notNullable();
    table.integer('team_id').references('id').inTable('teams').notNullable();
    table.integer('season_id').notNullable();
    table.boolean('is_active').defaultTo(true);
    table.integer('sm_player_id');
    table.integer('sm_team_id');
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());

    table.unique(['player_id', 'team_id', 'season_id']);
  });
};

exports.down = function (knex) {
  return knex.schema.dropTable('player_teams');
};