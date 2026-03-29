const express = require("express");
const router = express.Router();

const ctrl = require("../controllers/hrd.controller");

// ✅ CLEAN API STRUCTURE

router.post("/generate", ctrl.generateOfferLetter);
router.get("/list", ctrl.getOfferLetters);
router.get("/download/:id", ctrl.downloadOfferLetter);
router.post("/send-mail", ctrl.sendOfferLetterMail);

router.get("/:id", ctrl.getOfferLetterById);
router.put("/:id", ctrl.updateOfferLetter);
router.get("/preview/:id", ctrl.previewOfferLetter);

module.exports = router;