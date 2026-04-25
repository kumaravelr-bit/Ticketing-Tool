const express = require("express");

const ctrl = require("../controllers/hrd.controller");
const uploadSpreadsheet = require("../middleware/uploadSpreadsheet");

const router = express.Router();

router.get("/bulk-upload/template", ctrl.downloadOfferLetterBulkTemplate);
router.post("/bulk-upload", uploadSpreadsheet.single("file"), ctrl.bulkUploadOfferLetters);
router.post("/generate", ctrl.generateOfferLetter);
router.get("/list", ctrl.getOfferLetters);
router.get("/download/:id", ctrl.downloadOfferLetter);
router.post("/send-mail", ctrl.sendOfferLetterMail);
router.get("/:id", ctrl.getOfferLetterById);
router.put("/:id", ctrl.updateOfferLetter);
router.get("/preview/:id", ctrl.previewOfferLetter);

module.exports = router;
