const jwt = require('jsonwebtoken');
const db = require('./db');

const JWT_SECRET = 'super_secret_key_change_me_in_prod'; // В проде вынести в .env

function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) return res.status(401).json({ success: false, message: 'Требуется токен' });

    jwt.verify(token, JWT_SECRET, (err, decoded) => {
        if (err) return res.status(401).json({ success: false, message: 'Неверный или истекший токен' });

        // Проверяем версию токена в сессии
        db.get(`SELECT access_version FROM sessions WHERE user_id = ? ORDER BY id DESC LIMIT 1`, [decoded.userId], (err, session) => {
            if (err || !session) return res.status(401).json({ success: false, message: 'Сессия не найдена' });
            
            // Если версия не совпадает, значит токен устарел (произошла ротация)
            if (session.access_version !== decoded.version) {
                return res.status(401).json({ success: false, message: 'Токен устарел' });
            }

            req.user = decoded;
            next();
        });
    });
}

module.exports = { authenticateToken, JWT_SECRET };