const app = require("./app");
const initSuperAdmin = require("./utils/initSuperAdmin");

const PORT = 8090;

app.listen(PORT, () => {
  console.log(`Server running on ${PORT}`);
  initSuperAdmin();
});
