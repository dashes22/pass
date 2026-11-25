(function() {
    const loginInput = document.getElementById('loginInput');
    const passwordInput = document.getElementById('passwordInput');
    const confirmPasswordInput = document.getElementById('confirmPasswordInput');
    const confirmPasswordField = document.getElementById('confirmPasswordField');
    const registerBtn = document.getElementById('registerBtn');
    const loginBtn = document.getElementById('loginBtn');
    const statusMsg = document.getElementById('statusMessage');
    let statusTimeout = null;

    // --- БЛОК РАБОТЫ С ТОКЕНАМИ ---
    
    // Функция для обновления Access Token через Refresh Token (он в httpOnly cookie)
    async function refreshAccessToken() {
        try {
            const response = await fetch('http://localhost:3000/refresh', {
                method: 'POST',
                // Важно: credentials: 'include' нужен, чтобы браузер отправил httpOnly cookie
                credentials: 'include' 
            });
            const data = await response.json();
            if (data.success && data.accessToken) {
                localStorage.setItem('accessToken', data.accessToken);
                return data.accessToken;
            }
            return null;
        } catch (error) {
            console.error('Ошибка обновления токена:', error);
            return null;
        }
    }

    // Универсальная обертка для fetch, которая сама обновляет токен при 401
    async function fetchWithAuth(url, options = {}) {
        // 1. Подставляем текущий токен
        let accessToken = localStorage.getItem('accessToken');
        options.headers = {
            ...options.headers,
            'Authorization': `Bearer ${accessToken}`
        };
        options.credentials = 'include'; // Отправляем cookie

        let response = await fetch(url, options);

        // 2. Если токен истек (401), пробуем обновить
        if (response.status === 401) {
            console.log('Access token истек, пробуем обновить...');
            const newToken = await refreshAccessToken();
            
            if (newToken) {
                // Повторяем запрос с новым токеном
                options.headers['Authorization'] = `Bearer ${newToken}`;
                response = await fetch(url, options);
            } else {
                // Если обновить не удалось — разлогиниваем
                setStatus('Сессия истекла. Войдите снова.', true);
                localStorage.removeItem('accessToken');
                // window.location.reload(); // Можно перезагрузить страницу
            }
        }
        return response;
    }

    // --- ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ UI ---
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

    function showConfirmPasswordField() {
        if (confirmPasswordField) confirmPasswordField.style.display = 'block';
    }

    function hideConfirmPasswordField() {
        if (confirmPasswordField) confirmPasswordField.style.display = 'none';
        if (confirmPasswordInput) confirmPasswordInput.value = '';
    }

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

    // --- ОСНОВНАЯ ЛОГИКА ВХОДА/РЕГИСТРАЦИИ ---
    async function sendRequest(action, login, password) {
        try {
            const response = await fetch('http://localhost:3000/' + action, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include', // Важно для получения cookie
                body: JSON.stringify({ login: login, password: password })
            });
            const data = await response.json();
            
            if (data.success) {
                setStatus(data.message, false);
                loginInput.value = '';
                passwordInput.value = '';
                
                if (action === 'register') {
                    hideConfirmPasswordField();
                } else if (action === 'login') {
                    // СОХРАНЯЕМ ACCESS TOKEN
                    localStorage.setItem('accessToken', data.accessToken);
                    console.log('Вход выполнен, токен сохранен.');
                    
                    // Здесь можно перенаправить на защищенную страницу или показать профиль
                    // Например: loadProfile();
                }
            } else {
                setStatus(data.message, true);
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
        if (confirmPasswordField && confirmPasswordField.style.display === 'none') {
            const available = await checkLoginAvailable(login);
            if (!available) {
                setStatus('Пользователь с таким логином уже существует', true);
                return;
            }
            showConfirmPasswordField();
            setStatus('Логин свободен. Повторите пароль для подтверждения', false);
            return;
        }
        const confirmPassword = confirmPasswordInput ? confirmPasswordInput.value.trim() : '';
        if (password !== confirmPassword) {
            setStatus('Пароли не совпадают', true);
            return;
        }
        sendRequest('register', login, password);
    }

    // --- ОБРАБОТЧИКИ СОБЫТИЙ ---
    loginBtn.addEventListener('click', handleLogin);
    registerBtn.addEventListener('click', handleRegister);

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

    // --- ПРИМЕР ИСПОЛЬЗОВАНИЯ ЗАЩИЩЕННОГО ЗАПРОСА ---
    // Эту функцию можно вызвать, например, при загрузке страницы, если пользователь уже вошел
    /*
    async function loadProfile() {
        const response = await fetchWithAuth('http://localhost:3000/profile');
        if (response.ok) {
            const data = await response.json();
            console.log('Профиль:', data);
            // setStatus(`Привет, ${data.login}!`, false);
        }
    }
    */
    
    // --- ВЫХОД (если добавите кнопку) ---
    /*
    document.getElementById('logoutBtn')?.addEventListener('click', async () => {
        await fetch('http://localhost:3000/logout', { method: 'POST', credentials: 'include' });
        localStorage.removeItem('accessToken');
        setStatus('Вы вышли из системы', false);
        // window.location.reload();
    });
    */

})();