const express = require('express');
const { createInvitation } = require('../controllers/invitationController');

const router = express.Router();

router.post('/create-invitation', createInvitation);

module.exports = router;