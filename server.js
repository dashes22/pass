const express = require('express');
const cors = require('cors');
const routes = require('./src/routes');
const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static(__dirname));
app.use('/', routes);
const PORT = 3000;
app.listen(PORT, () => {
    console.log('Сервер запущен на порту 3000');
    console.log('http://localhost:3000');
    console.log('Частые пароли проверяются через библиотеку common-password');
});