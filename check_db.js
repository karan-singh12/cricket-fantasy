const { knex: db } = require('./config/database');

async function checkColumns() {
    try {
        const hasIsBot = await db.schema.hasColumn('users', 'is_bot');
        const tableInfo = await db('users').columnInfo();
        console.log('Has is_bot column:', hasIsBot);
        console.log('All columns:', Object.keys(tableInfo));
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

checkColumns();
