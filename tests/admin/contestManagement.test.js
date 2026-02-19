const request = require('supertest');
const app = require('../../app');
const { knex: db } = require('../../config/database');

describe('Contest Management API', () => {
    let adminToken;
    let testMatchId;
    let testContestId;

    beforeAll(async () => {
        // Create a test admin
        const password = 'testpassword123';
        const hashedPassword = await require('bcrypt').hash(password, 10);
        const [admin] = await db('admins').insert({
            name: 'Test Admin Contest',
            email: `test_admin_contest_${Date.now()}@example.com`,
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

        // Create a test tournament and match
        const [tournament] = await db('tournaments').insert({
            name: `Test Tournament for Contest ${Date.now()}`,
            status: 1
        }).returning('*');

        const [team1] = await db('teams').insert({
            name: 'Team A',
            tournament_id: tournament.id
        }).returning('*');

        const [team2] = await db('teams').insert({
            name: 'Team B',
            tournament_id: tournament.id
        }).returning('*');

        const [match] = await db('matches').insert({
            tournament_id: tournament.id,
            team1_id: team1.id,
            team2_id: team2.id,
            status: 'NS', // Match must be NS (Not Started) for contest creation
            start_time: new Date(Date.now() + 86400000).toISOString() // 24 hours from now
        }).returning('*');
        testMatchId = match.id;
    });

    afterAll(async () => {
        await db.destroy();
    });

    describe('POST /api/admin/contest/createContest', () => {
        it('should create a new contest successfully', async () => {
            const entryFee = 100;
            const totalSpots = 10;
            const commission = 10;
            const prizePool = (entryFee * totalSpots) * (1 - commission / 100);

            const newContest = {
                match_id: testMatchId,
                name: 'Mega Contest',
                entry_fee: entryFee,
                total_spots: totalSpots,
                commission_percentage: commission,
                per_user_entry: 1,
                total_prize_pool: prizePool,
                contest_type: 'Grand League',
                start_time: new Date(Date.now() + 3600000).toISOString(),
                end_time: new Date(Date.now() + 86400000).toISOString(),
                winnings: [
                    { from: 1, to: 1, price: prizePool * 0.5 },
                    { from: 2, to: 5, price: (prizePool * 0.5) / 4 }
                ]
            };

            const response = await request(app)
                .post('/api/admin/contests/createContest')
                .set('Authorization', `Bearer ${adminToken}`)
                .send(newContest);

            if (response.status !== 200) console.log('Error Body:', response.body);
            expect(response.status).toBe(200);
            expect(response.body.status).toBe(true);
            testContestId = response.body.data.id;
        });
    });

    describe('POST /api/admin/contests/getAllContests', () => {
        it('should list all contests', async () => {
            const response = await request(app)
                .post('/api/admin/contests/getAllContests')
                .set('Authorization', `Bearer ${adminToken}`)
                .send({
                    pageSize: 10,
                    pageNumber: 1
                });

            expect(response.status).toBe(200);
            expect(response.body.status).toBe(true);
            expect(Array.isArray(response.body.data.result)).toBe(true);
        });
    });
});
