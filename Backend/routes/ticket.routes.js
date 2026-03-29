const router = require("express").Router();
const auth = require("../middleware/auth");
const ticket = require("../controllers/ticket.controller");

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

router.post("/", auth, ticket.createTicket);
router.post("/opened/search", auth, ticket.searchOpenedTickets);
router.get("/employees/by-branch-team", auth, ticket.getEmployeesByBranchTeam);
router.post("/:ticketId/move", auth, ticket.moveTicket);

router.post("/:ticketId/update", auth, ticket.updateTicket);
router.get("/:ticketId/history", auth, ticket.getTicketHistory);
router.post("/close/:ticketId", auth, ticket.closeTicket);
router.post("/closed/search", auth, ticket.searchClosedTickets);

module.exports = router;