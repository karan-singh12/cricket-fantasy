const config = require('./config');
const knex = require('knex')({
    client: config.database.client,
    connection: config.database.connection,
    pool: config.database.pool,
    migrations: config.database.migrations,
    seeds: config.database.seeds
});

// Test and log database connection
const testConnection = async () => {
    try {
        await knex.raw('SELECT 1');
        console.log('\x1b[32m%s\x1b[0m', '✓ Database connected successfully');
        console.log('\x1b[36m%s\x1b[0m', `  ├── Host: ${config.database.connection.host}`);
        console.log('\x1b[36m%s\x1b[0m', `  ├── Database: ${config.database.connection.database}`);
        console.log('\x1b[36m%s\x1b[0m', `  ├── User: ${config.database.connection.user}`);
        console.log('\x1b[36m%s\x1b[0m', `  ├── Port: ${config.database.connection.port}`);
        console.log('\x1b[36m%s\x1b[0m', `  └── Connection Pool: ${config.database.pool.min}-${config.database.pool.max} connections`);
    } catch (error) {
        console.error('\x1b[31m%s\x1b[0m', '✗ Database connection failed');
        console.error('\x1b[31m%s\x1b[0m', `  ├── Error: ${error.message}`);
        console.error('\x1b[31m%s\x1b[0m', '  └── Check your database configuration and make sure PostgreSQL is running');
        process.exit(1);
    }
};

// Handle connection errors
knex.on('error', (error) => {
    console.error('\x1b[31m%s\x1b[0m', '✗ Database error occurred');
    console.error('\x1b[31m%s\x1b[0m', `  └── Error: ${error.message}`);
});

// Export both knex instance and connection test
module.exports = {
    knex,
    testConnection
}; 