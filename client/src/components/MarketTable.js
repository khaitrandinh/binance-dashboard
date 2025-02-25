import React, { useState, useEffect } from "react";
import axios from "axios";
import { TrendingUp, TrendingDown, RefreshCw } from "lucide-react";

const MarketTable = () => {
  const [marketData, setMarketData] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoading(true);
        // Thêm tham số để tránh cache
        const response = await axios.get(`http://localhost:5000/api/market/real-time/BTCUSDT?_=${new Date().getTime()}`);
        console.log("API response:", response.data); // Log để debug
        setMarketData([response.data]); // Lưu vào state
        setLastUpdated(new Date());
        setIsLoading(false);
      } catch (error) {
        console.error("Lỗi khi lấy dữ liệu real-time:", error);
        setIsLoading(false);
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 5000); // Gọi API mỗi 5s

    return () => clearInterval(interval);
  }, []);

  // Định dạng số với dấu phẩy ngàn và làm tròn đến 2 chữ số thập phân
  const formatNumber = (num) => {
    if (num === null || num === undefined) return "0.00";
    return Number(num).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  // Định dạng phần trăm
  const formatPercent = (num) => {
    if (num === null || num === undefined) return "0.00";
    return Number(num).toFixed(2);
  };

  // Định dạng thời gian cập nhật
  const formatTime = (date) => {
    if (!date) return "";
    return date.toLocaleTimeString('vi-VN');
  };

  // Xác định màu sắc dựa trên giá trị thay đổi
  const getPriceColor = (change) => {
    if (change > 0) return "text-green-500";
    if (change < 0) return "text-red-500";
    return "text-gray-700";
  };

  return (
    <div className="p-6 bg-white rounded-lg shadow-lg">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-2xl font-bold text-gray-800">📊 Bảng giá Crypto</h2>
        <div className="flex items-center text-sm text-gray-500">
          <RefreshCw size={16} className={`mr-2 ${isLoading ? "animate-spin" : ""}`} />
          {lastUpdated && (
            <span>Cập nhật lúc: {formatTime(lastUpdated)}</span>
          )}
        </div>
      </div>
      
      <div className="overflow-x-auto">
        <table className="w-full border-collapse rounded-lg overflow-hidden">
          <thead>
            <tr className="bg-gray-100">
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Cặp giao dịch</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Giá hiện tại</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Thay đổi</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Khối lượng (24h)</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {marketData.map((data) => {
              const priceChange = data.priceChange || 0;
              const priceChangePercent = data.priceChangePercent || 0;
              const priceColor = getPriceColor(priceChange);
              
              return (
                <tr key={data.symbol} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="w-8 h-8 bg-yellow-100 rounded-full flex items-center justify-center mr-3">
                        <span className="text-yellow-600 font-bold">{data.symbol.substring(0, 1)}</span>
                      </div>
                      <div>
                        <div className="font-medium text-gray-900">{data.symbol}</div>
                        <div className="text-sm text-gray-500">Bitcoin</div>
                      </div>
                    </div>
                  </td>
                  <td className={`px-6 py-4 whitespace-nowrap font-bold ${priceColor}`}>
                    <div className="flex items-center">
                      ${formatNumber(data.price)}
                      {priceChange > 0 && <TrendingUp size={16} className="ml-2" />}
                      {priceChange < 0 && <TrendingDown size={16} className="ml-2" />}
                    </div>
                  </td>
                  <td className={`px-6 py-4 whitespace-nowrap ${priceColor}`}>
                    <div className="flex items-center">
                      <span className="px-2 py-1 text-xs rounded-full bg-opacity-20 mr-2" 
                        style={{ backgroundColor: priceChange > 0 ? "rgba(16, 185, 129, 0.1)" : 
                                             priceChange < 0 ? "rgba(239, 68, 68, 0.1)" : 
                                             "rgba(156, 163, 175, 0.1)" }}>
                        {priceChange > 0 ? "+" : ""}{formatNumber(priceChange)} ({priceChangePercent > 0 ? "+" : ""}{formatPercent(priceChangePercent)}%)
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-gray-700">
                    {formatNumber(data.volume)} USDT
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      
      {marketData.length === 0 && !isLoading && (
        <div className="text-center py-8 text-gray-500">
          Không có dữ liệu
        </div>
      )}
      
      {isLoading && marketData.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          <RefreshCw size={20} className="animate-spin mx-auto mb-2" />
          Đang tải dữ liệu...
        </div>
      )}
    </div>
  );
};

export default MarketTable;