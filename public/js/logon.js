const loginTab = document.getElementById('login-tab');
const createAccountTab = document.getElementById('create-account-tab');
const createAccountLink = document.getElementById('create-account-link');

const logonForm = document.getElementById('logon-form');
const createAccountForm = document.getElementById('create-account-form');
const messageEl = document.getElementById('message');

const PASSWORD_RULES = {
  pattern: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/,
  message: 'Password must be at least 8 characters and include an uppercase letter, a lowercase letter, and a number.'
};

function setMessage(text, type) {
  messageEl.textContent = text;
  messageEl.classList.remove('error', 'success');
  if (type) messageEl.classList.add(type);
}

function clearMessage() {
  setMessage('', null);
}

function isValidEmail(email) {
  return typeof email === 'string' && email.includes('@') && email.includes('.') && email.length <= 254;
}

function showLogin() {
  logonForm.classList.add('active-form');
  createAccountForm.classList.remove('active-form');
  loginTab.classList.add('active');
  createAccountTab.classList.remove('active');
  clearMessage();
  document.getElementById('login-email').focus();
}

function showCreateAccount() {
  createAccountForm.classList.add('active-form');
  logonForm.classList.remove('active-form');
  createAccountTab.classList.add('active');
  loginTab.classList.remove('active');
  clearMessage();
  document.getElementById('create-email').focus();
}

loginTab.addEventListener('click', showLogin);
createAccountTab.addEventListener('click', showCreateAccount);

createAccountLink.addEventListener('click', (e) => {
  e.preventDefault();
  showCreateAccount();
});

// Logon form submission
logonForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  clearMessage();

  const email = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;

  if (!email || !password) {
    setMessage('Please enter both email and password.', 'error');
    return;
  }

  if (!isValidEmail(email)) {
    setMessage('Please enter a valid email address.', 'error');
    return;
  }

  try {
    const response = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    const result = await response.json();

    if (response.ok) {
      localStorage.setItem('jwtToken', result.token);
      window.location.href = '/dashboard.html';
      return;
    }

    setMessage(result.message || 'Invalid email or password.', 'error');
  } catch (error) {
    console.error('Error:', error);
    setMessage('An error occurred. Please try again later.', 'error');
  }
});

// Create account form submission
createAccountForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  clearMessage();

  const email = document.getElementById('create-email').value.trim();
  const password = document.getElementById('create-password').value;
  const confirmPassword = document.getElementById('create-password-confirm').value;
  const termsChecked = document.getElementById('terms-checkbox').checked;

  if (!email || !password) {
    setMessage('Please enter both email and password.', 'error');
    return;
  }

  if (!isValidEmail(email)) {
    setMessage('Please enter a valid email address.', 'error');
    return;
  }

  if (!PASSWORD_RULES.pattern.test(password)) {
    setMessage(PASSWORD_RULES.message, 'error');
    return;
  }

  if (confirmPassword && confirmPassword !== password) {
    setMessage('Passwords do not match.', 'error');
    return;
  }

  if (!termsChecked) {
    setMessage('You must agree to the Terms and Privacy Policy to create an account.', 'error');
    return;
  }

  try {
    const response = await fetch('/api/create-account', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    const result = await response.json();

    if (response.ok) {
      setMessage('Account created successfully! You can now sign in.', 'success');

      document.getElementById('login-email').value = email;
      document.getElementById('login-password').value = '';
      showLogin();
      return;
    }

    setMessage(result.message || 'Error creating account.', 'error');
  } catch (error) {
    console.error('Error:', error);
    setMessage('An error occurred. Please try again later.', 'error');
  }
});