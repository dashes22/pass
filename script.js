(function() {
    const loginInput = document.getElementById('loginInput');
    const passwordInput = document.getElementById('passwordInput');
    const registerBtn = document.getElementById('registerBtn');
    const loginBtn = document.getElementById('loginBtn');
    const statusMsg = document.getElementById('statusMessage');
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
        sendRequest('login', login, password);
    }
    function handleRegister() {
        const login = loginInput.value.trim();
        const password = passwordInput.value.trim();
        if (!login || !password) {
            setStatus('Заполните оба поля', true);
            return;
        }
        sendRequest('register', login, password);
    }
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
    statusMsg.addEventListener('click', function() {
        if (statusTimeout) {
            clearTimeout(statusTimeout);
            statusTimeout = null;
        }
        statusMsg.textContent = '';
        statusMsg.style.color = '#2a7de1';
    });
})();