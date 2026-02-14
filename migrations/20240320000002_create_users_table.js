exports.up = function (knex) {
    return knex.schema.createTable('users', function (table) {
        table.increments('id').primary();
        table.string('name').nullable();
        table.string('email').unique();
        table.string('phone').unique();
        table.string('password');
        table.string('role').defaultTo('user');
        table.decimal('balance', 12, 2).defaultTo(0);
        table.decimal('wallet_balance', 12, 2).defaultTo(0);
        table.date('dob');
        table.string('gender');
        table.string('otp');
        table.timestamp('otp_expires');
        table.boolean('is_verified').defaultTo(false);
        table.boolean('is_name_setup').defaultTo(false);
        table.boolean('kyc_verified').defaultTo(false);
        table.string('referral_code').nullable().unique();
        table.string('referred_by');
        table.decimal('referral_bonus', 12, 2).nullable();
        table.string('social_login_type');
        table.jsonb('permission').defaultTo('{}');
        table.string('fb_id');
        table.string('google_id');
        table.string('apple_id');
        table.string('device_id');
        table.string('device_type');
        table.string('ftoken');
        table.string('kyc_document');
        table.integer('status').defaultTo(1);
        table.specificType('is_reported_Arr', 'INTEGER[]').defaultTo('{}');
        table.boolean('is_reported').defaultTo(false);
        table.jsonb('metadata');
        table.timestamp('last_login');
        table.timestamp('created_at').defaultTo(knex.fn.now());
        table.timestamp('updated_at').defaultTo(knex.fn.now());
    });
};

exports.down = function (knex) {
    return knex.schema.dropTable('users');
}; 