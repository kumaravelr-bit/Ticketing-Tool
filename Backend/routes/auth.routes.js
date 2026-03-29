const express = require("express");
const router = express.Router();
const controller = require("../controllers/auth.controller");

router.post("/login", controller.login);
router.post("/forgot-password", controller.sendResetOTP);
router.post("/verify-otp", controller.verifyOTP);
router.post("/reset-password", controller.resetPassword);

module.exports = router;
