const request = require('supertest');
const app = require('../../app');
const { knex: db } = require('../../config/database');

describe('Bot Management API', () => {
    let adminToken;

    beforeAll(async () => {
        // Create a test admin
        const password = 'testpassword123';
        const hashedPassword = await require('bcrypt').hash(password, 10);
        const [admin] = await db('admins').insert({
            name: 'Test Admin Bot',
            email: `test_admin_bot_${Date.now()}@example.com`,
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

    describe('POST /api/admin/bot/addBotUser', () => {
        it('should create a new bot user successfully', async () => {
            const response = await request(app)
                .post('/api/admin/bot/addBotUser')
                .set('Authorization', `Bearer ${adminToken}`)
                .send({}); // createBotUser in botController doesn't seem to take body, it generates random name

            expect(response.status).toBe(200);
            expect(response.body.status).toBe(true);
            expect(response.body.data.is_bot).toBe(true);
        });
    });

    describe('POST /api/admin/bot/getAllBotUser', () => {
        it('should list all bot users', async () => {
            const response = await request(app)
                .post('/api/admin/bot/getAllBotUser')
                .set('Authorization', `Bearer ${adminToken}`)
                .send({});

            expect(response.status).toBe(200);
            expect(response.body.status).toBe(true);
            expect(Array.isArray(response.body.data.result)).toBe(true);
            // Ensure only bots are returned
            if (response.body.data.result.length > 0) {
                expect(response.body.data.result[0].is_bot).toBe(true);
            }
        });
    });
});
