import * as authService from '../services/authService.js';
import { validateRegistrationInput, validateLoginInput, normalizeRegistrationData } from '../utils/validation.js';
import { generateToken, setAuthCookie, clearAuthCookie } from '../utils/cookies.js';

/**
 * Controller: Register new account
 * POST /api/auth/register
 */
export async function register(req, res, next) {
  try {
    const { full_name, username, email, password, confirm_password } = req.body;

    const validation = validateRegistrationInput({
      full_name,
      username,
      email,
      password,
      confirm_password: confirm_password || password
    });

    if (!validation.isValid) {
      return res.status(400).json({
        success: false,
        message: validation.errors.join(' ')
      });
    }

    const normalized = normalizeRegistrationData({ full_name, username, email });

    const newUser = await authService.registerUser({
      full_name: normalized.full_name,
      username: normalized.username,
      email: normalized.email,
      password
    });

    // Create session token and cookie
    const token = generateToken(newUser);
    setAuthCookie(res, token);

    return res.status(201).json({
      success: true,
      message: 'Account created successfully.',
      user: newUser
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Controller: Authenticate existing user
 * POST /api/auth/login
 */
export async function login(req, res, next) {
  try {
    const { email, password } = req.body;

    const validation = validateLoginInput({ email, password });
    if (!validation.isValid) {
      return res.status(400).json({
        success: false,
        message: validation.errors.join(' ')
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    const user = await authService.loginUser({
      email: normalizedEmail,
      password
    });

    // Create session token and cookie
    const token = generateToken(user);
    setAuthCookie(res, token);

    return res.status(200).json({
      success: true,
      message: 'Login successful.',
      user
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Controller: Logout current session
 * POST /api/auth/logout
 */
export async function logout(req, res) {
  clearAuthCookie(res);
  return res.status(200).json({
    success: true,
    message: 'Logged out successfully.'
  });
}

/**
 * Controller: Get current authenticated user
 * GET /api/auth/me
 */
export async function me(req, res, next) {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        authenticated: false,
        message: 'Not authenticated.'
      });
    }

    const user = await authService.getUserById(req.user.user_id);
    if (!user) {
      clearAuthCookie(res);
      return res.status(401).json({
        success: false,
        authenticated: false,
        message: 'User account no longer exists.'
      });
    }

    return res.status(200).json({
      success: true,
      authenticated: true,
      user
    });
  } catch (error) {
    next(error);
  }
}
