exports.up = function (knex) {
    return knex.schema.createTable('fantasy_points', function (table) {
        table.increments('id').primary();
        table.string('action')
        table.integer('points')
        table.string('description');
        table.jsonb('conditions');
        table.timestamp('created_at').defaultTo(knex.fn.now());
        table.timestamp('updated_at').defaultTo(knex.fn.now());
        table.integer('score_id');
        table.integer('runs').defaultTo(0);
        table.boolean('four').defaultTo(false);
        table.boolean('six').defaultTo(false);
        table.integer('bye').defaultTo(0);
        table.integer('leg_bye').defaultTo(0);
        table.integer('noball').defaultTo(0);
        table.integer('noball_runs').defaultTo(0);
        table.boolean('is_wicket').defaultTo(false);
        table.boolean('ball').defaultTo(false);
        table.boolean('out').defaultTo(false);
        table.integer('points_t20').defaultTo(false);
        table.integer('points_odi').defaultTo(false);
        table.integer('points_test').defaultTo(false);
        table.integer('points_t10').defaultTo(false);
        table.integer("status").defaultTo(1)
    });
};

exports.down = function (knex) {
    return knex.schema.dropTable('fantasy_points');
}; 