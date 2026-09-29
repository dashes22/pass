const express = require('express');
const router = express.Router();
const db = require('./db');
const { registerUser, loginUser } = require('./auth');

router.post('/check-login', (req, res) => {
    const { login } = req.body;
    if (!login) {
        return res.json({ success: false, message: 'Логин не указан' });
    }
    db.get('SELECT id FROM users WHERE login = ?', [login], (err, row) => {
        if (err) {
            return res.json({ success: false, message: 'Ошибка базы данных' });
        }
        if (row) {
            return res.json({ success: true, available: false, message: 'Логин занят' });
        }
        res.json({ success: true, available: true, message: 'Логин свободен' });
    });
});

router.post('/register', async (req, res) => {
    const { login, password } = req.body;
    const result = await registerUser(login, password);
    res.json(result);
});

router.post('/login', async (req, res) => {
    const { login, password } = req.body;
    const result = await loginUser(login, password);
    res.json(result);
});

module.exports = router;