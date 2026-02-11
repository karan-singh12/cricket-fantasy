const app = require('../app');
const db = require('../config/database');

const startServer = async () => {
    try {
        // Test database connection
        await db.raw('SELECT 1');
        console.log('Database connection successful');

        const PORT = process.env.PORT || 3000;
        app.listen(PORT, () => {
            console.log('Fantasy Cricket Server Started');
            console.log(`Server: Running on port ${PORT}`);
            console.log(`Environment: ${process.env.NODE_ENV}`);
        });
    } catch (error) {
        console.error('Server failed to start:', error.message);
        process.exit(1);
    }
};

startServer(); 