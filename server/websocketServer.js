const WebSocket = require("ws");
const { startBinanceStream, stopBinanceStream } = require("./services/candlestickService");

let wss;
const activeSubscriptions = new Map(); // Theo dõi client đăng ký timeframe

function initWebSocketServer(httpServer = null) {
  if (httpServer) {
    // Sử dụng cùng server HTTP nhưng thêm path cụ thể
    wss = new WebSocket.Server({ 
      server: httpServer,
      path: '/ws' // Thêm path cụ thể - phải khớp với client
    });
    console.log("✅ WebSocket Server chạy trên cùng port với HTTP Server (path: /ws)");
  } else {
    const WS_PORT = process.env.WS_PORT || 5000;
    wss = new WebSocket.Server({ 
      port: WS_PORT,
      path: '/ws' // Thêm path cụ thể - phải khớp với client
    });
    console.log(`✅ WebSocket Server khởi động trên port ${WS_PORT} (path: /ws)`);
  }

  // Xử lý lỗi ở cấp độ server
  wss.on("error", (error) => {
    console.error("❌ Lỗi WebSocket Server:", error);
  });

  wss.on("connection", handleConnection);

  // Bắt đầu lấy dữ liệu từ Binance
  startBinanceStream(broadcastCandleData);

  console.log("✅ WebSocket Server đã sẵn sàng nhận kết nối");
  return wss;
}

function handleConnection(ws, req) {
  const clientIp = req.socket.remoteAddress || "unknown";
  console.log(`✅ Client WebSocket đã kết nối từ ${clientIp}!`);

  // Thiết lập trình xử lý lỗi ngay lập tức
  ws.on("error", (error) => {
    console.error(`❌ Lỗi client WebSocket (${clientIp}):`, error);
  });

  // Gửi tin nhắn chào mừng ngay khi kết nối
  try {
    ws.send(JSON.stringify({ 
      type: "welcome",
      message: "WebSocket Server sẵn sàng!",
      timestamp: Date.now()
    }));
  } catch (err) {
    console.error("❌ Lỗi gửi tin nhắn chào mừng:", err);
  }

  ws.on("message", (message) => {
    try {
      const parsedMessage = JSON.parse(message);
      console.log(`📩 Nhận tin nhắn từ client (${clientIp}):`, parsedMessage);
      
      // Xử lý ping từ client
      if (parsedMessage.action === "ping") {
        ws.send(JSON.stringify({ 
          type: "pong", 
          timestamp: Date.now() 
        }));
        return;
      }
  
      if (parsedMessage.action === "subscribe" && parsedMessage.timeframe) {
        const timeframe = parsedMessage.timeframe;
        activeSubscriptions.set(ws, timeframe);
        console.log(`✅ Client (${clientIp}) đăng ký kênh ${timeframe}`);
  
        // Gửi xác nhận đăng ký
        ws.send(JSON.stringify({ 
          type: "subscription_success", 
          timeframe: timeframe,
          timestamp: Date.now()
        }));
  
        // Gửi dữ liệu lịch sử
        sendHistoricalData(ws, timeframe);
      }
    } catch (error) {
      console.error(`❌ Lỗi xử lý tin nhắn client (${clientIp}):`, error);
      try {
        ws.send(JSON.stringify({ 
          type: "error", 
          message: "Dữ liệu gửi sai định dạng",
          timestamp: Date.now()
        }));
      } catch (err) {
        console.error("❌ Không thể gửi thông báo lỗi:", err);
      }
    }
  });
  
  ws.on("close", (code, reason) => {
    console.warn(`⚠️ Client WebSocket (${clientIp}) bị đóng! Code: ${code}, Reason: ${reason || "Không có lý do"}`);
    activeSubscriptions.delete(ws);
  });
}

// 🔹 Giới hạn gửi dữ liệu mỗi giây 1 lần
let lastSentTime = 0;
const MIN_INTERVAL = 1000; // 1 giây

function broadcastCandleData(timeframe, candleData) {
  if (!wss || !wss.clients) {
    console.warn("⚠️ WebSocket Server không tồn tại hoặc không có clients");
    return;
  }

  const now = Date.now();
  if (now - lastSentTime < MIN_INTERVAL) return; // Nếu chưa đủ 1 giây, bỏ qua

  lastSentTime = now;
  
  let clientCount = 0;
  let errorCount = 0;

  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN && activeSubscriptions.get(client) === timeframe) {
      try {
        client.send(JSON.stringify({
          type: "candle",
          timeframe: timeframe,
          data: candleData,
          timestamp: now
        }));
        clientCount++;
      } catch (error) {
        console.error("❌ Lỗi gửi dữ liệu:", error);
        errorCount++;
      }
    }
  });

  if (clientCount > 0) {
    console.log(`📊 Đã gửi dữ liệu ${timeframe} đến ${clientCount} clients` + 
                (errorCount > 0 ? ` (${errorCount} lỗi)` : ""));
  }
}

// 🔹 Gửi dữ liệu lịch sử khi client đăng ký
async function sendHistoricalData(ws, timeframe) {
  try {
    const Candlestick = require("./models/CandlestickModel");

    console.log(`🔍 Đang tải dữ liệu lịch sử cho timeframe ${timeframe}`);
    const historicalCandles = await Candlestick.find({ timeframe })
      .sort({ timestamp: -1 })
      .limit(100)
      .lean();

    if (ws.readyState === WebSocket.OPEN) {
      console.log(`📤 Gửi ${historicalCandles.length} nến lịch sử cho timeframe ${timeframe}`);
      ws.send(JSON.stringify({
        type: "historical",
        timeframe: timeframe,
        data: historicalCandles.reverse(), // Gửi từ cũ đến mới
        timestamp: Date.now()
      }));
    } else {
      console.warn("⚠️ WebSocket không còn mở khi cố gắng gửi dữ liệu lịch sử");
    }
  } catch (error) {
    console.error("❌ Lỗi khi gửi dữ liệu lịch sử:", error);
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        type: "error",
        message: "Không thể tải dữ liệu lịch sử",
        timestamp: Date.now()
      }));
    }
  }
}

// 🔹 Kiểm tra kết nối sống định kỳ
function setupPingInterval() {
  const PING_INTERVAL = 55000; // 55 giây

  setInterval(() => {
    if (!wss) return;
    
    let deadClients = 0;
    wss.clients.forEach(client => {
      if (client.readyState !== WebSocket.OPEN) {
        activeSubscriptions.delete(client);
        deadClients++;
      }
    });
    
    if (deadClients > 0) {
      console.log(`🧹 Đã xóa ${deadClients} kết nối không còn hoạt động`);
    }
    
    console.log(`ℹ️ Trạng thái server: ${wss.clients.size} clients kết nối`);
  }, PING_INTERVAL);
}

// 🔹 Tắt WebSocket Server khi cần
function closeWebSocketServer() {
  if (wss) {
    console.log("🔴 Đang đóng WebSocket Server...");
    
    // Thông báo cho tất cả clients
    wss.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        try {
          client.send(JSON.stringify({
            type: "server_shutdown",
            message: "Server đang đóng, vui lòng kết nối lại sau",
            timestamp: Date.now()
          }));
          client.close(1000, "Server shutdown");
        } catch (err) {
          console.error("❌ Lỗi khi đóng client:", err);
        }
      }
    });
    
    wss.close(() => {
      console.log("🔴 WebSocket Server đã đóng");
      stopBinanceStream();
    });
  }
}

// Thêm hàm khởi tạo đầy đủ
function initialize(httpServer = null) {
  initWebSocketServer(httpServer);
  setupPingInterval();
  console.log("🚀 WebSocket Server đã khởi tạo đầy đủ");
}

module.exports = {
  initWebSocketServer,
  initialize,
  closeWebSocketServer,
  broadcastCandleData
};