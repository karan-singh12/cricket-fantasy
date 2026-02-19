const request = require('supertest');
const app = require('../../app');
const { knex: db } = require('../../config/database');

describe('User Panel API', () => {
    let userToken;
    let userId;
    let testMatchId;

    beforeAll(async () => {
        // Create a test user
        const userData = {
            name: 'Test User Panel',
            email: `test_user_panel_${Date.now()}@example.com`,
            status: 1,
            is_verified: true,
            created_at: db.fn.now(),
            updated_at: db.fn.now()
        };

        const [user] = await db('users').insert(userData).returning('*');
        userId = user.id;

        // Login (using the static OTP logic found in authController)
        const loginResponse = await request(app)
            .post('/api/user/auth/login')
            .send({ email: userData.email });

        const otpResponse = await request(app)
            .post('/api/user/auth/verify-otp')
            .send({
                email: userData.email,
                otp: '1234'
            });

        userToken = otpResponse.body.data.token;

        // Create a test match for contest listing
        const [tournament] = await db('tournaments').insert({
            name: `User Panel Tournament ${Date.now()}`,
            status: 1
        }).returning('*');

        const [match] = await db('matches').insert({
            tournament_id: tournament.id,
            team1_id: 1, // Assume these exist or will be nullable
            team2_id: 2,
            status: 'NS',
            start_time: new Date(Date.now() + 86400000).toISOString()
        }).returning('*');
        testMatchId = match.id;
    });

    afterAll(async () => {
        await db.destroy();
    });

    describe('POST /api/user/auth/login', () => {
        it('should send OTP for existing user', async () => {
            const response = await request(app)
                .post('/api/user/auth/login')
                .send({ email: `existing_user_${Date.now()}@example.com` });

            expect(response.status).toBe(200);
            expect(response.body.status).toBe(true);
        });
    });

    describe('Contest APIs', () => {
        it('should list available contests for a match', async () => {
            const response = await request(app)
                .post('/api/user/contests/getAvailableContests')
                .set('Authorization', `Bearer ${userToken}`)
                .send({ matchId: testMatchId });

            // This is expected to fail or return 200 with empty list 
            // but we want to check if it throws 500 due to table/column mismatches
            expect(response.status).toBe(200);
            expect(response.body.status).toBe(true);
        });

        it('should get contest details', async () => {
            // Create a contest first
            const [contest] = await db('contests').insert({
                name: 'Test User Contest',
                match_id: testMatchId,
                tournament_id: 1,
                entry_fee: 10,
                prize_pool: 100,
                total_spots: 10,
                status: 'open',
                winnings: JSON.stringify([{ from: 1, to: 1, price: 50 }])
            }).returning('*');

            const response = await request(app)
                .get(`/api/user/contests/getContestDetails/${contest.id}`)
                .set('Authorization', `Bearer ${userToken}`);

            expect(response.status).toBe(200);
            expect(response.body.status).toBe(true);
        });
    });
});
