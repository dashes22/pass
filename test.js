const { checkBlock, addFailedAttempt, getBlockTimeRemaining, failedAttempts } = require('./src/block');
const { validatePassword, validateLogin } = require('./src/validate');
const { test, run } = require('node:test');
const assert = require('node:assert');
const commonPassword = require('common-password');

//ТЕСТЫ ПАРОЛЯ 
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