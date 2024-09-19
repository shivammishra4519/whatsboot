const express = require('express');
const { userRegistration,login ,adminregister,checkRole,logout,getAllUser,getSessionsDetails} = require('../controler/users'); // Ensure the path and export are correct

const router = express.Router();

router.post('/registration', userRegistration);
router.post('/login', login);
router.post('/admin/register', adminregister);
router.get('/check/role',checkRole );
router.post('/logout',logout );
router.post('/get',getAllUser );
router.post('/get/sessions',getSessionsDetails );

module.exports = router;
