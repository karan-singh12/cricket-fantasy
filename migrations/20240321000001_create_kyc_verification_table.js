exports.up = function(knex) {
    return knex.schema.createTable('kyc_verification', function(table) {
        table.increments('id').primary();
        table.integer('userId').unsigned().references('id').inTable('users').onDelete('CASCADE');
        table.string('pan_number');
        table.string('pan_name');
        table.string('pan_front_url');
        table.string('pan_back_url');
        table.enum('status', ['pending', 'approved', 'rejected']).defaultTo('pending');
        table.text('rejection_reason').nullable();
        table.timestamp('created_at').defaultTo(knex.fn.now());
        table.timestamp('updated_at').defaultTo(knex.fn.now());
        
        // Add indexes
        table.index('userId');
        table.index('status');
    });
};

exports.down = function(knex) {
    return knex.schema.dropTable('kyc_verification');
}; 