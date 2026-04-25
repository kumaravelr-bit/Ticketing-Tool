const app = require("./app");
const initializeDatabases = require("./config/bootstrapDatabase");
const initSuperAdmin = require("./utils/initSuperAdmin");

const PORT = Number(process.env.PORT || 8090);

async function startServer() {
  try {
    await initializeDatabases();
    await initSuperAdmin();

    app.listen(PORT, () => {
      console.log(`Server running on ${PORT}`);
    });
  } catch (error) {
    console.error("Server startup failed:", error.message);
    process.exit(1);
  }
}

startServer();
