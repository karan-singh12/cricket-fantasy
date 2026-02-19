const request = require('supertest');
const app = require('../../app');
const { knex: db } = require('../../config/database');

describe('Match Management API', () => {
    let adminToken;
    let testMatchId;

    beforeAll(async () => {
        // Create a test admin
        const password = 'testpassword123';
        const hashedPassword = await require('bcrypt').hash(password, 10);
        const [admin] = await db('admins').insert({
            name: 'Test Admin Match',
            email: `test_admin_match_${Date.now()}@example.com`,
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
            name: 'Test Tournament for Match',
            status: 1
        }).returning('*');

        const [team1] = await db('teams').insert({
            name: 'Team 1',
            tournament_id: tournament.id
        }).returning('*');

        const [team2] = await db('teams').insert({
            name: 'Team 2',
            tournament_id: tournament.id
        }).returning('*');

        const [match] = await db('matches').insert({
            tournament_id: tournament.id,
            team1_id: team1.id,
            team2_id: team2.id,
            status: 'upcoming',
            start_time: db.fn.now(),
            is_visible: true
        }).returning('*');
        testMatchId = match.id;
    });

    afterAll(async () => {
        await db.destroy();
    });

    describe('POST /api/admin/matches/getAllMatches', () => {
        it('should list all matches', async () => {
            const response = await request(app)
                .post('/api/admin/matches/getAllMatches')
                .set('Authorization', `Bearer ${adminToken}`)
                .send({
                    pageSize: 10,
                    pageNumber: 1,
                    status: ['upcoming']
                });

            expect(response.status).toBe(200);
            expect(response.body.status).toBe(true);
            expect(Array.isArray(response.body.data.result)).toBe(true);
        });
    });

    describe('PUT /api/admin/matches/matches/:id/visibility', () => {
        it('should update match visibility', async () => {
            const response = await request(app)
                .put(`/api/admin/matches/matches/${testMatchId}/visibility`)
                .set('Authorization', `Bearer ${adminToken}`)
                .send({ is_visible: false });

            expect(response.status).toBe(200);
            expect(response.body.is_visible).toBe(false);
        });
    });

    describe('PUT /api/admin/matches/matches/:id/status', () => {
        it('should update match status', async () => {
            const response = await request(app)
                .put(`/api/admin/matches/matches/${testMatchId}/status`)
                .set('Authorization', `Bearer ${adminToken}`)
                .send({ status: 'live' });

            expect(response.status).toBe(200);
            expect(response.body.status).toBe('live');
        });
    });
});
