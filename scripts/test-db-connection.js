const { testConnection, knex } = require('../config/database');

async function runTest() {
    console.log('Starting database connection test...');
    try {
        await testConnection();
        console.log('Listing tables to verify access:');
        const tables = await knex.raw("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'");
        console.log('Tables found:', tables.rows.map(r => r.table_name).join(', ') || 'None (fresh database)');

        process.exit(0);
    } catch (error) {
        console.error('Test failed:', error);
        process.exit(1);
    }
}

runTest();
