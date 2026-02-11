exports.up = function (knex) {
	return knex.schema.createTable('match_players', function (table) {
		table.increments('id').primary();
		table.integer('match_id').notNullable().references('id').inTable('matches').onDelete('CASCADE');
		table.integer('player_id').notNullable().references('id').inTable('players').onDelete('CASCADE');
		table.boolean('is_playing_xi').notNullable().defaultTo(false);
		table.boolean('is_substitute').notNullable().defaultTo(false);
		// Optional flags if you want to store lineup meta
		table.boolean('is_captain').notNullable().defaultTo(false);
		table.boolean('is_wicketkeeper').notNullable().defaultTo(false);
		table.unique(['match_id', 'player_id']);
		table.index(['match_id']);
		table.index(['player_id']);
		table.timestamp('created_at').defaultTo(knex.fn.now());
		table.timestamp('updated_at').defaultTo(knex.fn.now());
	});
};

exports.down = function (knex) {
	return knex.schema.dropTable('match_players');
};

