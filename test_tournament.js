const { knex } = require('./config/database');

async function testTournamentCreation() {
    try {
        const [tournament] = await knex("tournaments")
            .insert({
                name: `Diagnostic Tournament ${Date.now()}`,
                start_date: '2026-01-01',
                status: true,
                created_at: knex.fn.now(),
                updated_at: knex.fn.now(),
            })
            .returning("*");
        console.log('Success:', tournament.id);
        process.exit(0);
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

testTournamentCreation();
