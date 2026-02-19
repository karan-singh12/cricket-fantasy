const request = require('supertest');
const app = require('../../app');
const { knex: db } = require('../../config/database');

describe('User Management API', () => {
    let adminToken;

    beforeAll(async () => {
        // Create a test admin
        const password = 'testpassword123';
        const hashedPassword = await require('bcrypt').hash(password, 10);
        const [admin] = await db('admins').insert({
            name: 'Test Admin',
            email: `test_admin_${Date.now()}@example.com`,
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

    describe('POST /api/admin/users/addUser', () => {
        it('should add a new user successfully', async () => {
            const newUser = {
                name: 'Test User',
                email: `test_${Date.now()}@example.com`,
                phone: `123456${Math.floor(Math.random() * 1000)}`,
                dob: '1990-01-01'
            };

            const response = await request(app)
                .post('/api/admin/user/addUser')
                .set('Authorization', `Bearer ${adminToken}`)
                .send(newUser);

            expect(response.status).toBe(200);
            expect(response.body.status).toBe(true);
            expect(response.body.data.name).toBe(newUser.name);
            expect(response.body.data.is_bot).toBe(false);
        });
    });

    describe('POST /api/admin/users/getAllUser', () => {
        it('should list all users', async () => {
            const response = await request(app)
                .post('/api/admin/user/getAllUser')
                .set('Authorization', `Bearer ${adminToken}`)
                .send({});

            expect(response.status).toBe(200);
            expect(response.body.status).toBe(true);
            expect(Array.isArray(response.body.data.result)).toBe(true);
        });
    });
});
