exports.up = function (knex) {
    return knex.schema.createTable('admins', function (table) {
        table.increments('id').primary();
        table.string('name').notNullable();
        table.string('email').notNullable();
        table.string('password').notNullable();
        table.string('role').defaultTo('admin');
        table.integer('status').defaultTo(1);
        table.specificType('permission', 'text[]').defaultTo('{}');
        table.timestamp('created_at').defaultTo(knex.fn.now());
        table.timestamp('updated_at').defaultTo(knex.fn.now());
    });
};

exports.down = function (knex) {
    return knex.schema.dropTable('admins');
}; 