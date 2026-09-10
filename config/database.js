const mysql = require('mysql2/promise');
require('dotenv').config();

const pool = mysql.createPool({
    host: process.env.DB_HOST || '127.0.0.1',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'kursus_mengemudi',
    port: parseInt(process.env.DB_PORT) || 3306,
    waitForConnections: true,
    connectionLimit: 10,
    timezone: '+07:00',
    dateStrings: true,
    enableKeepAlive: true,
    keepAliveInitialDelay: 10000
});

// Pastikan zona waktu sesi MySQL selalu diatur ke Asia/Jakarta (WIB: +07:00)
pool.on('connection', (connection) => {
    connection.query("SET time_zone = '+07:00'", (err) => {
        if (err) console.warn('Warning: Could not set session time_zone to +07:00:', err.message);
    });
});

// Test connection with retry
async function testConnection(retries = 3) {
    for (let i = 0; i < retries; i++) {
        try {
            const connection = await pool.getConnection();
            console.log('Database connected successfully');
            connection.release();
            return;
        } catch (error) {
            if (i < retries - 1) {
                console.log(`Database connection attempt ${i + 1} failed, retrying in 3s...`);
                await new Promise(r => setTimeout(r, 3000));
            } else {
                console.error('Database connection failed:', error.message);
                console.log('Pastikan MySQL sudah berjalan dan database sudah dibuat.');
                console.log('Jalankan file database/schema.sql di MySQL terlebih dahulu.');
            }
        }
    }
}

testConnection();

module.exports = pool;
