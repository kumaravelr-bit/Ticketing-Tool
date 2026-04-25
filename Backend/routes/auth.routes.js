const express = require("express");
const router = express.Router();
const controller = require("../controllers/auth.controller");
const verifyToken = require("../middleware/auth");

router.post("/login", controller.login);
router.post("/forgot-password", controller.sendResetOTP);
router.post("/verify-otp", controller.verifyOTP);
router.post("/reset-password", controller.resetPassword);
router.post("/verify-current-password", verifyToken, controller.verifyCurrentPassword);
router.post("/change-password", verifyToken, controller.changePassword);

module.exports = router;
