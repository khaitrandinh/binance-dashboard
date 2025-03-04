const WebSocket = require("ws");
const { startBinanceStream } = require("./services/candlestickService");

let wss;
const clients = new Set();

function initWebSocketServer(httpServer) {
  wss = new WebSocket.Server({ server: httpServer, path: "/ws" });

  console.log("✅ WebSocket Server đã chạy!");

  wss.on("connection", (ws, req) => {
    console.log(`✅ Client WebSocket đã kết nối từ: ${req.socket.remoteAddress}`);
    
    // Add client to the set - THIS WAS MISSING
    clients.add(ws);
    
    // Handle ping messages from client
    ws.on("message", (message) => {
      try {
        const data = JSON.parse(message);
        if (data.type === "ping") {
          ws.send(JSON.stringify({type: "pong"}));
        }
      } catch (error) {
        console.error("❌ Error parsing client message:", error);
      }
    });
  
    ws.on("close", (code, reason) => {
      console.warn(`⚠️ Client WebSocket đóng (code: ${code}, reason: ${reason})`);
      // Remove client from the set - THIS WAS MISSING
      clients.delete(ws);
    });
  
    ws.on("error", (error) => {
      console.error("❌ Lỗi WebSocket Server:", error);
    });
  });

  startBinanceStream(broadcastCandleData);
}

function broadcastCandleData(timeframe, candleData) {
  console.log(`Broadcasting candle data to ${clients.size} clients`);
  
  clients.forEach((ws) => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: "candle", timeframe, data: candleData }));
    }
  });
}

module.exports = { initWebSocketServer };