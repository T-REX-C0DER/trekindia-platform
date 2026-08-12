/**
 * Helper to validate registration payload
 */
export function validateRegistrationInput({ full_name, username, email, password, confirm_password }) {
  const errors = [];

  if (!full_name || typeof full_name !== 'string' || !full_name.trim()) {
    errors.push('Full name is required.');
  }

  if (!username || typeof username !== 'string' || !username.trim()) {
    errors.push('Username is required.');
  } else {
    const trimmedUsername = username.trim();
    if (trimmedUsername.length < 3 || trimmedUsername.length > 50) {
      errors.push('Username must be between 3 and 50 characters.');
    }
    if (!/^[a-zA-Z0-9_.-]+$/.test(trimmedUsername)) {
      errors.push('Username can only contain letters, numbers, underscores, dots, and hyphens.');
    }
  }

  if (!email || typeof email !== 'string' || !email.trim()) {
    errors.push('Email address is required.');
  } else {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      errors.push('Please enter a valid email address.');
    }
  }

  if (!password || typeof password !== 'string') {
    errors.push('Password is required.');
  } else {
    if (password.length < 8) {
      errors.push('Password must be at least 8 characters long.');
    }
    if (!/[A-Z]/.test(password)) {
      errors.push('Password must contain at least one uppercase letter.');
    }
    if (!/[a-z]/.test(password)) {
      errors.push('Password must contain at least one lowercase letter.');
    }
    if (!/[0-9]/.test(password)) {
      errors.push('Password must contain at least one number.');
    }
    if (!/[^A-Za-z0-9]/.test(password)) {
      errors.push('Password must contain at least one special character.');
    }
  }

  if (confirm_password !== undefined && password !== confirm_password) {
    errors.push('Password confirmation does not match.');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Helper to validate login payload
 */
export function validateLoginInput({ email, password }) {
  const errors = [];

  if (!email || typeof email !== 'string' || !email.trim()) {
    errors.push('Email is required.');
  }

  if (!password || typeof password !== 'string') {
    errors.push('Password is required.');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Normalization helper
 */
export function normalizeRegistrationData({ full_name, username, email }) {
  return {
    full_name: full_name ? full_name.trim() : '',
    username: username ? username.trim().toLowerCase() : '',
    email: email ? email.trim().toLowerCase() : ''
  };
}
