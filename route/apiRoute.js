const express = require('express');
const { sendSingleMessage} = require('../controler/apimessging'); // Ensure the path and export are correct

const router = express.Router();

router.post('/single/message', sendSingleMessage);






module.exports = router;