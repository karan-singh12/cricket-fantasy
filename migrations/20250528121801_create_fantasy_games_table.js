exports.up = function(knex) {
    return knex.schema.createTable('fantasy_games', function(table) {
      table.increments('id').primary();
      table.integer('user_id').references('id').inTable('users').onDelete('CASCADE');
      table.integer('contest_id').references('id').inTable('contests').onDelete('CASCADE');
      table.integer('fantasy_team_id').references('id').inTable('fantasy_teams').onDelete('CASCADE');
      table.decimal('points', 10, 2).defaultTo(0);
      table.integer('rank').defaultTo(0);
      table.string('team_name_user');
      table.string('status').defaultTo('ongoing');
      table.timestamp('created_at').defaultTo(knex.fn.now());
      table.timestamp('updated_at').defaultTo(knex.fn.now());
    });
  };
  
  exports.down = function(knex) {
    return knex.schema.dropTableIfExists('fantasy_games');
  };
  