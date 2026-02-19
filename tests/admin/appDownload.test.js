const request = require('supertest');
const app = require('../../app');
const { knex: db } = require('../../config/database');
const path = require('path');
const fs = require('fs');

describe('App Download Management API', () => {
    let adminToken;
    let testAppId;

    beforeAll(async () => {
        // Create a test admin
        const password = 'testpassword123';
        const hashedPassword = await require('bcrypt').hash(password, 10);
        const [admin] = await db('admins').insert({
            name: 'Test Admin App',
            email: `test_admin_app_${Date.now()}@example.com`,
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

        // Ensure public/apk directory exists
        const apkDir = path.join(__dirname, '../../public/apk');
        if (!fs.existsSync(apkDir)) {
            fs.mkdirSync(apkDir, { recursive: true });
        }
    });

    afterAll(async () => {
        await db.destroy();
    });

    describe('POST /api/admin/app/upload', () => {
        it('should upload a mock APK successfully', async () => {
            // Create a dummy file
            const dummyFilePath = path.join(__dirname, 'test.apk');
            fs.writeFileSync(dummyFilePath, 'dummy content');

            const response = await request(app)
                .post('/api/admin/app/upload')
                .set('Authorization', `Bearer ${adminToken}`)
                .field('current_version', '1.0.1')
                .field('previous_version', '1.0.0')
                .attach('apk', dummyFilePath);

            expect(response.status).toBe(200);
            expect(response.body.status).toBe(true);
            expect(response.body.data.current_version).toBe('1.0.1');
            testAppId = response.body.data.id;

            // Cleanup dummy file
            fs.unlinkSync(dummyFilePath);
        });
    });

    describe('GET /api/admin/app/getall', () => {
        it('should list all app downloads', async () => {
            const response = await request(app)
                .get('/api/admin/app/getall')
                .set('Authorization', `Bearer ${adminToken}`);

            expect(response.status).toBe(200);
            expect(response.body.status).toBe(true);
            expect(Array.isArray(response.body.data)).toBe(true);
        });
    });

    describe('POST /api/admin/app/force-update', () => {
        it('should check for update correctly', async () => {
            const response = await request(app)
                .post('/api/admin/app/force-update')
                .send({
                    currentVersion: '1.0.0',
                    platform: 'android'
                });

            expect(response.status).toBe(200);
            expect(response.body.status).toBe(true);
            expect(response.body.data.forceUpdate).toBe(true);
            expect(response.body.data.download_url).toContain('/public/apk/');
        });

        it('should return no update if already on latest', async () => {
            const response = await request(app)
                .post('/api/admin/app/force-update')
                .send({
                    currentVersion: '1.0.1',
                    platform: 'android'
                });

            expect(response.status).toBe(200);
            expect(response.body.data.forceUpdate).toBe(false);
        });
    });
});
