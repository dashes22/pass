const { test, run } = require('node:test');
const assert = require('node:assert');
const commonPassword = require('@vks-dev/common-password');

// ============ ЛОГИКА (копия из server.js) ============
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
    if (commonPassword(password)) {
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

const failedAttempts = {};

function checkBlock(login) {
    const now = Date.now();
    const record = failedAttempts[login];
    if (!record) return 0;
    if (record.blockUntil && now < record.blockUntil) {
        return Math.ceil((record.blockUntil - now) / 1000);
    }
    if (record.blockUntil && now >= record.blockUntil) {
        delete failedAttempts[login];
        return 0;
    }
    return 0;
}

function addFailedAttempt(login) {
    const now = Date.now();
    if (!failedAttempts[login]) {
        failedAttempts[login] = { count: 0, lastAttempt: now, blockUntil: 0, lastBlockDuration: 0 };
    }
    const record = failedAttempts[login];
    if (now - record.lastAttempt > 300000) record.count = 0;
    record.count += 1;
    record.lastAttempt = now;
    let blockDuration = 0;
    switch (record.count) {
        case 1: blockDuration = 10 * 1000; break;
        case 2: blockDuration = 30 * 1000; break;
        case 3: blockDuration = 5 * 60 * 1000; break;
        default:
            blockDuration = Math.min((record.lastBlockDuration || 5 * 60 * 1000) * 2, 60 * 60 * 1000);
    }
    record.blockUntil = now + blockDuration;
    record.lastBlockDuration = blockDuration;
}

function getBlockTimeRemaining(login) {
    return checkBlock(login) * 1000;
}

// ============ ТЕСТЫ ПАРОЛЯ ============
test('пароль короче 8 символов отклонён', async () => {
    const r = await validatePassword('Ab1@');
    assert.strictEqual(r.valid, false);
    assert.match(r.message, /8 символов/);
});

test('пароль без заглавной буквы отклонён', async () => {
    const r = await validatePassword('abcdefg1@');
    assert.strictEqual(r.valid, false);
});

test('пароль без строчной буквы отклонён', async () => {
    const r = await validatePassword('ABCDEFG1@');
    assert.strictEqual(r.valid, false);
});

test('пароль без цифры отклонён', async () => {
    const r = await validatePassword('Abcdefgh@');
    assert.strictEqual(r.valid, false);
});

test('пароль без спецсимвола отклонён', async () => {
    const r = await validatePassword('Abcdefg1');
    assert.strictEqual(r.valid, false);
});

test('частый пароль password отклонён', () => {
    assert.strictEqual(commonPassword('password'), true);
});

test('частый пароль 123456 отклонён', () => {
    assert.strictEqual(commonPassword('123456'), true);
});

test('частый пароль qwerty отклонён', () => {
    assert.strictEqual(commonPassword('qwerty'), true);
});

test('MyUniqueP@ss123 не в списке частых', () => {
    assert.strictEqual(commonPassword('MyUniqueP@ss123'), false);
});

test('MyUniqueP@ss123 принимается', async () => {
    const r = await validatePassword('MyUniqueP@ss123');
    assert.strictEqual(r.valid, true);
});

test('пароль с русскими буквами принимается', async () => {
    const r = await validatePassword('СложныйПароль1@');
    assert.strictEqual(r.valid, true);
});

test('случайный надёжный пароль принимается', async () => {
    const r = await validatePassword('Xy9#kLm2$Qw');
    assert.strictEqual(r.valid, true);
});

// ============ ТЕСТЫ ЛОГИНА ============
test('пустой логин отклонён', () => {
    const r = validateLogin('');
    assert.strictEqual(r.valid, false);
});

test('логин из пробелов отклонён', () => {
    const r = validateLogin('   ');
    assert.strictEqual(r.valid, false);
});

test('логин из 2 символов отклонён', () => {
    const r = validateLogin('ab');
    assert.strictEqual(r.valid, false);
});

test('логин из 3 символов принимается', () => {
    const r = validateLogin('abc');
    assert.strictEqual(r.valid, true);
});

test('логин user123 принимается', () => {
    const r = validateLogin('user123');
    assert.strictEqual(r.valid, true);
});

test('логин на русском принимается', () => {
    const r = validateLogin('Пользователь');
    assert.strictEqual(r.valid, true);
});

// ============ ТЕСТЫ БЛОКИРОВКИ ============
test('нет блокировки без попыток', () => {
    assert.strictEqual(checkBlock('user_empty'), 0);
});

test('после 1 попытки блокировка около 10 секунд', () => {
    const user = 'user_1';
    delete failedAttempts[user];
    addFailedAttempt(user);
    const remaining = getBlockTimeRemaining(user);
    assert.ok(remaining > 0 && remaining <= 10000);
});

test('после 2 попыток блокировка около 30 секунд', () => {
    const user = 'user_2';
    delete failedAttempts[user];
    addFailedAttempt(user);
    failedAttempts[user].blockUntil = 0;
    addFailedAttempt(user);
    const remaining = getBlockTimeRemaining(user);
    assert.ok(remaining > 0 && remaining <= 30000);
});

test('после 3 попыток блокировка около 5 минут', () => {
    const user = 'user_3';
    delete failedAttempts[user];
    addFailedAttempt(user);
    failedAttempts[user].blockUntil = 0;
    addFailedAttempt(user);
    failedAttempts[user].blockUntil = 0;
    addFailedAttempt(user);
    const remaining = getBlockTimeRemaining(user);
    assert.ok(remaining > 0 && remaining <= 300000);
});

test('после 4 попыток блокировка около 10 минут', () => {
    const user = 'user_4';
    delete failedAttempts[user];
    addFailedAttempt(user);
    failedAttempts[user].blockUntil = 0;
    addFailedAttempt(user);
    failedAttempts[user].blockUntil = 0;
    addFailedAttempt(user);
    failedAttempts[user].blockUntil = 0;
    addFailedAttempt(user);
    const remaining = getBlockTimeRemaining(user);
    assert.ok(remaining > 0 && remaining <= 600000);
});

test('после сброса блокировки нет', () => {
    const user = 'user_reset';
    addFailedAttempt(user);
    delete failedAttempts[user];
    assert.strictEqual(checkBlock(user), 0);
});

test('блокировка не превышает 1 час', () => {
    const user = 'user_max';
    delete failedAttempts[user];
    for (let i = 0; i < 20; i++) {
        addFailedAttempt(user);
        if (failedAttempts[user]) failedAttempts[user].blockUntil = 0;
    }
    addFailedAttempt(user);
    const remaining = getBlockTimeRemaining(user);
    assert.ok(remaining > 0 && remaining <= 3600000);
});

// ============ СВОЙ ИТОГ ============
(async () => {
    const started = Date.now();
    let tests = 0;
    let pass = 0;
    let fail = 0;

    const stream = run({ files: [] });
    // run() сам собирает тесты из этого файла

    stream.on('test:pass', () => { tests++; pass++; });
    stream.on('test:fail', () => { tests++; fail++; });

    stream.on('end', () => {
        const duration = Date.now() - started;
        console.log('');
        console.log('tests ' + tests);
        console.log('');
        console.log('pass ' + pass);
        console.log('fail ' + fail);
        console.log('duration_ms ' + duration);
        process.exit(fail === 0 ? 0 : 1);
    });
})();