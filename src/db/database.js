const knex = require('knex');
const knexfile = require('../../knexfile');

class Database {
    constructor() {
        this.knex = null;
        this.isConnected = false;
    }

    async connect() {
        const env = process.env.NODE_ENV || 'development';
        this.knex = knex(knexfile[env]);

        try {
            await this.knex.raw('SELECT 1');
            this.isConnected = true;
            console.log('Database: Connected');
        } catch (error) {
            this.isConnected = false;
            console.log('Database: Not connected');
            console.error('Error:', error.message);
        }
    }

    async disconnect() {
        if (this.knex) {
            await this.knex.destroy();
            this.isConnected = false;
            console.log('Database: Disconnected');
        }
    }

    getKnex() {
        return this.knex;
    }
}

const db = new Database();

module.exports = db; 