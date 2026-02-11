/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function (knex) {
    return knex.schema.createTable("transactions", function (table) {
      table.increments("id").primary();
      table.integer("user_id").unsigned().notNullable().references("id").inTable("users").onDelete("CASCADE");
      table.decimal("amount", 12, 2).defaultTo(0.0);
      table.string("currency").defaultTo("BDT"); 
      // table.string('transactionType');
      table.enu("transactionType", ["withdraw","refund","credit","debit","referral_bonus", "contest_spend","contest_winning",]).notNullable();
      table.string("status") // 'PENDING', 'SUCCESS', 'FAILED',"INITIATED"
      table.string("payment_id"); // From bKash: paymentID
      table.string("trx_id"); // From bKash: trxID
      table.string("merchant_invoice_number") //merchant_invoice_number
      table.integer("contest_id").unsigned().references("id").inTable("contests").onDelete("CASCADE");
      table.timestamp("created_at").defaultTo(knex.fn.now());
      table.timestamp("updated_at").defaultTo(knex.fn.now());
    });
  };
  
  /**
   * @param { import("knex").Knex } knex
   * @returns { Promise<void> }
   */
  exports.down = function (knex) {
    return knex.schema.dropTable("transactions");
  };
  