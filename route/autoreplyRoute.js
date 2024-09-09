const express = require('express');
const { addAnswer} = require('../controler/autoreply'); // Ensure the path and export are correct

const router = express.Router();

router.post('/answer', addAnswer);





module.exports = router;