const express = require('express');
const { addIp,getToken} = require('../controler/ipwhitelist'); // Ensure the path and export are correct

const router = express.Router();

router.post('/add', addIp);
router.post('/get', getToken);




module.exports = router;