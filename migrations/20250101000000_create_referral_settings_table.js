/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function (knex) {
  return knex.schema.createTable("referral_settings", function (table) {
    table.increments("id").primary();
    table.boolean("is_active").defaultTo(true);
    table.decimal("referrer_bonus", 10, 2).defaultTo(100.0);
    table.decimal("referee_bonus", 10, 2).defaultTo(100.0);
    table.integer("max_referrals_per_user").defaultTo(0); // 0 means unlimited
    table.boolean("min_referee_verification").defaultTo(true);
    table.string("bonus_currency").defaultTo("BDT");
    table.jsonb("additional_settings").defaultTo("{}");
    table.timestamp("created_at").defaultTo(knex.fn.now());
    table.timestamp("updated_at").defaultTo(knex.fn.now());
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function (knex) {
  return knex.schema.dropTable("referral_settings");
};
