import React, { useEffect, useState } from "react";
import axios from "axios";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";

const StackedBarChart = () => {
  const [stackedBarData, setStackedBarData] = useState([]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await axios.get("http://localhost:5000/api/trades/stacked");

        if (!Array.isArray(response.data)) {
          console.error("❌ API không trả về array!", response.data);
          return;
        }

        console.log("📩 Stacked Bar Chart Data:", response.data);
        setStackedBarData(response.data);
      } catch (error) {
        console.error("❌ Lỗi khi lấy dữ liệu Stacked Bar Chart:", error);
      }
    };

    fetchData();
  }, []);

  return (
    <div className="p-4">
      <h2 className="text-xl font-bold">📊 Biểu đồ Stacked Bar - Khối lượng giao dịch theo thời gian</h2>
      {stackedBarData.length > 0 ? (
        <ResponsiveContainer width="100%" height={400}>
          <BarChart data={stackedBarData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="time" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Bar dataKey="buyVolume" stackId="a" fill="#4caf50" />
            <Bar dataKey="sellVolume" stackId="a" fill="#f44336" />
          </BarChart>
        </ResponsiveContainer>
      ) : (
        <p>⏳ Đang tải dữ liệu...</p>
      )}
    </div>
  );
};

export default StackedBarChart;
