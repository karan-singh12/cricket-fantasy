exports.up = function (knex) {
    return knex.schema.table('contests', function (table) {
        table.integer('match_id').unsigned().references('id').inTable('matches').onDelete('CASCADE');
        table.string('contest_type');
        table.jsonb('winnings');
        table.integer('created_by').unsigned().references('id').inTable('users').onDelete('SET NULL');
    });
};

exports.down = function (knex) {
    return knex.schema.table('contests', function (table) {
        table.dropColumn('match_id');
        table.dropColumn('contest_type');
        table.dropColumn('winnings');
        table.dropColumn('created_by');
    });
};
