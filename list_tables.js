const { knex: db } = require('./config/database');

async function listTables() {
    try {
        const res = await db.raw("SELECT tablename FROM pg_catalog.pg_tables WHERE schemaname = 'public'");
        console.log(JSON.stringify(res.rows.map(r => r.tablename).sort(), null, 2));
    } catch (error) {
        console.error(error);
    } finally {
        process.exit(0);
    }
}

listTables();
