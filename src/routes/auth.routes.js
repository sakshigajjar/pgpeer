const express = require('express');
const authController = require('../controllers/auth.controller');

const router = express.Router();

// POST /api/auth/register → create account, set access + refresh cookies
router.post('/register', authController.register);

// POST /api/auth/login    → verify credentials, set access + refresh cookies
router.post('/login',    authController.login);

// POST /api/auth/refresh  → rotate refresh token, issue new access + refresh
router.post('/refresh',  authController.refresh);

// POST /api/auth/logout   → delete refresh row, clear both cookies
router.post('/logout',   authController.logout);

module.exports = router;
