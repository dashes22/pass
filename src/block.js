const failedAttempts = {};
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
function resetAttempts(login) {
    failedAttempts[login] = null;
}
module.exports = { checkBlock, addFailedAttempt, getBlockTimeRemaining, resetAttempts, failedAttempts };