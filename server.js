const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const argon2 = require('argon2');
const fs = require('fs');
const crypto = require('crypto');
const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static('.'));
const db = new sqlite3.Database('C:/Users/karto/OneDrive/Рабочий стол/инфобез/pass.db', (err) => {
    if (err) {
        console.error('Ошибка подключения к БД:', err.message);
        process.exit(1);
    } else {
        console.log('Подключено к pass.db');
    }
});
// Таблица пользователей
// pepper — серверная соль, хранится отдельно от хеша
// session_token — токен для повторной авторизации без пароля
// token_expires — срок действия токена
db.run(`
    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        login TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        pepper TEXT NOT NULL,
        session_token TEXT,
        token_expires TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
`, (err) => {
    if (err) {
        console.error('Ошибка создания таблицы:', err.message);
    } else {
        console.log('Таблица users готова');
    }
});
db.run(`
    CREATE TABLE IF NOT EXISTS login_attempts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        login TEXT NOT NULL,
        attempt_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        success INTEGER DEFAULT 0,
        block_until TIMESTAMP
    )
`, (err) => {
    if (err) {
        console.error('Ошибка создания таблицы login_attempts:', err.message);
    } else {
        console.log('Таблица login_attempts готова');
    }
});
// Хранилище неудачных попыток в памяти
const failedAttempts = {};
function loadCommonPasswords() {
    try {
        const data = fs.readFileSync('common_passwords.txt', 'utf8');
        const list = data.split('\n')
            .map(p => p.trim().toLowerCase())
            .filter(p => p.length > 0);
        console.log('Загружено частых паролей: ' + list.length);
        return list;
    } catch (err) {
        console.warn('Файл common_passwords.txt не найден — проверка на частые пароли отключена');
        return [];
    }
}
const commonPasswords = loadCommonPasswords();
function validatePassword(password) {
    if (password.length < 8) {
        return { valid: false, message: 'Пароль должен содержать минимум 8 символов' };
    }
    if (!/\p{Lu}/u.test(password)) {
        return { valid: false, message: 'Пароль должен содержать заглавную букву' };
    }
    if (!/\p{Ll}/u.test(password)) {
        return { valid: false, message: 'Пароль должен содержать строчную букву' };
    }
    if (!/[0-9]/.test(password)) {
        return { valid: false, message: 'Пароль должен содержать цифру' };
    }
    if (!/[!@#$%^&*()_+\-=\[\]{};:'",.<>?/\\|`~ ]/.test(password)) {
        return { valid: false, message: 'Пароль должен содержать специальный символ (!@#$%^&* и т.д.)' };
    }
    if (commonPasswords.length > 0) {
        const normalized = password.toLowerCase().replace(/\s+/g, '');
        if (commonPasswords.includes(normalized)) {
            return { valid: false, message: 'Этот пароль слишком слабый, выберите другой' };
        }
    }
    return { valid: true, message: '' };
}
// Проверка блокировки — возвращает остаток в секундах (0 = не заблокирован)
function checkBlock(login) {
    const now = Date.now();
    const record = failedAttempts[login];
    if (!record) {
        return 0;
    }
    if (record.blockUntil && now < record.blockUntil) {
        return Math.ceil((record.blockUntil - now) / 1000);
    }
    if (record.blockUntil && now >= record.blockUntil) {
        delete failedAttempts[login];
        return 0;
    }
    return 0;
}
// Добавление неудачной попытки + ступенчатая блокировка:
// 1-я попытка  10 секунд
// 2-я попытка  30 секунд
// 3-я попытка  5 минут
// 4-я и далее  удвоение предыдущего времени (максимум 1 час)
function addFailedAttempt(login) {
    const now = Date.now();
    if (!failedAttempts[login]) {
        failedAttempts[login] = { count: 0, lastAttempt: now, blockUntil: 0, lastBlockDuration: 0 };
    }
    const record = failedAttempts[login];
    if (now - record.lastAttempt > 300000) {
        record.count = 0;
    }
    record.count += 1;
    record.lastAttempt = now;
    let blockDuration = 0;
    switch (record.count) {
        case 1: blockDuration = 10 * 1000; break;
        case 2: blockDuration = 30 * 1000; break;
        case 3: blockDuration = 5 * 60 * 1000; break;
        default:
            blockDuration = Math.min(
                (record.lastBlockDuration || 5 * 60 * 1000) * 2,
                60 * 60 * 1000
            );
    }
    record.blockUntil = now + blockDuration;
    record.lastBlockDuration = blockDuration;
}
function getBlockTimeRemaining(login) {
    return checkBlock(login) * 1000;
}
// Генерация серверной соли (pepper)
function generatePepper() {
    return crypto.randomBytes(32).toString('hex');
}
// Генерация токена сессии
function generateSessionToken() {
    return crypto.randomBytes(64).toString('hex');
}
// Хеширование пароля через argon2id с pepper
async function hashPassword(password, pepper) {
    return await argon2.hash(password + pepper, {
        type: argon2.argon2id,
        memoryCost: 19456,
        timeCost: 2,
        parallelism: 1,
    });
}
// Проверка пароля через argon2 + pepper
async function verifyPassword(hash, password, pepper) {
    return await argon2.verify(hash, password + pepper);
}
// Проверка токена в заголовке Authorization
function authMiddleware(req, res, next) {
    const authHeader = req.headers['authorization'];
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ success: false, message: 'Требуется авторизация' });
    }
    const token = authHeader.slice(7);
    db.get(
        'SELECT id, login, token_expires FROM users WHERE session_token = ?',
        [token],
        (err, row) => {
            if (err) {
                return res.status(500).json({ success: false, message: 'Ошибка базы данных' });
            }
            if (!row) {
                return res.status(401).json({ success: false, message: 'Неверный токен' });
            }
            if (row.token_expires && new Date(row.token_expires) < new Date()) {
                return res.status(401).json({ success: false, message: 'Токен истёк' });
            }
            req.user = { id: row.id, login: row.login };
            next();
        }
    );
}
// Проверка: свободен ли логин
app.post('/check-login', (req, res) => {
    const { login } = req.body;
    if (!login) {
        return res.json({ success: false, message: 'Логин не указан' });
    }
    db.get('SELECT id FROM users WHERE login = ?', [login], (err, row) => {
        if (err) {
            return res.json({ success: false, message: 'Ошибка базы данных' });
        }
        if (row) {
            return res.json({ success: true, available: false, message: 'Логин занят' });
        }
        res.json({ success: true, available: true, message: 'Логин свободен' });
    });
});
app.post('/register', async (req, res) => {
    const { login, password } = req.body;
    if (!login || !password) {
        return res.json({ success: false, message: 'Заполните все поля' });
    }
    if (login.length < 3) {
        return res.json({ success: false, message: 'Логин должен содержать минимум 3 символа' });
    }
    db.get('SELECT id FROM users WHERE login = ?', [login], async (err, row) => {
        if (err) {
            return res.json({ success: false, message: 'Ошибка базы данных' });
        }
        if (row) {
            return res.json({ success: false, message: 'Пользователь с таким логином уже существует' });
        }
        const passwordCheck = validatePassword(password);
        if (!passwordCheck.valid) {
            return res.json({ success: false, message: passwordCheck.message });
        }
        try {
            const pepper = generatePepper();
            const hashedPassword = await hashPassword(password, pepper);
            db.run(
                'INSERT INTO users (login, password, pepper) VALUES (?, ?, ?)',
                [login, hashedPassword, pepper],
                function(err) {
                    if (err) {
                        return res.json({ success: false, message: 'Ошибка при регистрации' });
                    }
                    res.json({ success: true, message: 'Регистрация успешна' });
                }
            );
        } catch (error) {
            res.json({ success: false, message: 'Ошибка сервера' });
        }
    });
});
app.post('/login', (req, res) => {
    const { login, password } = req.body;
    if (!login || !password) {
        return res.json({ success: false, message: 'Заполните все поля' });
    }
    const blockRemaining = getBlockTimeRemaining(login);
    if (blockRemaining > 0) {
        const seconds = Math.ceil(blockRemaining / 1000);
        return res.json({
            success: false,
            message: 'Слишком много неудачных попыток. Подождите ' + seconds + ' секунд'
        });
    }
    db.get('SELECT id, password, pepper FROM users WHERE login = ?', [login], async (err, row) => {
        if (err) {
            return res.json({ success: false, message: 'Ошибка базы данных' });
        }
        if (!row) {
            addFailedAttempt(login);
            return res.json({ success: false, message: 'Неверный логин или пароль' });
        }
        try {
            const match = await verifyPassword(row.password, password, row.pepper);
            if (match) {
                const token = generateSessionToken();
                const expires = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
                db.run(
                    'UPDATE users SET session_token = ?, token_expires = ? WHERE id = ?',
                    [token, expires, row.id],
                    (err) => {
                        if (err) {
                            return res.json({ success: false, message: 'Ошибка сохранения токена' });
                        }
                        failedAttempts[login] = null;
                        res.json({
                            success: true,
                            message: 'Вход выполнен',
                            token: token,
                            login: login
                        });
                    }
                );
            } else {
                addFailedAttempt(login);
                const blockRemaining = getBlockTimeRemaining(login);
                const record = failedAttempts[login] || {};
                const attemptsCount = record.count || 0;
                if (blockRemaining > 0) {
                    const seconds = Math.ceil(blockRemaining / 1000);
                    res.json({
                        success: false,
                        message: 'Неверный пароль. Попытка ' + attemptsCount + '. Блокировка на ' + seconds + ' секунд'
                    });
                } else {
                    res.json({
                        success: false,
                        message: 'Неверный пароль. Попытка ' + attemptsCount
                    });
                }
            }
        } catch (error) {
            res.json({ success: false, message: 'Ошибка проверки пароля' });
        }
    });
});
// Проверка текущего токена
app.get('/me', authMiddleware, (req, res) => {
    res.json({
        success: true,
        login: req.user.login
    });
});
// Выход — удаляем токен из БД
app.post('/logout', authMiddleware, (req, res) => {
    db.run(
        'UPDATE users SET session_token = NULL, token_expires = NULL WHERE id = ?',
        [req.user.id],
        (err) => {
            if (err) {
                return res.json({ success: false, message: 'Ошибка выхода' });
            }
            res.json({ success: true, message: 'Выход выполнен' });
        }
    );
});
const PORT = 3000;
app.listen(PORT, () => {
    console.log('Сервер запущен на порту 3000');
    console.log('http://localhost:3000');
    console.log('Ступенчатая блокировка: 1 раз  10 сек, 2 раза  30 сек, 3 раза  5 мин, далее удвоение');
    console.log('Хеширование: argon2id + серверный pepper');
    console.log('Авторизация: по токену в заголовке Authorization');
});