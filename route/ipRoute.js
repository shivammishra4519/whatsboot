const express = require('express');
const { addIp,getToken,whiteListedIp,deleteIp} = require('../controler/ipwhitelist'); // Ensure the path and export are correct

const router = express.Router();

router.post('/add', addIp);
router.post('/get', getToken);
router.post('/get/all', whiteListedIp);
router.post('/delete', deleteIp);




module.exports = router;