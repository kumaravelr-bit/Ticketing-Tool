const router = require("express").Router();
const auth = require("../middleware/auth");
const ticket = require("../controllers/ticket.controller");
const uploadTicketSnapshot = require("../middleware/uploadTicketSnapshot");

/* ================== TICKET TYPES ================== */

// GET ALL TYPES
router.get("/types", auth, ticket.getTicketTypes);

// CREATE TYPE
router.post("/types", auth, ticket.createTicketType);

// UPDATE TYPE
router.put("/types/:id", auth, ticket.updateTicketType);

// DELETE TYPE
router.delete("/types/:id", auth, ticket.deleteTicketType);


/* ================== SUBTYPES ================== */

// GET BY TYPE
router.get("/subtypes/:typeId", auth, ticket.getSubtypesByType);

// CREATE SUBTYPE
router.post("/subtypes", auth, ticket.createSubtype);

// UPDATE SUBTYPE
router.put("/subtypes/:id", auth, ticket.updateSubtype);

// DELETE SUBTYPE
router.delete("/subtypes/:id", auth, ticket.deleteSubtype);


/* ================== EXISTING ================== */

router.post("/", auth, uploadTicketSnapshot.single("issue_snapshot"), ticket.createTicket);
router.post("/opened/search", auth, ticket.searchOpenedTickets);
router.post("/opened/export", auth, ticket.exportOpenedTickets);
router.get("/employees/by-branch-team", auth, ticket.getEmployeesByBranchTeam);
router.post("/:ticketId/move", auth, ticket.moveTicket);

router.post("/:ticketId/resolve", auth, ticket.resolveTicket);
router.post("/:ticketId/update", auth, ticket.updateTicket);
router.post("/:ticketId/verify", auth, ticket.verifyTicket);
router.get("/:ticketId/history", auth, ticket.getTicketHistory);
router.get("/attachments/:attachmentId/download", auth, ticket.downloadTicketAttachment);
router.post("/close/:ticketId", auth, ticket.closeTicket);
router.post("/closed/search", auth, ticket.searchClosedTickets);
router.post("/closed/export", auth, ticket.exportClosedTickets);

module.exports = router;
