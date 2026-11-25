const jwt = require('jsonwebtoken');
const ACCESS_SECRET = 'super_secret_access_key_123';
const REFRESH_SECRET = 'super_secret_refresh_key_456';

// Время жизни: Access  15 минут, Refresh - 2 дня 
const ACCESS_EXPIRES_IN = '15m';
const REFRESH_EXPIRES_IN = '2d';

/**
 * Генерирует пару токенов для пользователя
 * @param {object} user - объект пользователя (минимум { id, login })
 */
function generateTokens(user) {
    const payload = { id: user.id, login: user.login };

    const accessToken = jwt.sign(payload, ACCESS_SECRET, { expiresIn: ACCESS_EXPIRES_IN });
    const refreshToken = jwt.sign(payload, REFRESH_SECRET, { expiresIn: REFRESH_EXPIRES_IN });

    return { accessToken, refreshToken };
}

/**
 * Проверяет Access-токен
 * @param {string} token 
 * @returns {object|null} - расшифрованные данные или null, если токен невалиден/просрочен
 */
function verifyAccessToken(token) {
    try {
        return jwt.verify(token, ACCESS_SECRET);
    } catch (err) {
        return null; // Токен просрочен или подделан
    }
}

/**
 * Проверяет Refresh-токен
 * @param {string} token 
 * @returns {object|null}
 */
function verifyRefreshToken(token) {
    try {
        return jwt.verify(token, REFRESH_SECRET);
    } catch (err) {
        return null;
    }
}

module.exports = {
    generateTokens,
    verifyAccessToken,
    verifyRefreshToken
};