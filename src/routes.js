const express = require('express');
const router = express.Router();
const db = require('./db');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { registerUser, loginUser } = require('./auth'); // Убрали JWT_SECRET отсюда
const { JWT_SECRET } = require('./middleware'); // <-- ИСПРАВЛЕНО: берем секрет из middleware

// Проверка Access Token (Middleware)
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) return res.status(401).json({ success: false, message: 'Требуется токен' });

    jwt.verify(token, JWT_SECRET, (err, decoded) => {
        if (err) return res.status(401).json({ success: false, message: 'Неверный или истекший токен' });

        // Проверяем версию токена, чтобы убедиться, что он не устарел после обновления
        db.get(`SELECT access_version FROM sessions WHERE user_id = ? ORDER BY id DESC LIMIT 1`, [decoded.userId], (err, session) => {
            if (err || !session) return res.status(401).json({ success: false, message: 'Сессия не найдена' });
            
            // Приводим к числу, чтобы избежать ошибок сравнения строк и чисел
            if (Number(session.access_version) !== Number(decoded.version)) {
                return res.status(401).json({ success: false, message: 'Токен устарел' });
            }
            req.user = decoded;
            next();
        });
    });
}

// Проверка логина
router.post('/check-login', (req, res) => {
    const { login } = req.body;
    if (!login) return res.json({ success: false, message: 'Логин не указан' });
    
    db.get('SELECT id FROM users WHERE login = ?', [login], (err, row) => {
        if (err) return res.json({ success: false, message: 'Ошибка базы данных' });
        if (row) return res.json({ success: true, available: false, message: 'Логин занят' });
        res.json({ success: true, available: true, message: 'Логин свободен' });
    });
});

// Регистрация
router.post('/register', async (req, res) => {
    const { login, password } = req.body;
    const result = await registerUser(login, password);
    res.json(result);
});

// Вход
router.post('/login', async (req, res) => {
    const { login, password } = req.body;
    const result = await loginUser(login, password);
    
    if (result.success) {
        res.cookie('refreshToken', result.refreshToken, {
            httpOnly: true,
            secure: false, 
            sameSite: 'strict',
            maxAge: 2 * 24 * 60 * 60 * 1000 // 2 дня
        });
        res.json({ success: true, message: result.message, accessToken: result.accessToken });
    } else {
        res.json(result);
    }
});

// ОБНОВЛЕНИЕ ТОКЕНОВ (С защитой от параллельных запросов)
router.post('/refresh', (req, res) => {
    const refreshToken = req.cookies.refreshToken;
    if (!refreshToken) return res.status(401).json({ success: false, message: 'Нет refresh токена' });

    const hash = crypto.createHash('sha256').update(refreshToken).digest('hex');
    const now = Math.floor(Date.now() / 1000);

    db.get(
        `SELECT * FROM sessions WHERE refresh_hash = ? OR (prev_refresh_hash = ? AND (? - rotated_at) < 30)`,
        [hash, hash, now],
        async (err, session) => {
            if (err || !session) {
                db.run(`DELETE FROM sessions WHERE prev_refresh_hash = ?`, [hash]);
                return res.status(401).json({ success: false, message: 'Сессия недействительна' });
            }

            if (now > session.expires_at) {
                db.run(`DELETE FROM sessions WHERE id = ?`, [session.id]);
                return res.status(401).json({ success: false, message: 'Сессия истекла. Войдите снова' });
            }

            // Если это параллельный запрос (вторая вкладка)
            if (session.prev_refresh_hash === hash) {
                const accessToken = jwt.sign({ userId: session.user_id, version: session.access_version }, JWT_SECRET, { expiresIn: '15m' });
                return res.json({ success: true, accessToken: accessToken });
            }

            // Обычная ротация
            const newRefreshToken = crypto.randomBytes(32).toString('hex');
            const newHash = crypto.createHash('sha256').update(newRefreshToken).digest('hex');
            const newVersion = session.access_version + 1;

            db.run(
                `UPDATE sessions SET prev_refresh_hash = refresh_hash, refresh_hash = ?, rotated_at = ?, access_version = ? WHERE id = ?`,
                [newHash, now, newVersion, session.id],
                (updateErr) => {
                    if (updateErr) return res.status(500).json({ success: false, message: 'Ошибка БД' });

                    const newAccessToken = jwt.sign({ userId: session.user_id, version: newVersion }, JWT_SECRET, { expiresIn: '15m' });

                    res.cookie('refreshToken', newRefreshToken, {
                        httpOnly: true,
                        secure: false,
                        sameSite: 'strict',
                        maxAge: 2 * 24 * 60 * 60 * 1000
                    });

                    res.json({ success: true, accessToken: newAccessToken });
                }
            );
        }
    );
});

// Защищенный маршрут профиля
router.get('/profile', authenticateToken, (req, res) => {
    db.get('SELECT login FROM users WHERE id = ?', [req.user.userId], (err, row) => {
        if (err || !row) return res.status(404).json({ success: false, message: 'Пользователь не найден' });
        res.json({ success: true, login: row.login });
    });
});

// Выход
router.post('/logout', (req, res) => {
    const refreshToken = req.cookies.refreshToken;
    if (refreshToken) {
        const hash = crypto.createHash('sha256').update(refreshToken).digest('hex');
        db.run(`DELETE FROM sessions WHERE refresh_hash = ? OR prev_refresh_hash = ?`, [hash, hash]);
    }
    res.clearCookie('refreshToken');
    res.json({ success: true, message: 'Выход выполнен' });
});

module.exports = router;