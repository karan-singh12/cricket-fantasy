const request = require('supertest');
const app = require('../../app');
const { knex: db } = require('../../config/database');

describe('Player Management API', () => {
    let adminToken;
    let testPlayerId;
    let testTeamId;
    let testMatchId;

    beforeAll(async () => {
        // Create a test admin
        const password = 'testpassword123';
        const hashedPassword = await require('bcrypt').hash(password, 10);
        const [admin] = await db('admins').insert({
            name: 'Test Admin Player',
            email: `test_admin_player_${Date.now()}@example.com`,
            password: hashedPassword,
            created_at: db.fn.now(),
            updated_at: db.fn.now()
        }).returning('*');

        // Login to get admin token
        const loginResponse = await request(app)
            .post('/api/admin/auth/login')
            .send({
                email: admin.email,
                password: password
            });
        adminToken = loginResponse.body.data.token;

        // Create a test team and match
        const [tournament] = await db('tournaments').insert({
            name: `Test Tournament for Player ${Date.now()}`,
            status: 1
        }).returning('*');

        const [team] = await db('teams').insert({
            name: 'Test Team',
            tournament_id: tournament.id
        }).returning('*');
        testTeamId = team.id;

        const [match] = await db('matches').insert({
            tournament_id: tournament.id,
            team1_id: team.id,
            team2_id: team.id,
            status: 'upcoming',
            start_time: db.fn.now()
        }).returning('*');
        testMatchId = match.id;
    });

    afterAll(async () => {
        await db.destroy();
    });

    describe('POST /api/admin/players/players', () => {
        it('should create a new player successfully', async () => {
            const newPlayer = {
                name: 'Test Player',
                team_id: testTeamId,
                role: 'batsman',
                base_price: 100.50,
                batting_style: 'Right-hand',
                bowling_style: 'N/A',
                nationality: 'Indian',
                date_of_birth: '1995-05-15'
            };

            const response = await request(app)
                .post('/api/admin/players/players')
                .set('Authorization', `Bearer ${adminToken}`)
                .send(newPlayer);

            if (response.status !== 201) console.log('Error Body:', response.body);
            expect(response.status).toBe(201);
            expect(response.body.name).toBe(newPlayer.name);
            testPlayerId = response.body.id;
        });
    });

    describe('GET /api/admin/players/players', () => {
        it('should list all players', async () => {
            const response = await request(app)
                .get('/api/admin/players/players')
                .set('Authorization', `Bearer ${adminToken}`);

            expect(response.status).toBe(200);
            expect(Array.isArray(response.body)).toBe(true);
        });
    });

    describe('POST /api/admin/players/players/:id/stats', () => {
        it('should update player stats successfully', async () => {
            const stats = {
                match_id: testMatchId,
                runs_scored: 50,
                balls_faced: 30,
                fours: 5,
                sixes: 2,
                wickets_taken: 0,
                overs_bowled: 0,
                runs_conceded: 0,
                catches_taken: 1,
                stumpings: 0,
                run_outs: 0
            };

            const response = await request(app)
                .post(`/api/admin/players/players/${testPlayerId}/stats`)
                .set('Authorization', `Bearer ${adminToken}`)
                .send(stats);

            expect(response.status).toBe(200);
            expect(parseInt(response.body.runs_scored)).toBe(50);
            expect(parseInt(response.body.wickets)).toBe(0); // Check the mapped column name
        });
    });
});
