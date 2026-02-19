const request = require('supertest');
const app = require('../../app');
const { knex: db } = require('../../config/database');

describe('Tournament Management API', () => {
    let adminToken;

    beforeAll(async () => {
        // Create a test admin
        const password = 'testpassword123';
        const hashedPassword = await require('bcrypt').hash(password, 10);
        const [admin] = await db('admins').insert({
            name: 'Test Admin Tournament',
            email: `test_admin_tourn_${Date.now()}@example.com`,
            password: hashedPassword,
            created_at: db.fn.now(),
            updated_at: db.fn.now()
        }).returning('*');

        // Login to get admin token
        const response = await request(app)
            .post('/api/admin/auth/login')
            .send({
                email: admin.email,
                password: password
            });
        adminToken = response.body.data.token;
    });

    afterAll(async () => {
        await db.destroy();
    });

    describe('POST /api/admin/tournaments', () => {
        it('should list all tournaments', async () => {
            const response = await request(app)
                .post('/api/admin/tournaments/getAllTournaments')
                .set('Authorization', `Bearer ${adminToken}`)
                .send({
                    pageSize: 10,
                    pageNumber: 1
                });

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(Array.isArray(response.body.data.result)).toBe(true);
        });

        it('should create a new tournament successfully', async () => {
            const newTournament = {
                name: `Test Tournament ${Date.now()}`,
                start_date: '2026-01-01',
                status: 1
            };

            const response = await request(app)
                .post('/api/admin/tournaments/createTournament')
                .set('Authorization', `Bearer ${adminToken}`)
                .send(newTournament);

            expect(response.status).toBe(201);
            expect(response.body.success).toBe(true);
            expect(response.body.data.name).toBe(newTournament.name);
        });
    });
});
