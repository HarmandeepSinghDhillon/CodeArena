let selectedRole = 'user';

document.querySelectorAll('.role-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.role-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        selectedRole = btn.dataset.role;
    });
});

document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    const messageDiv = document.getElementById('message');
    
    messageDiv.className = 'message';
    messageDiv.style.display = 'none';
    
    try {
        const response = await fetch('/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'same-origin', 
            body: JSON.stringify({ username, password, role: selectedRole })
        });
        
        const data = await response.json();
        
        if (response.ok && data.success) {
            messageDiv.className = 'message success';
            messageDiv.textContent = data.message;
            messageDiv.style.display = 'block';
            
            setTimeout(() => {
                if (data.role === 'admin') {
                    window.location.href = '/admin';
                } else {
                    window.location.href = '/dashboard';
                }
            }, 1000);
        } else {
            messageDiv.className = 'message error';
            messageDiv.textContent = data.message || 'Login failed';
            messageDiv.style.display = 'block';
        }
    } catch (error) {
        messageDiv.className = 'message error';
        messageDiv.textContent = 'Connection error. Make sure the server is running.';
        messageDiv.style.display = 'block';
    }
});