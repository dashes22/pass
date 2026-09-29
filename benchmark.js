const argon2 = require('argon2');
async function benchmark() {
    const password = 'TestPassword123!';
    const pepper = 'testpepper';
    const ITERATIONS = 10;
    const options = {
        type: argon2.argon2id,
        memoryCost: 65536,
        timeCost: 3,
        parallelism: 1,
    };
    console.log('Прогрев...');
    await argon2.hash(password + pepper, options);
    let totalHash = 0;
    for (let i = 0; i < ITERATIONS; i++) {
        const start = process.hrtime.bigint();
        await argon2.hash(password + pepper, options);
        const end = process.hrtime.bigint();
        totalHash += Number(end - start) / 1_000_000;
    }
    const hash = await argon2.hash(password + pepper, options);
    let totalVerify = 0;
    for (let i = 0; i < ITERATIONS; i++) {
        const start = process.hrtime.bigint();
        await argon2.verify(hash, password + pepper);
        const end = process.hrtime.bigint();
        totalVerify += Number(end - start) / 1_000_000;
    }
    console.log('');
    console.log('Бенчмарк argon2id');
    console.log(`memoryCost: ${options.memoryCost} KiB (${options.memoryCost / 1024} MiB)`);
    console.log(`timeCost:   ${options.timeCost}`);
    console.log(`parallelism: ${options.parallelism}`);
    console.log('');
    console.log(`Хеширование:  ${(totalHash / ITERATIONS).toFixed(2)} мс`);
    console.log(`Проверка:     ${(totalVerify / ITERATIONS).toFixed(2)} мс`);
}
benchmark();