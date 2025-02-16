import React, { useEffect, useState } from "react";
import axios from "axios";
import {
  ComposedChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Legend, ResponsiveContainer, Line
} from "recharts";

const TradeBarChart = () => {
  const [tradeData, setTradeData] = useState([]);
  const [timeframe, setTimeframe] = useState("day");  // Mặc định chọn theo ngày
  const [startDate, setStartDate] = useState("");  // Ngày bắt đầu
  const [endDate, setEndDate] = useState("");      // Ngày kết thúc

  // 🔹 **Hàm lấy dữ liệu từ API**
  const fetchData = () => {
    let apiUrl = `http://localhost:5000/api/trades/trade-volume/${timeframe}`;
    
    if (timeframe === "range") {
      if (!startDate || !endDate) {
        alert("Vui lòng chọn khoảng ngày hợp lệ!");
        return;
      }
      apiUrl += `?start=${startDate}&end=${endDate}`;
    } else if (timeframe !== "all" && startDate) {
      apiUrl += `/${startDate}`;
    }

    axios.get(apiUrl)
      .then((response) => {
        console.log("📊 Dữ liệu nhận từ API:", response.data);

        // Chuyển đổi key label -> priceRange để khớp với biểu đồ
        const formattedData = response.data.map(item => ({
          priceRange: item.label, // Chuyển label thành priceRange
          buyVolume: item.buyVolume > 0 ? item.buyVolume : 0.1, // Đảm bảo có giá trị để hiển thị
          sellVolume: item.sellVolume > 0 ? item.sellVolume : 0.1
        }));

        console.log("📈 Dữ liệu sau khi xử lý:", formattedData);
        setTradeData(formattedData);
      })
      .catch((error) => console.error("❌ Lỗi khi lấy trade-volume:", error));
  };

  return (
    <div className="p-6">
      <h2 className="text-3xl font-bold text-center mb-6">
        📊 Khối lượng BTC theo vùng giá (Mua/Bán)
      </h2>

      {/* 🔹 Bộ lọc thời gian */}
      <div className="flex flex-wrap gap-4 mb-6 items-center justify-center">
        <select
          value={timeframe}
          onChange={(e) => {
            setTimeframe(e.target.value);
            setStartDate("");  // Reset ngày chọn khi đổi loại thời gian
            setEndDate("");
          }}
          className="border p-3 rounded text-lg"
        >
          <option value="day">Theo Ngày</option>
          <option value="month">Theo Tháng</option>
          <option value="year">Theo Năm</option>
          <option value="range">Khoảng Ngày</option>
        </select>

        {/* 🔹 Input chọn thời gian */}
        {timeframe !== "range" && timeframe !== "all" ? (
          <input
            type={timeframe === "day" ? "date" : timeframe === "month" ? "month" : "number"}
            placeholder="Chọn thời gian"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="border p-3 rounded text-lg"
          />
        ) : timeframe === "range" ? (
          <>
            <input
              type="date"
              placeholder="Từ ngày"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="border p-3 rounded text-lg"
            />
            <input
              type="date"
              placeholder="Đến ngày"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="border p-3 rounded text-lg"
            />
          </>
        ) : null}

        {/* 🔹 Nút xác nhận */}
        <button
          onClick={fetchData}
          className="bg-blue-600 text-white px-6 py-3 rounded text-lg hover:bg-blue-800"
        >
          Lấy dữ liệu
        </button>
      </div>

      {/* 🔹 Biểu đồ cột & xu hướng */}
      <ResponsiveContainer width="100%" height={500}>
        <ComposedChart data={tradeData} margin={{ top: 20, right: 30, left: 20, bottom: 80 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis
            dataKey="priceRange"
            angle={0}
            textAnchor="middle"
            interval={0}
            tick={{ fontSize: 16, fontWeight: "bold" }}
            label={{ 
              value: "Vùng giá BTC (USDT)", 
              position: "bottom", 
              offset: 50, 
              style: { fontSize: "18px", fontWeight: "bold" }
            }}
          />
          <YAxis domain={[0, "auto"]} tick={{ fontSize: 16, fontWeight: "bold" }} />
          <Tooltip />
          <Legend verticalAlign="top" align="right" height={40} wrapperStyle={{ fontSize: "16px" }} />

          {/* 📌 Hiển thị cột mua/bán */}
          <Bar dataKey="buyVolume" stackId="stack" fill="#4CAF50" name="Khối lượng mua BTC" />
          <Bar dataKey="sellVolume" stackId="stack" fill="#F44336" name="Khối lượng bán BTC" />

          {/* 📌 Đường xu hướng nằm trong ComposedChart */}
          <Line type="monotone" dataKey="buyVolume" stroke="#2196F3" strokeWidth={3} dot={{ r: 4 }} name="Xu hướng Mua" />
          <Line type="monotone" dataKey="sellVolume" stroke="#FF5722" strokeWidth={3} dot={{ r: 4 }} name="Xu hướng Bán" />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
};

export default TradeBarChart;
