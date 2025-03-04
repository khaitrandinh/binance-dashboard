import React, { useState, useEffect, useRef } from "react";
import { createChart } from "lightweight-charts";
import { Select, MenuItem } from "@mui/material";
import dayjs from "dayjs";

const RealTimeCandlestickChart = () => {
  const chartContainerRef = useRef(null);
  const chartRef = useRef(null);
  const candleSeriesRef = useRef(null);
  const wsRef = useRef(null);
  const [timeframe, setTimeframe] = useState("1m");
  const [connectionStatus, setConnectionStatus] = useState("disconnected");
  const [retryCount, setRetryCount] = useState(0);
  const maxRetries = 5;

  // Hàm tạo biểu đồ với kiểm tra chiều rộng container
  useEffect(() => {
    const initChart = () => {
      if (!chartContainerRef.current) return;
      // Dùng giá trị mặc định nếu clientWidth là 0
      const containerWidth = chartContainerRef.current.clientWidth || 600;
      
      // Xóa chart cũ nếu có
      if (chartRef.current) {
        chartRef.current.remove();
      }

      try {
        const chart = createChart(chartContainerRef.current, {
          width: containerWidth,
          height: 400,
          layout: {
            background: { color: "#ffffff" },
            textColor: "#000000",
          },
          grid: {
            vertLines: { color: "#eeeeee" },
            horzLines: { color: "#eeeeee" },
          },
          timeScale: {
            timeVisible: true,
            secondsVisible: false,
          },
        });

        // Sử dụng addCandlestickSeries nếu có, ngược lại dùng addSeries với type "candlestick"
        const candleSeries = chart.addSeries({
          type: "candlestick",
          upColor: "#26a69a",
          downColor: "#ef5350",
          borderVisible: false,
          wickUpColor: "#26a69a",
          wickDownColor: "#ef5350",
        });
        
        
        chartRef.current = chart;
        candleSeriesRef.current = candleSeries;
        
        loadHistoricalData();
      } catch (error) {
        console.error("Lỗi khi tạo biểu đồ:", error);
        setConnectionStatus("error");
      }
    };

    // Nếu container chưa có chiều rộng, thử lại sau 300ms
    const timeoutId = setTimeout(initChart, 300);
    return () => {
      clearTimeout(timeoutId);
      if (chartRef.current) {
        chartRef.current.remove();
        chartRef.current = null;
      }
    };
  }, [timeframe]);

  useEffect(() => {
    if (!chartContainerRef.current) return;

    const handleResize = () => {
      if (chartRef.current && chartContainerRef.current) {
        const newWidth = chartContainerRef.current.clientWidth || 600;
        chartRef.current.applyOptions({ width: newWidth });
        chartRef.current.timeScale().fitContent();
      }
    };

    let timeoutId = null;
    const debouncedResize = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(handleResize, 300);
    };

    window.addEventListener("resize", debouncedResize);
    return () => {
      window.removeEventListener("resize", debouncedResize);
      clearTimeout(timeoutId);
    };
  }, []);

  const loadHistoricalData = async () => {
    try {
      if (!candleSeriesRef.current) {
        console.warn("Series chưa được khởi tạo khi cố gắng tải dữ liệu lịch sử");
        return;
      }
      
      setConnectionStatus("loading");
      // Sử dụng URL tương đối thay vì hardcode
      const apiUrl = `/api/candles?timeframe=${timeframe}&limit=100`;
      console.log(`🔍 Đang tải dữ liệu lịch sử từ: ${apiUrl}`);
      
      const response = await fetch(apiUrl);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      if (candleSeriesRef.current && Array.isArray(data) && data.length > 0) {
        console.log(`📊 Đã tải ${data.length} nến lịch sử`);
        const validData = data.filter(candle =>
          candle.time && candle.open !== undefined &&
          candle.high !== undefined &&
          candle.low !== undefined &&
          candle.close !== undefined
        );
        if (validData.length > 0) {
          if (typeof candleSeriesRef.current.setData === "function") {
            candleSeriesRef.current.setData(validData);
          } else if (typeof candleSeriesRef.current.update === "function") {
            validData.forEach(candle => candleSeriesRef.current.update(candle));
          } else {
            console.error("Không tìm thấy phương thức setData hoặc update trên series");
          }
          if (chartRef.current && chartRef.current.timeScale) {
            chartRef.current.timeScale().fitContent();
          }
        } else {
          console.warn("⚠️ Không có dữ liệu hợp lệ sau khi lọc");
        }
      } else {
        console.warn("⚠️ Không nhận được dữ liệu lịch sử hoặc định dạng không đúng");
      }
    } catch (error) {
      console.error("❌ Lỗi khi tải dữ liệu lịch sử:", error);
      setConnectionStatus("error");
    }
  };

  // Hàm tính toán thời gian chờ giữa các lần kết nối lại
  const calculateReconnectDelay = (attempt) => {
    const baseDelay = Math.min(attempt * 2000, 10000); // Tối đa 10 giây
    return baseDelay + Math.random() * 1000; // Thêm độ ngẫu nhiên
  };

  // WebSocket connection
  useEffect(() => {
    // Định nghĩa hàm kết nối WebSocket
    const connectWebSocket = () => {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      
      console.log("🔄 Đang kết nối WebSocket...");
      setConnectionStatus("connecting");
      
      // Sử dụng URL tương đối thay vì hardcode
      // Kiểm tra xem ứng dụng có đang chạy trên HTTPS không để chọn wss hoặc ws
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const host = window.location.host; // Lấy host và port từ URL hiện tại
      
      // Nếu bạn đang chạy WebSocket trên cùng server với frontend
      const wsUrl = `${protocol}//${host}/ws`;
      // Hoặc nếu bạn chạy WebSocket riêng trên port 5000:
      // const wsUrl = `${protocol}//${window.location.hostname}:5000/ws`;
      
      console.log(`🔌 Kết nối đến WebSocket: ${wsUrl}`);
      
      const ws = new WebSocket(wsUrl);
      let reconnectTimer = null;
      let pingInterval = null;
      
      ws.onopen = () => {
        console.log("✅ WebSocket đã kết nối!");
        setConnectionStatus("connected");
        setRetryCount(0);
        clearTimeout(reconnectTimer);
        
        // Gửi thông tin đăng ký timeframe
        ws.send(JSON.stringify({ action: "subscribe", timeframe }));
        
        // Thiết lập ping-pong để duy trì kết nối
        pingInterval = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ action: "ping", timestamp: Date.now() }));
          }
        }, 30000); // Ping mỗi 30 giây
      };
      
      ws.onerror = (error) => {
        console.error("❌ Lỗi kết nối WebSocket:", error);
        setConnectionStatus("error");
      };
      
      ws.onclose = (event) => {
        console.warn(`⚠️ WebSocket bị đóng (code: ${event.code})! Đang thử kết nối lại...`);
        setConnectionStatus("disconnected");
        
        // Xóa interval ping
        if (pingInterval) {
          clearInterval(pingInterval);
        }
        
        setRetryCount(prev => {
          const newCount = prev + 1;
          if (newCount <= maxRetries) {
            const delay = calculateReconnectDelay(newCount);
            console.log(`🔄 Thử kết nối lại lần ${newCount}/${maxRetries} sau ${delay/1000}s`);
            reconnectTimer = setTimeout(connectWebSocket, delay);
          } else {
            console.error("❌ Đã thử kết nối lại quá số lần tối đa");
          }
          return newCount;
        });
      };
      
      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          console.log("📩 Nhận dữ liệu:", message.type);
          
          // Xử lý các loại tin nhắn
          if (message.type === "candle" && candleSeriesRef.current) {
            // Cập nhật dữ liệu nến
            candleSeriesRef.current.update(message.data);
          } else if (message.type === "historical" && candleSeriesRef.current) {
            // Cập nhật dữ liệu lịch sử
            if (Array.isArray(message.data) && message.data.length > 0) {
              candleSeriesRef.current.setData(message.data);
              if (chartRef.current) {
                chartRef.current.timeScale().fitContent();
              }
            }
          } else if (message.type === "pong") {
            // Ghi nhận phản hồi ping
            console.log("🏓 Nhận pong từ server");
          } else if (message.type === "error") {
            console.error("❌ Lỗi từ server:", message.message);
          }
        } catch (error) {
          console.error("❌ Lỗi xử lý dữ liệu WebSocket:", error);
        }
      };
      
      wsRef.current = ws;
    };

    // Thực hiện kết nối
    connectWebSocket();
    
    // Dọn dẹp khi component bị hủy
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
        console.log("🔴 Đóng WebSocket khi component bị unmount");
      }
    };
  }, [timeframe, maxRetries]);

  // Hàm xử lý khi thay đổi timeframe
  const handleTimeframeChange = (e) => {
    setTimeframe(e.target.value);
  };

  // Hàm kết nối lại thủ công
  const handleManualReconnect = () => {
    setRetryCount(0);
    setConnectionStatus("connecting");
    
    // Khởi tạo lại WebSocket bằng cách thay đổi timeframe và trở lại
    const currentTimeframe = timeframe;
    setTimeframe("temp");
    setTimeout(() => {
      setTimeframe(currentTimeframe);
    }, 100);
  };

  return (
    <div className="p-4 bg-white rounded-lg shadow">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold">📊 Biểu đồ nến Real-time (BTC/USDT)</h2>
        <div className="flex items-center">
          <div className="mr-3">
            <span className={`inline-block w-3 h-3 rounded-full mr-1 ${
              connectionStatus === 'connected' ? 'bg-green-500' : 
              connectionStatus === 'connecting' ? 'bg-yellow-500' : 
              connectionStatus === 'loading' ? 'bg-blue-500' :
              connectionStatus === 'error' ? 'bg-red-500' : 'bg-gray-500'
            }`}></span>
            <span className="text-sm text-gray-600">
              {connectionStatus === 'connected' ? 'Trực tuyến' : 
              connectionStatus === 'connecting' ? 'Đang kết nối...' : 
              connectionStatus === 'loading' ? 'Đang tải dữ liệu...' :
              connectionStatus === 'error' ? 'Lỗi kết nối' : 'Ngoại tuyến'}
              {connectionStatus !== 'connected' && retryCount > 0 && ` (Thử lại ${retryCount}/${maxRetries})`}
            </span>
          </div>
          
          {/* Nút kết nối lại thủ công */}
          {connectionStatus !== 'connected' && retryCount >= maxRetries && (
            <button 
              onClick={handleManualReconnect}
              className="bg-blue-500 text-white px-3 py-1 rounded text-sm mr-3"
            >
              Kết nối lại
            </button>
          )}
          
          <Select 
            value={timeframe} 
            onChange={handleTimeframeChange}
            size="small"
            className="min-w-[100px]"
          >
            <MenuItem value="1m">1 phút</MenuItem>
            <MenuItem value="15m">15 phút</MenuItem>
            <MenuItem value="1h">1 giờ</MenuItem>
            <MenuItem value="1d">1 ngày</MenuItem>
          </Select>
        </div>
      </div>
      <div 
        ref={chartContainerRef} 
        className="w-full h-[400px] border border-gray-200 rounded"
      />
      <div className="mt-2 text-sm text-gray-500 flex justify-between">
        <span>Nguồn dữ liệu: Binance</span>
        <span>Cập nhật: Real-time</span>
      </div>
    </div>
  );
};

export default RealTimeCandlestickChart;