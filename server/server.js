const express = require("express");
const cors = require("cors");
const connectDB = require("./database");
require("dotenv").config();
const priceRoutes = require("./routes/priceRoutes");
const candlestickRoutes = require("./routes/candlestickRoutes");
const tradeRoutes = require("./routes/tradeRoutes");
const marketRoutes = require("./routes/market");
const heatmapRoutes = require("./routes/heatmapRoutes");

// Khởi tạo websocket server
const { initWebSocketServer } = require("./websocketServer");

// 🔹 Khởi tạo Express Server
const app = express();
app.use(cors());
app.use(express.json());

// 🔹 Kết nối MongoDB
connectDB();

// 🔹 Test API
app.get("/", (req, res) => {
  res.send("🚀 Binance Dashboard API is running...");
});

// 🔹 Định nghĩa API Routes
app.use("/api/market", marketRoutes);
app.use("/api/price", priceRoutes);
app.use("/api/candles", candlestickRoutes);
app.use("/api/trades", tradeRoutes);
app.use("/api/heatmap", heatmapRoutes);

// 🔹 Khởi động server Express
const PORT = process.env.PORT || 5000;
const server = app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));

// Khởi động WebSocket Server
initWebSocketServer(server); // Có thể truyền HTTP server nếu muốn dùng cùng port

module.exports = server;