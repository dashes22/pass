const commonPassword = require('common-password');
function isCommonPassword(password) {
    return commonPassword(password);
}
async function validatePassword(password) {
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
        return { valid: false, message: 'Пароль должен содержать специальный символ' };
    }
    if (isCommonPassword(password)) {
        return { valid: false, message: 'Этот пароль слишком слабый, выберите другой' };
    }
    return { valid: true, message: '' };
}
function validateLogin(login) {
    if (!login || login.trim().length === 0) {
        return { valid: false, message: 'Логин не указан' };
    }
    if (login.length < 3) {
        return { valid: false, message: 'Логин должен содержать минимум 3 символа' };
    }
    return { valid: true, message: '' };
}
module.exports = { validatePassword, validateLogin, isCommonPassword };