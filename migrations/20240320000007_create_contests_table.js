exports.up = function (knex) {
    return knex.schema.createTable('contests', function (table) {
        table.increments('id').primary();
        table.string('name').notNullable();
        table.integer('match_id').references('id').inTable('matches').notNullable();
        table.integer('tournament_id').references('id').inTable('tournaments');
        table.integer('template_id');
        table.decimal('entry_fee', 10, 2).notNullable();
        table.decimal('prize_pool', 12, 2).notNullable();
        table.integer('max_teams').notNullable();
        table.integer('joined_teams').defaultTo(0);
        table.integer('max_teams_per_user').defaultTo(1);
        table.string('contest_type'); // 'guaranteed', 'normal'
        table.jsonb('winnings'); // Prize distribution structure
        table.decimal('commission_percentage', 5, 2).nullable().defaultTo(null);
        table.integer('total_spots');
        table.integer('per_user_entry');
        table.integer('filled_spots').defaultTo(0);
        table.string('status').defaultTo('upcoming');
        table.boolean('is_mega_contest').defaultTo(false);
        table.integer('created_by_user').references('id').inTable('users');
        table.jsonb('prize_pool_meta'); // prize_pool was Number in model, but knex had prize_pool as table name once or same field name. Wait, the model has prize_pool as Number.
        table.jsonb('prize_pool_json'); // renamed to avoid conflict if any, but model expects prize_pool (number) and winnings (object)
        table.jsonb('rules_json');
        table.text('rules');
        table.timestamp('start_time');
        table.timestamp('end_time');
        table.timestamp('created_at').defaultTo(knex.fn.now());
        table.timestamp('updated_at').defaultTo(knex.fn.now());
    });
};

exports.down = function (knex) {
    return knex.schema.dropTable('contests');
}; 