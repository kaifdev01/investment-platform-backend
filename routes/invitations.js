const express = require('express');
const { createInvitation } = require('../controllers/invitationController');
const auth = require('../middleware/auth');

const router = express.Router();

router.post('/', auth, createInvitation)

module.exports = router;