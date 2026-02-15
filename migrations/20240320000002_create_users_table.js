exports.up = function (knex) {
    return knex.schema.createTable('users', function (table) {
        table.increments('id').primary();
        table.string('name').nullable();
        table.string('email')
        table.string('phone');
        table.date('dob');
        table.string('gender');
        table.string('otp');
        table.timestamp('otp_expires');
        table.boolean('is_verified').defaultTo(false);
        table.boolean('is_name_setup').defaultTo(false);
        table.boolean('kyc_verified').defaultTo(false);
        table.decimal('wallet_balance', 10, 2).defaultTo(0);
        table.string('referral_code').nullable().unique();
        table.string('referred_by');
        table.decimal('referral_bonus', 10, 2).nullable(); // custom bonus for this code
        // table.specificType('social_login_type', 'TEXT[]');
        table.string('social_login_type');
        // table.specificType('permission', 'text[]').defaultTo('{}');
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
        table.timestamp('created_at').defaultTo(knex.fn.now());
        table.timestamp('updated_at').defaultTo(knex.fn.now());
    });
};

exports.down = function (knex) {
    return knex.schema.dropTable('users');
}; 