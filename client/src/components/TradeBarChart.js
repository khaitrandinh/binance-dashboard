import React, { useEffect, useState } from "react";
import axios from "axios";
import {
  ComposedChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Line,
} from "recharts";

const TradeBarChart = () => {
  const [tradeData, setTradeData] = useState([]);
  const [timeframe, setTimeframe] = useState("day"); // Mặc định chọn ngày
  const [startDate, setStartDate] = useState(""); // Ngày bắt đầu
  const [endDate, setEndDate] = useState(""); // Ngày kết thúc
  const [loading, setLoading] = useState(false); // Trạng thái tải dữ liệu

  // 🔹 **Hàm lấy dữ liệu từ API**
  const fetchData = async () => {
    setLoading(true);
    let apiUrl = `http://localhost:5000/api/trades/trade-volume/${timeframe}`;

    // 📌 Xử lý timeframe
    if (timeframe === "range") {
      if (!startDate || !endDate) {
        alert("Vui lòng chọn khoảng ngày hợp lệ!");
        setLoading(false);
        return;
      }
      apiUrl += `?start=${startDate}&end=${endDate}`;
    } else if (timeframe !== "all" && startDate) {
      apiUrl += `/${startDate}`;
    }

    try {
      const response = await axios.get(apiUrl);
      console.log("📊 Dữ liệu nhận từ API:", response.data);

      if (!Array.isArray(response.data) || response.data.length === 0) {
        console.warn("🚨 API trả về dữ liệu không hợp lệ hoặc không có dữ liệu!");
        setTradeData([]);
        setLoading(false);
        return;
      }

      // 📌 Định dạng dữ liệu cho biểu đồ
      const formattedData = response.data.map((item) => ({
        priceRange: item.label, // Chuyển label thành priceRange
        buyVolume: item.buyVolume > 0 ? item.buyVolume : 0, // Không dùng giá trị mặc định 0.1
        sellVolume: item.sellVolume > 0 ? item.sellVolume : 0,
      }));

      console.log("📈 Dữ liệu sau khi xử lý:", formattedData);
      setTradeData(formattedData);
    } catch (error) {
      console.error("❌ Lỗi khi lấy trade-volume:", error);
      setTradeData([]);
    } finally {
      setLoading(false);
    }
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
            setStartDate(""); // Reset ngày chọn khi đổi loại thời gian
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
          className={`bg-blue-600 text-white px-6 py-3 rounded text-lg hover:bg-blue-800 ${
            loading ? "opacity-50 cursor-not-allowed" : ""
          }`}
          disabled={loading}
        >
          {loading ? "Đang tải..." : "Lấy dữ liệu"}
        </button>
      </div>

      {/* 🔹 Biểu đồ cột & xu hướng */}
      {tradeData.length > 0 ? (
        <ResponsiveContainer width="100%" height={500}>
          <ComposedChart data={tradeData} margin={{ top: 20, right: 30, left: 20, bottom: 80 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis
              dataKey="priceRange"
              angle={-45} // Xoay text trục X nếu quá dài
              textAnchor="end"
              interval={0}
              tick={{ fontSize: 12, fontWeight: "bold" }}
              label={{
                value: "Vùng giá BTC (USDT)",
                position: "bottom",
                offset: 50,
                style: { fontSize: "16px", fontWeight: "bold" },
              }}
            />
            <YAxis
              domain={[0, "auto"]}
              tick={{ fontSize: 14, fontWeight: "bold" }}
              label={{
                value: "Khối lượng BTC",
                angle: -90,
                position: "left",
                style: { fontSize: "16px", fontWeight: "bold" },
              }}
            />
            <Tooltip />
            <Legend verticalAlign="top" align="right" height={40} wrapperStyle={{ fontSize: "14px" }} />

            {/* 📌 Hiển thị cột mua/bán */}
            <Bar dataKey="buyVolume" stackId="stack" fill="#4CAF50" name="Khối lượng mua BTC" />
            <Bar dataKey="sellVolume" stackId="stack" fill="#F44336" name="Khối lượng bán BTC" />

            {/* 📌 Đường xu hướng */}
            <Line type="monotone" dataKey="buyVolume" stroke="#2196F3" strokeWidth={3} dot={{ r: 4 }} name="Xu hướng Mua" />
            <Line type="monotone" dataKey="sellVolume" stroke="#FF5722" strokeWidth={3} dot={{ r: 4 }} name="Xu hướng Bán" />
          </ComposedChart>
        </ResponsiveContainer>
      ) : (
        <p className="text-center text-red-500 font-bold mt-6">🚫 Không có dữ liệu</p>
      )}
    </div>
  );
};

export default TradeBarChart;
