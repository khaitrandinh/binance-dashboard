const WebSocket = require("ws");
const Candlestick = require("../models/CandlestickModel");

let binanceWS = null;
let broadcastCallback = null;
let reconnectTimeout = null;
const currentCandles = new Map();

// Khởi động kết nối với Binance WebSocket
function startBinanceStream(callback) {
  broadcastCallback = callback;
  connectBinanceWS();
}

// Kết nối với Binance WebSocket
function connectBinanceWS() {
  if (binanceWS) {
    try {
      binanceWS.terminate();
    } catch (err) {
      console.error("❌ Lỗi khi đóng kết nối Binance WebSocket cũ:", err);
    }
  }

  binanceWS = new WebSocket("wss://stream.binance.com:9443/ws/btcusdt@trade");

  binanceWS.on("open", () => {
    console.log("✅ Kết nối WebSocket Binance thành công!");
    clearTimeout(reconnectTimeout);
  });

  binanceWS.on("error", (error) => {
    console.error("❌ Lỗi WebSocket Binance:", error);
  });

  binanceWS.on("close", () => {
    console.log("⚠️ WebSocket Binance bị đóng. Đang thử kết nối lại sau 5 giây...");
    reconnectTimeout = setTimeout(connectBinanceWS, 5000);
  });

  binanceWS.on("message", handleBinanceMessage);
}

// Xử lý dữ liệu từ Binance
async function handleBinanceMessage(data) {
  const trade = JSON.parse(data);
  const currentPrice = parseFloat(trade.p);
  const volume = parseFloat(trade.q);
  const timestamp = trade.T;

  try {
    // Xử lý và cập nhật nến cho các timeframe khác nhau
    await updateCandlestick("1m", timestamp, currentPrice, volume);
    await updateCandlestick("15m", timestamp, currentPrice, volume);
    await updateCandlestick("1h", timestamp, currentPrice, volume);
    await updateCandlestick("1d", timestamp, currentPrice, volume);
  } catch (error) {
    console.error("❌ Lỗi khi xử lý dữ liệu trade:", error);
  }
}

// Cập nhật nến theo timeframe
async function updateCandlestick(timeframe, timestamp, price, volume) {
    // Make sure Candlestick is properly defined
    if (!Candlestick || typeof Candlestick.findOne !== 'function') {
      console.error("❌ Candlestick model is not properly defined or imported");
      return;
    }
  
    const intervalMs = timeframeToMs(timeframe);
    const candleTimestamp = Math.floor(timestamp / intervalMs) * intervalMs;
    const candleDate = new Date(candleTimestamp);
    
    // Tạo key duy nhất cho nến
    const candleKey = `${timeframe}-${candleTimestamp}`;
    
    // Kiểm tra nếu nến đã có trong bộ nhớ
    let candle = currentCandles.get(candleKey);
    
    try {
      if (!candle) {
        // Dùng updateOne thay vì findOneAndUpdate để giảm xung đột
        await Candlestick.updateOne(
          { timestamp: candleDate, timeframe: timeframe },
          {
            $setOnInsert: { open: price },
            $max: { high: price },
            $min: { low: price },
            $set: { close: price },
            $inc: { volume: volume }
          },
          { upsert: true }
        );
        
        // Sau khi cập nhật, lấy dữ liệu mới nhất
        candle = await Candlestick.findOne({ 
          timestamp: candleDate, 
          timeframe: timeframe 
        }).lean();
        
        if (candle) {
          currentCandles.set(candleKey, {
            time: candle.timestamp.getTime() / 1000,
            open: candle.open,
            high: candle.high,
            low: candle.low,
            close: candle.close,
            volume: candle.volume || 0
          });
        }
      } else {
        // Nếu nến đã có trong bộ nhớ, chỉ cập nhật các giá trị
        await Candlestick.updateOne(
          { timestamp: candleDate, timeframe: timeframe },
          {
            $max: { high: price },
            $min: { low: price },
            $set: { close: price },
            $inc: { volume: volume }
          }
        );
        
        // Cập nhật bộ nhớ cache
        candle.high = Math.max(candle.high, price);
        candle.low = Math.min(candle.low, price);
        candle.close = price;
        candle.volume += volume;
        
        currentCandles.set(candleKey, candle);
      }
      
      // Gửi cập nhật đến các client nếu có callback
      if (broadcastCallback && candle) {
        broadcastCallback(timeframe, {
          time: candle.time || Math.floor(candleDate.getTime() / 1000),
          open: candle.open,
          high: candle.high,
          low: candle.low,
          close: candle.close,
          volume: candle.volume || 0
        });
      }
      
      // Dọn dẹp nến cũ khỏi bộ nhớ
      cleanupOldCandles(timeframe, candleTimestamp);
    } catch (error) {
      console.error(`❌ Lỗi khi xử lý nến ${candleKey}:`, error);
      
      // Xử lý lỗi mà không phụ thuộc vào Candlestick.findOne
      if (candle) {
        // Nếu đã có trong bộ nhớ, giữ nguyên
        console.log(`ℹ️ Sử dụng phiên bản cache của nến ${candleKey}`);
      } else {
        // Tạo một candle tạm thời trong bộ nhớ
        console.log(`ℹ️ Tạo nến tạm thời cho ${candleKey}`);
        const tempCandle = {
          time: Math.floor(candleDate.getTime() / 1000),
          open: price,
          high: price,
          low: price,
          close: price,
          volume: volume
        };
        currentCandles.set(candleKey, tempCandle);
        
        if (broadcastCallback) {
          broadcastCallback(timeframe, tempCandle);
        }
      }
    }
  }
  
  

// Dọn dẹp candles cũ trong bộ nhớ
function cleanupOldCandles(timeframe, currentTimestamp) {
  const maxAge = 24 * 60 * 60 * 1000; // 24 giờ
  
  for (const [key, candle] of currentCandles.entries()) {
    const [candleTimeframe, candleTime] = key.split('-');
    
    if (
      candleTimeframe === timeframe && 
      currentTimestamp - parseInt(candleTime) > maxAge
    ) {
      currentCandles.delete(key);
    }
  }
}

// Chuyển đổi timeframe sang milliseconds
function timeframeToMs(timeframe) {
  switch(timeframe) {
    case "1m": return 60 * 1000;
    case "15m": return 15 * 60 * 1000;
    case "1h": return 60 * 60 * 1000;
    case "1d": return 24 * 60 * 60 * 1000;
    case "1M": return 30 * 24 * 60 * 60 * 1000; // Xấp xỉ
    default: return 60 * 1000; // Mặc định 1m
  }
}

// Đóng kết nối Binance
function stopBinanceStream() {
  if (binanceWS) {
    try {
      binanceWS.terminate();
      console.log("🔴 Đóng kết nối Binance WebSocket");
    } catch (error) {
      console.error("❌ Lỗi khi đóng kết nối Binance WebSocket:", error);
    }
  }
  
  clearTimeout(reconnectTimeout);
}

module.exports = {
  startBinanceStream,
  stopBinanceStream
};