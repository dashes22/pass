const db = require('./db');
const { validatePassword, validateLogin } = require('./validate');
const { checkBlock, addFailedAttempt, getBlockTimeRemaining, resetAttempts, failedAttempts } = require('./block');
const { generatePepper, hashPassword, verifyPassword } = require('./crypto');
async function registerUser(login, password) {
    if (!login || !password) {
        return { success: false, message: 'Заполните все поля' };
    }
    const loginCheck = validateLogin(login);
    if (!loginCheck.valid) {
        return { success: false, message: loginCheck.message };
    }
    return new Promise((resolve) => {
        db.get('SELECT id FROM users WHERE login = ?', [login], async (err, row) => {
            if (err) {
                return resolve({ success: false, message: 'Ошибка базы данных' });
            }
            if (row) {
                return resolve({ success: false, message: 'Пользователь с таким логином уже существует' });
            }
            const passwordCheck = await validatePassword(password);
            if (!passwordCheck.valid) {
                return resolve({ success: false, message: passwordCheck.message });
            }
            try {
                const pepper = generatePepper();
                const hashedPassword = await hashPassword(password, pepper);
                db.run(
                    'INSERT INTO users (login, password, pepper) VALUES (?, ?, ?)',
                    [login, hashedPassword, pepper],
                    function (err) {
                        if (err) {
                            return resolve({ success: false, message: 'Ошибка при регистрации' });
                        }
                        resolve({ success: true, message: 'Регистрация успешна' });
                    }
                );
            } catch (error) {
                resolve({ success: false, message: 'Ошибка сервера' });
            }
        });
    });
}
async function loginUser(login, password) {
    if (!login || !password) {
        return { success: false, message: 'Заполните все поля' };
    }
    const blockRemaining = getBlockTimeRemaining(login);
    if (blockRemaining > 0) {
        const seconds = Math.ceil(blockRemaining / 1000);
        return {
            success: false,
            message: 'Слишком много неудачных попыток. Подождите ' + seconds + ' секунд'
        };
    }
    return new Promise((resolve) => {
        db.get('SELECT id, password, pepper FROM users WHERE login = ?', [login], async (err, row) => {
            if (err) {
                return resolve({ success: false, message: 'Ошибка базы данных' });
            }
            if (!row) {
                addFailedAttempt(login);
                return resolve({ success: false, message: 'Неверный логин или пароль' });
            }
            try {
                const match = await verifyPassword(row.password, password, row.pepper);
                if (match) {
                    resetAttempts(login);
                    resolve({
                        success: true,
                        message: 'Вход выполнен',
                        login: login
                    });
                } else {
                    addFailedAttempt(login);
                    const blockRemaining = getBlockTimeRemaining(login);
                    const record = failedAttempts[login] || {};
                    const attemptsCount = record.count || 0;

                    if (blockRemaining > 0) {
                        const seconds = Math.ceil(blockRemaining / 1000);
                        resolve({
                            success: false,
                            message: 'Неверный пароль. Попытка ' + attemptsCount + '. Блокировка на ' + seconds + ' секунд'
                        });
                    } else {
                        resolve({
                            success: false,
                            message: 'Неверный пароль. Попытка ' + attemptsCount
                        });
                    }
                }
            } catch (error) {
                resolve({ success: false, message: 'Ошибка проверки пароля' });
            }
        });
    });
}
module.exports = { registerUser, loginUser };