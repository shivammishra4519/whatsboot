const express = require('express');
const { loginWhatsapp,sendMessage,isLoggedIn,sendQuickMessage,sendQuickMessageMulti } = require('../controler/whatsapp'); // Ensure the path and export are correct

const router = express.Router();

router.post('/whatsapp', loginWhatsapp);
router.post('/sendmsg', sendMessage);
router.post('/sendmsg/quick', sendQuickMessage);
router.post('/sendmsg/multi', sendQuickMessageMulti);
router.post('/check/status',isLoggedIn );

module.exports = router;
