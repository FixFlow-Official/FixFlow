const app = require("./src/app");
const connectDB = require("./src/config/database");

// Start accepting requests immediately; MongoDB connection and directory sync
// continue in the background so a slow database handshake does not cause Vite
// to report ECONNREFUSED / 502 while the API server is still booting.
app.listen(3000, "127.0.0.1", () => {
  console.log("Server is running on port 3000");
});

connectDB();
