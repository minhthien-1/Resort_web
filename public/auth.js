const API_BASE = window.location.origin + '/auth';

async function postData(url, data) {
  const res = await fetch(url, {
    method: 'POST',
    headers: {'Content-Type':'application/json'},
    body: JSON.stringify(data)
  });
  return res;
}

document.addEventListener('DOMContentLoaded', () => {
  const loginForm = document.querySelector('#loginForm');
  const registerForm = document.querySelector('#registerForm');
  const errorDiv = document.querySelector('#error');

  if (loginForm) {
    loginForm.addEventListener('submit', async e => {
      e.preventDefault();
      errorDiv.style.display = 'none';
      const formData = Object.fromEntries(new FormData(loginForm));
      const res = await postData(`${API_BASE}/login`, formData);
      const body = await res.json();
      if (!res.ok) {
        errorDiv.textContent = body.error || 'Login failed';
        errorDiv.style.display = 'block';
      } else {
        localStorage.setItem('token', body.token);
        window.location.href = '/';
      }
    });
  }

  if (registerForm) {
    registerForm.addEventListener('submit', async e => {
      e.preventDefault();
      errorDiv.style.display = 'none';
      const formData = Object.fromEntries(new FormData(registerForm));
      const res = await postData(`${API_BASE}/register`, formData);
      const body = await res.json();
      if (!res.ok) {
        errorDiv.textContent = body.error || 'Register failed';
        errorDiv.style.display = 'block';
      } else {
        alert('Đăng ký thành công! Vui lòng login.');
        window.location.href = 'login.html';
      }
    });
  }
});
