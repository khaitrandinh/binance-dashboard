import React, { useState, useEffect, useRef } from "react";
import Chart from "react-apexcharts";

const API_URL = process.env.REACT_APP_API_URL || "http://localhost:5000/api/candles";
const WS_URL = "ws://localhost:5000/ws";  // 🛑 LUÔN dùng port 5000, không phải 3000

const CandlestickChart = () => {
  const [series, setSeries] = useState([{
    name: 'candle',
    data: []
  }]);
  const [options, setOptions] = useState({
    chart: {
      type: 'candlestick',
      height: 400,
      id: 'candles',
      toolbar: {
        autoSelected: 'pan',
        show: true
      },
      animations: {
        enabled: false
      }
    },
    title: {
      text: 'BTC/USDT Real-time Chart',
      align: 'left'
    },
    xaxis: {
      type: 'datetime',
      tooltip: {
        enabled: true
      }
    },
    yaxis: {
      tooltip: {
        enabled: true
      }
    },
    plotOptions: {
      candlestick: {
        colors: {
          upward: '#26a69a',
          downward: '#ef5350'
        }
      }
    }
  });
  
  const wsRef = useRef(null);
  const [connectionStatus, setConnectionStatus] = useState("disconnected");
  let retryCount = 0;

  useEffect(() => {
    console.log(`🛠 WebSocket URL đang dùng: ${WS_URL}`);
    loadHistoricalData();
    connectWebSocket();
    
    return () => {
      if (wsRef.current) wsRef.current.close();
    };
  }, []);

  // 📌 Lấy dữ liệu lịch sử từ API
  const loadHistoricalData = async () => {
    try {
      console.log(`📥 Tải dữ liệu lịch sử từ API: ${API_URL}`);
      const response = await fetch(`${API_URL}`);
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      const data = await response.json();
      
      // Convert data format for ApexCharts
      const formattedData = data.map(candle => ({
        // Ensure time is a number and convert to milliseconds if needed
        x: typeof candle.time === 'number' ? new Date(candle.time * 1000).getTime() : new Date(candle.time).getTime(),
        y: [
          parseFloat(candle.open), 
          parseFloat(candle.high), 
          parseFloat(candle.low), 
          parseFloat(candle.close)
        ]
      }));
      
      console.log(`✅ Sample formatted data:`, formattedData[0]);
      console.log(`✅ Đã tải ${formattedData.length} nến lịch sử.`);
      
      setSeries([{
        name: 'candle',
        data: formattedData
      }]);
    } catch (error) {
      console.error("❌ Lỗi tải dữ liệu nến từ API:", error);
    }
  };

  // 📌 Kết nối WebSocket để nhận dữ liệu real-time
  const connectWebSocket = () => {
    if (wsRef.current) wsRef.current.close();

    console.log(`🔌 Đang kết nối WebSocket: ${WS_URL}`);
    const ws = new WebSocket(WS_URL);
    let pingInterval;

    ws.onopen = () => {
      console.log("✅ Kết nối WebSocket thành công!");
      setConnectionStatus("connected");
      retryCount = 0; // Reset số lần thử lại khi kết nối thành công
      
      // Send ping every 30 seconds
      pingInterval = setInterval(() => {
        ws.send(JSON.stringify({type: "ping"}));
      }, 30000);
    };

    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        console.log("📊 Nhận dữ liệu từ WS:", message);
        
        if (message.type === "candle") {
          console.log("📊 Cập nhật nến:", message.data);
          
          // Format the candle data for ApexCharts - ensure all values are numbers
          const time = typeof message.data.time === 'number' 
            ? new Date(message.data.time * 1000).getTime() 
            : new Date(message.data.time).getTime();
            
          const newCandle = {
            x: time,
            y: [
              parseFloat(message.data.open),
              parseFloat(message.data.high), 
              parseFloat(message.data.low), 
              parseFloat(message.data.close)
            ]
          };
          
          console.log("📊 Formatted candle:", newCandle);
          
          // Update series with the new candle
          setSeries(prevSeries => {
            const updatedData = [...prevSeries[0].data];
            
            // Find if this candle already exists (same timestamp)
            const existingIndex = updatedData.findIndex(
              candle => candle.x === newCandle.x
            );
            
            if (existingIndex >= 0) {
              // Update existing candle
              updatedData[existingIndex] = newCandle;
            } else {
              // Add new candle
              updatedData.push(newCandle);
              
              // Optional: Keep only the last X candles to prevent excessive data
              if (updatedData.length > 300) {
                updatedData.shift();
              }
            }
            
            return [{
              name: 'candle',
              data: updatedData
            }];
          });
        }
      } catch (error) {
        console.error("❌ Lỗi xử lý dữ liệu WebSocket:", error);
      }
    };

    ws.onerror = (error) => {
      console.error("❌ Lỗi WebSocket:", error);
      setConnectionStatus("error");
    };

    ws.onclose = (event) => {
      console.warn(`⚠️ WebSocket bị đóng (code: ${event.code})! Đang thử kết nối lại...`);
      clearInterval(pingInterval);
      setConnectionStatus("disconnected");

      let retryDelay = Math.min(5000 * Math.pow(2, retryCount), 30000);
      retryCount++;
      console.log(`🔄 Thử kết nối lại sau ${retryDelay / 1000}s`);

      setTimeout(connectWebSocket, retryDelay);
    };

    wsRef.current = ws;
  };

  return (
    <div className="p-4 bg-white rounded-lg shadow">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold">📊 Biểu đồ nến Real-time (BTC/USDT)</h2>
        <div className="flex items-center">
          <span className={`inline-block w-3 h-3 rounded-full mr-1 ${
              connectionStatus === 'connected' ? 'bg-green-500' : 
              connectionStatus === 'disconnected' ? 'bg-red-500' : 
              'bg-yellow-500'
          }`} />
          <span className="text-sm text-gray-600">
            {connectionStatus === 'connected' ? '🟢 Trực tuyến' : '🟡 Đang kết nối...'}
          </span>
        </div>
      </div>
      
      <div className="w-full h-[400px] border border-gray-200 rounded">
        {series[0].data.length > 0 ? (
          <Chart 
            options={options} 
            series={series} 
            type="candlestick" 
            height={400} 
            width="100%" 
          />
        ) : (
          <div className="flex items-center justify-center h-full">
            <p>Loading chart data...</p>
          </div>
        )}
      </div>
      
      <div className="mt-2 text-sm text-gray-500 flex justify-between">
        <span>📡 Nguồn dữ liệu: Binance (thông qua Backend)</span>
        <span>🔄 Cập nhật: Real-time</span>
      </div>
    </div>
  );
};

export default CandlestickChart;