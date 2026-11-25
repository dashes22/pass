const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '..', 'pass.db');

const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Ошибка подключения к БД:', err.message);
        process.exit(1);
    } else {
        console.log('Подключено к ' + dbPath);
    }
});
db.run(`
    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        login TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        pepper TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
`, (err) => {
    if (err) {
        console.error('Ошибка создания таблицы users:', err.message);
    } else {
        console.log('Таблица users готова');
    }
});
db.run(`
    CREATE TABLE IF NOT EXISTS sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        refresh_hash TEXT NOT NULL,
        prev_refresh_hash TEXT,     
        rotated_at INTEGER,         
        expires_at INTEGER NOT NULL,
        access_version INTEGER DEFAULT 1,
        FOREIGN KEY(user_id) REFERENCES users(id)
    )
`, (err) => {
    if (err) {
        console.error('Ошибка создания таблицы sessions:', err.message);
    } else {
        console.log('Таблица sessions готова');
    }
});

module.exports = db;