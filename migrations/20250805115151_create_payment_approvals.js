exports.up = function(knex) {
    return knex.schema.createTable('payment_approvals', function(table) {
      table.increments('id').primary();
      table.integer('transaction_id').unsigned().notNullable().references('id').inTable('transactions').onDelete('CASCADE');
      table.string('type').notNullable(); // 'DEPOSIT' or 'WITHDRAWAL'
      table.string('status').defaultTo('PENDING'); // 'PENDING', 'APPROVED', 'REJECTED'
      table.text('admin_notes').nullable();
      table.integer("account_number").nullable()
      table.string('payment_system').nullable();
      table.integer('processed_by').unsigned().nullable().references('id').inTable('admins');
      table.timestamp('processed_at').nullable();
      table.timestamp('created_at').defaultTo(knex.fn.now());
      table.timestamp('updated_at').defaultTo(knex.fn.now());
      
      
      table.index(['status']);
      table.index(['type']);
    });
  };
  
  exports.down = function(knex) {
    return knex.schema.dropTable('payment_approvals');
  };