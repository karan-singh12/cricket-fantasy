const { knex: db } = require('./config/database');

async function testPlayerCreation() {
    try {
        const [player] = await db('players')
            .insert({
                name: 'Diagnostic Player',
                team_id: 1, // Assume a team exists or just test schema
                role: 'batsman',
                base_price: 100.50,
                batting_style: 'Right-hand',
                bowling_style: 'N/A',
                nationality: 'Indian',
                date_of_birth: '1995-05-15',
                created_at: db.fn.now(),
                updated_at: db.fn.now()
            })
            .returning('*');
        console.log('Success:', player.id);
        process.exit(0);
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

testPlayerCreation();
