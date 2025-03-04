const express = require("express");
const cors = require("cors");
const connectDB = require("./database");
require("dotenv").config();

// Import routes
const priceRoutes = require("./routes/priceRoutes");
const candlestickRoutes = require("./routes/candlestickRoutes");
const tradeRoutes = require("./routes/tradeRoutes");
const marketRoutes = require("./routes/market");
const heatmapRoutes = require("./routes/heatmapRoutes");

// Import WebSocket Server
const { initWebSocketServer } = require("./websocketServer");

const app = express();

// 🔹 Cấu hình CORS (Chỉ cho phép FE kết nối)
const allowedOrigins = ["http://localhost:3000"];
app.use(cors({
  origin: allowedOrigins,
  methods: ["GET", "POST"],
  credentials: true,
}));

app.use(express.json());

// 🔹 Kết nối MongoDB
(async () => {
  try {
    await connectDB();
    console.log("✅ MongoDB connected successfully!");
  } catch (error) {
    console.error("❌ Lỗi kết nối MongoDB:", error);
    process.exit(1); // Dừng server nếu không kết nối được DB
  }
})();

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
const server = app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});

// Khởi động WebSocket Server
initWebSocketServer(server);

// 🔹 Xử lý lỗi không tìm thấy route
app.use((req, res) => {
  res.status(404).json({ error: "API route not found" });
});

// 🔹 Xử lý lỗi toàn cục
app.use((err, req, res, next) => {
  console.error("❌ Lỗi server:", err);
  res.status(500).json({ error: "Internal Server Error" });
});

module.exports = server;
