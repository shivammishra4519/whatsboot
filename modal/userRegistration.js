const joi=require('joi');


const userRegistraion=joi.object({
    firstName:joi.string().required(),
    lastName:joi.string().required(),
    email:joi.string().required(),
    password:joi.string().required(),
    confirmPassword:joi.string().required(),
    number:joi.string().required(),
})


module.exports={userRegistraion}