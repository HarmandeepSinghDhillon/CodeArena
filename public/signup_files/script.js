document.getElementById('signupForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const username = document.getElementById('username').value;
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const confirmPassword = document.getElementById('confirmPassword').value;
    const messageDiv = document.getElementById('message');
    
    messageDiv.className = 'message';
    messageDiv.style.display = 'none';
    
    if (username.length < 3) {
        messageDiv.className = 'message error';
        messageDiv.textContent = 'Username must be at least 3 characters';
        messageDiv.style.display = 'block';
        return;
    }
    
    if (password.length < 6) {
        messageDiv.className = 'message error';
        messageDiv.textContent = 'Password must be at least 6 characters';
        messageDiv.style.display = 'block';
        return;
    }
    
    if (password !== confirmPassword) {
        messageDiv.className = 'message error';
        messageDiv.textContent = 'Passwords do not match';
        messageDiv.style.display = 'block';
        return;
    }
    
    try {
        const response = await fetch('/api/signup', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'same-origin', 
            body: JSON.stringify({ username, email, password })
        });
        
        const data = await response.json();
        
        if (response.ok && data.success) {
            messageDiv.className = 'message success';
            messageDiv.textContent = data.message;
            messageDiv.style.display = 'block';
            
            setTimeout(() => {
                window.location.href = '/';
            }, 1500);
        } else {
            messageDiv.className = 'message error';
            messageDiv.textContent = data.message || 'Signup failed';
            messageDiv.style.display = 'block';
        }
    } catch (error) {
        messageDiv.className = 'message error';
        messageDiv.textContent = 'Connection error. Make sure the server is running.';
        messageDiv.style.display = 'block';
    }
});