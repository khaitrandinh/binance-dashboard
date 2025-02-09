import React, { useState, useEffect } from "react";
import axios from "axios";

const MarketTable = () => {
  const [marketData, setMarketData] = useState([]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await axios.get("http://localhost:5000/api/market/real-time/BTCUSDT");
        setMarketData([response.data]); // Lưu vào state
      } catch (error) {
        console.error("Lỗi khi lấy dữ liệu real-time:", error);
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 5000); // Gọi API mỗi 5s

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="p-4">
      <h2 className="text-xl font-bold">📊 Bảng giá real-time</h2>
      <table className="w-full mt-2 border-collapse border border-gray-400">
        <thead>
          <tr className="bg-gray-100">
            <th className="border px-4 py-2">Cặp giao dịch</th>
            <th className="border px-4 py-2">Giá hiện tại</th>
            <th className="border px-4 py-2">Khối lượng giao dịch</th>
          </tr>
        </thead>
        <tbody>
          {marketData.map((data) => (
            <tr key={data.symbol}>
              <td className="border px-4 py-2">{data.symbol}</td>
              <td className="border px-4 py-2 text-green-500 font-bold">{data.price}</td>
              <td className="border px-4 py-2">{data.volume}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default MarketTable;
