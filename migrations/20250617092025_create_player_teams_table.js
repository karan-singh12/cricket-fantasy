
exports.up = function(knex) {
    return knex.schema.createTable('player_teams', function(table) {
      table.increments('id').primary();
      table.integer('player_id').references('id').inTable('players');
      table.integer('team_id').references('id').inTable('teams');
      table.integer('sm_player_id');
      table.integer('sm_team_id');
      table.timestamp('created_at').defaultTo(knex.fn.now());
      table.timestamp('updated_at').defaultTo(knex.fn.now());
    });
  };
  
  exports.down = function(knex) {
    return knex.schema.dropTable('player_teams');
  };