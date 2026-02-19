const { knex: db } = require('./config/database');

function generateRandomBangladeshiName() {
    return "Diagnostic Bot";
}

async function testInsert() {
    try {
        const [created] = await db('users')
            .insert({
                name: generateRandomBangladeshiName(),
                email: `bot_${Date.now()}@mybest11.com`,
                phone: null,
                dob: null,
                gender: null,
                otp: null,
                otp_expires: null,
                is_verified: false,
                is_name_setup: false,
                kyc_verified: false,
                wallet_balance: 0,
                referral_code: null,
                referred_by: null,
                social_login_type: null,
                fb_id: null,
                google_id: null,
                apple_id: null,
                device_id: null,
                device_type: null,
                kyc_document: null,
                status: 1,
                is_reported_Arr: '{}',
                metadata: {},
                created_at: db.fn.now(),
                updated_at: db.fn.now(),
                image_url: null,
                permission: '{}',
                ftoken: null,
                referral_bonus: null,
                is_bot: true
            })
            .returning('*');
        console.log('Success:', created.id);
        process.exit(0);
    } catch (err) {
        console.error('Error:', err);
        process.exit(1);
    }
}

testInsert();
