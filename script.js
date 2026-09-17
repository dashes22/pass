(function() {
    const loginInput = document.getElementById('loginInput');
    const passwordInput = document.getElementById('passwordInput');
    const confirmPasswordInput = document.getElementById('confirmPasswordInput');
    const confirmPasswordField = document.getElementById('confirmPasswordField');
    const registerBtn = document.getElementById('registerBtn');
    const loginBtn = document.getElementById('loginBtn');
    const statusMsg = document.getElementById('statusMessage');
    const loggedInBlock = document.getElementById('loggedInBlock');
    const currentLogin = document.getElementById('currentLogin');
    const logoutBtn = document.getElementById('logoutBtn');
    let statusTimeout = null;
    function setStatus(text, isError) {
        if (statusTimeout) {
            clearTimeout(statusTimeout);
            statusTimeout = null;
        }
        statusMsg.textContent = text;
        statusMsg.style.color = isError ? '#d32f2f' : '#2e7d32';
        statusTimeout = setTimeout(function() {
            statusMsg.textContent = '';
            statusMsg.style.color = '#2a7de1';
            statusTimeout = null;
        }, 4000);
    }
    function showLoggedIn(login) {
        if (loggedInBlock && currentLogin) {
            loggedInBlock.style.display = 'block';
            currentLogin.textContent = login;
        }
    }
    function hideLoggedIn() {
        if (loggedInBlock) {
            loggedInBlock.style.display = 'none';
        }
    }
    function showConfirmPasswordField() {
        if (confirmPasswordField) {
            confirmPasswordField.style.display = 'block';
        }
    }
    function hideConfirmPasswordField() {
        if (confirmPasswordField) {
            confirmPasswordField.style.display = 'none';
        }
        if (confirmPasswordInput) {
            confirmPasswordInput.value = '';
        }
    }
    // Проверяет, свободен ли логин — запрос на /check-login
    async function checkLoginAvailable(login) {
        try {
            const response = await fetch('http://localhost:3000/check-login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ login: login })
            });
            const data = await response.json();
            return data.success && data.available === true;
        } catch (error) {
            console.error('Ошибка проверки логина:', error);
            return false;
        }
    }
    async function sendRequest(action, login, password) {
        try {
            const response = await fetch('http://localhost:3000/' + action, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ login: login, password: password })
            });
            const data = await response.json();
            setStatus(data.message, !data.success);
            if (data.success) {
                loginInput.value = '';
                passwordInput.value = '';
                if (action === 'register') {
                    hideConfirmPasswordField();
                }
                if (action === 'login' && data.token) {
                    localStorage.setItem('token', data.token);
                    localStorage.setItem('login', data.login || login);
                    showLoggedIn(data.login || login);
                }
            }
        } catch (error) {
            setStatus('Ошибка соединения с сервером', true);
            console.error(error);
        }
    }
    function handleLogin() {
        const login = loginInput.value.trim();
        const password = passwordInput.value.trim();
        if (!login || !password) {
            setStatus('Заполните оба поля', true);
            return;
        }
        hideConfirmPasswordField();
        sendRequest('login', login, password);
    }
    // Теперь сначала проверяем логин на сервере, и только если свободен — просим повтор
    async function handleRegister() {
        const login = loginInput.value.trim();
        const password = passwordInput.value.trim();
        if (!login || !password) {
            setStatus('Заполните оба поля', true);
            return;
        }
        if (login.length < 3) {
            setStatus('Логин должен содержать минимум 3 символа', true);
            return;
        }
        // Если поле повтора ещё скрыто — сначала проверяем логин на сервере
        if (confirmPasswordField && confirmPasswordField.style.display === 'none') {
            const available = await checkLoginAvailable(login);
            if (!available) {
                setStatus('Пользователь с таким логином уже существует', true);
                return;  // не показываем поле повтора
            }
            showConfirmPasswordField();
            setStatus('Логин свободен. Повторите пароль для подтверждения', false);
            return;
        }
        // Поле повтора открыто — сверяем пароли
        const confirmPassword = confirmPasswordInput ? confirmPasswordInput.value.trim() : '';
        if (password !== confirmPassword) {
            setStatus('Пароли не совпадают', true);
            return;
        }
        sendRequest('register', login, password);
    }
    loginBtn.addEventListener('click', handleLogin);
    registerBtn.addEventListener('click', handleRegister);
    if (logoutBtn) {
        logoutBtn.addEventListener('click', handleLogout);
    }
    async function handleLogout() {
        const token = localStorage.getItem('token');
        try {
            if (token) {
                await fetch('http://localhost:3000/logout', {
                    method: 'POST',
                    headers: {
                        'Authorization': 'Bearer ' + token
                    }
                });
            }
        } catch (error) {
            console.error(error);
        }
        localStorage.removeItem('token');
        localStorage.removeItem('login');
        hideLoggedIn();
        setStatus('Выход выполнен', false);
    }
    async function checkAuthOnLoad() {
        const token = localStorage.getItem('token');
        if (!token) return;
        try {
            const response = await fetch('http://localhost:3000/me', {
                headers: {
                    'Authorization': 'Bearer ' + token
                }
            });
            const data = await response.json();
            if (data.success) {
                showLoggedIn(data.login);
            } else {
                localStorage.removeItem('token');
                localStorage.removeItem('login');
                hideLoggedIn();
            }
        } catch (error) {
            console.error(error);
        }
    }
    function onEnter(e) {
        if (e.key === 'Enter') {
            e.preventDefault();
            handleLogin();
        }
    }
    loginInput.addEventListener('keydown', onEnter);
    passwordInput.addEventListener('keydown', onEnter);
    if (confirmPasswordInput) {
        confirmPasswordInput.addEventListener('keydown', function(e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                handleRegister();
            }
        });
    }
    // Если пользователь меняет логин — сбрасываем поле повтора
    loginInput.addEventListener('input', function() {
        if (confirmPasswordField && confirmPasswordField.style.display !== 'none') {
            hideConfirmPasswordField();
        }
    });
    statusMsg.addEventListener('click', function() {
        if (statusTimeout) {
            clearTimeout(statusTimeout);
            statusTimeout = null;
        }
        statusMsg.textContent = '';
        statusMsg.style.color = '#2a7de1';
    });
    checkAuthOnLoad();
})();