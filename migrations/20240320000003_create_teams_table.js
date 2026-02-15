exports.up = function (knex) {
    return knex.schema.createTable('teams', function (table) {
        table.increments('id').primary();
        table.string('name').notNullable();
        table.string('short_name');
        table.string('logo_url');
        table.string('country');
        table.integer('tournament_id').references('id').inTable('tournaments');
        table.jsonb('metadata');
        table.timestamp('created_at').defaultTo(knex.fn.now());
        table.timestamp('updated_at').defaultTo(knex.fn.now());
    });
};

exports.down = function (knex) {
    return knex.schema.dropTable('teams');
}; 