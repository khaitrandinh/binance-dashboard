const express = require("express");
const cors = require("cors");
const connectDB = require("./database");
require("dotenv").config();

const app = express();
app.use(cors());
app.use(express.json());

// Kết nối MongoDB
connectDB();

// Test API
app.get("/", (req, res) => {
  res.send("🚀 Binance Dashboard API is running...");
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));

const marketRoutes = require("./routes/market");
app.use("/api/market", marketRoutes);

const { startBinanceWebSocket } = require("./websocket/binanceSocket");
startBinanceWebSocket("BTCUSDT");

// Tạo WebSocket Server cho frontend
const WebSocket = require("ws");

const wss = new WebSocket.Server({ port: 5001 });

wss.on("connection", (ws) => {
  console.log("✅ Client WebSocket đã kết nối!");

  // Gửi dữ liệu test ngay khi client kết nối
  ws.send(JSON.stringify({ message: "WebSocket Server sẵn sàng!", price: Math.random() * 100 }));

  ws.on("message", (message) => {
    console.log("📩 Nhận tin nhắn từ client:", message);
  });

  ws.on("close", () => {
    console.log("❌ Client WebSocket bị đóng!");
  });

  ws.onerror = (error) => {
    console.error("❌ Lỗi WebSocket Server:", error);
  };

  // Gửi dữ liệu real-time mỗi 2 giây
  setInterval(() => {
    ws.send(JSON.stringify({ price: Math.random() * 100, time: new Date().toLocaleTimeString() }));
  }, 2000);
});



