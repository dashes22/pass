const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const bcrypt = require('bcrypt');
const fs = require('fs');
const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('.'));
const db = new sqlite3.Database('C:/Users/karto/OneDrive/Рабочий стол/инфобез/pass.db', (err) => {
    if (err) {
        console.error('Ошибка подключения к БД:', err.message);
        process.exit(1);
    } else {
        console.log('Подключено к pass.db');
    }
});
db.run(`
    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        login TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
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
        success INTEGER DEFAULT 0
    )
`, (err) => {
    if (err) {
        console.error('Ошибка создания таблицы login_attempts:', err.message);
    } else {
        console.log('Таблица login_attempts готова');
    }
});
const failedAttempts = {};
function loadCommonPasswords() {
    try {
        const data = fs.readFileSync('common_passwords.txt', 'utf8');
        return data.split('\n').map(p => p.trim().toLowerCase()).filter(p => p.length > 0);
    } catch (err) {
        return [
            '12345678', 'password', '123456789', 'qwerty123', 'qwertyui',
            'password1', '1234567890', 'qwerty', 'abc123456', 'admin123',
            '11111111', '22222222', '33333333', '44444444', '55555555',
            '1234567', 'admin', 'password123', 'qwerty123456', 'letmein',
            'welcome1', 'monkey', 'dragon', 'master', 'sunshine',
            'princess', 'iloveyou', 'football', '123123123', 'qazwsx'
        ];
    }
}
const commonPasswords = loadCommonPasswords();
function validatePassword(password) {
    if (password.length < 8) {
        return { valid: false, message: 'Пароль должен содержать минимум 8 символов' };
    }
    if (!/[A-Z]/.test(password)) {
        return { valid: false, message: 'Пароль должен содержать заглавную букву' };
    }
    if (!/[a-z]/.test(password)) {
        return { valid: false, message: 'Пароль должен содержать строчную букву' };
    }
    if (!/[0-9]/.test(password)) {
        return { valid: false, message: 'Пароль должен содержать цифру' };
    }
    if (!/[!@#$%^&*()_+\-=\[\]{};:'",.<>?/\\|`~]/.test(password)) {
        return { valid: false, message: 'Пароль должен содержать специальный символ (!@#$%^&* и т.д.)' };
    }
    if (commonPasswords.includes(password.toLowerCase())) {
        return { valid: false, message: 'Этот пароль слишком слабый, выберите другой' };
    }
    return { valid: true, message: '' };
}
function checkBlock(login) {
    const now = Date.now();
    const attempts = failedAttempts[login] || [];
    const recentAttempts = attempts.filter(time => now - time < 120000);
    failedAttempts[login] = recentAttempts;
    return recentAttempts.length >= 3;
}
function addFailedAttempt(login) {
    if (!failedAttempts[login]) {
        failedAttempts[login] = [];
    }
    failedAttempts[login].push(Date.now());
    const now = Date.now();
    failedAttempts[login] = failedAttempts[login].filter(time => now - time < 120000);
}
function getBlockTimeRemaining(login) {
    const attempts = failedAttempts[login] || [];
    if (attempts.length < 3) {
        return 0;
    }
    const oldestAttempt = attempts[0];
    const timePassed = Date.now() - oldestAttempt;
    const remaining = 120000 - timePassed;
    return Math.max(0, remaining);
}
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
            const saltRounds = 10;
            const hashedPassword = await bcrypt.hash(password, saltRounds);   
            db.run(
                'INSERT INTO users (login, password) VALUES (?, ?)',
                [login, hashedPassword],
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
    db.get('SELECT id, password FROM users WHERE login = ?', [login], async (err, row) => {
        if (err) {
            return res.json({ success: false, message: 'Ошибка базы данных' });
        } 
        if (!row) {
            addFailedAttempt(login);
            return res.json({ success: false, message: 'Такого аккаунта не существует' });
        } 
        try {
            const match = await bcrypt.compare(password, row.password); 
            if (match) {
                failedAttempts[login] = [];
                res.json({ success: true, message: 'Вход выполнен' });
            } else {
                addFailedAttempt(login);
                const remaining = getBlockTimeRemaining(login);
                if (remaining > 0) {
                    const seconds = Math.ceil(remaining / 1000);
                    res.json({ 
                        success: false, 
                        message: 'Неверный пароль. Осталось попыток: ' + (3 - (failedAttempts[login] || []).length) + '. Блокировка через ' + seconds + 'с' 
                    });
                } else {
                    const attemptsLeft = 3 - (failedAttempts[login] || []).length;
                    res.json({ 
                        success: false, 
                        message: 'Неверный пароль. Осталось попыток: ' + attemptsLeft 
                    });
                }
            }
        } catch (error) {
            res.json({ success: false, message: 'Ошибка проверки пароля' });
        }
    });
});
const PORT = 3000;
app.listen(PORT, () => {
    console.log('Сервер запущен на порту 3000');
    console.log('http://localhost:3000');
    console.log('Блокировка после 3 неудачных попыток на 2 минуты');
});