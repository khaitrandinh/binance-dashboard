import React, { useEffect, useState } from 'react';
import axios from 'axios';
import dayjs from 'dayjs';

const HeatmapChart = () => {
  const [timeframe, setTimeframe] = useState("day");
  const [selectedDate, setSelectedDate] = useState(dayjs());
  const [xLabels, setXLabels] = useState([]);
  const [yLabels, setYLabels] = useState([]);
  const [rawBuyData, setRawBuyData] = useState([]);
  const [rawSellData, setRawSellData] = useState([]);
  const [buyHeatmapData, setBuyHeatmapData] = useState([]);
  const [sellHeatmapData, setSellHeatmapData] = useState([]);
  const [maxBuyValue, setMaxBuyValue] = useState(1);
  const [maxSellValue, setMaxSellValue] = useState(1);

  // useEffect(() => {
  //   fetchData();
  // }, [timeframe, selectedDate]);

  const fetchData = async () => {
    try {
      let dateFormat;
      let labels = [];
      if (timeframe === "day") {
        dateFormat = selectedDate.format("YYYY-MM-DD");
        labels = Array.from({ length: 24 }, (_, i) => `${String(i).padStart(2, '0')}:00`);
      } else if (timeframe === "month") {
        dateFormat = selectedDate.format("YYYY-MM");
        const daysInMonth = selectedDate.daysInMonth();
        labels = Array.from({ length: daysInMonth }, (_, i) => (i + 1).toString());
      } else if (timeframe === "year") {
        dateFormat = selectedDate.format("YYYY");
        labels = ["Tháng 1", "Tháng 2", "Tháng 3", "Tháng 4", "Tháng 5", "Tháng 6", "Tháng 7", "Tháng 8", "Tháng 9", "Tháng 10", "Tháng 11", "Tháng 12"];
      }

      const response = await axios.get(`http://localhost:5000/api/heatmap/${timeframe}/${dateFormat}`);
      console.log(response);

      if (!response.data || !response.data.buyData || !response.data.sellData || !response.data.priceRanges) {
        console.warn("🚨 Không có dữ liệu hoặc dữ liệu không hợp lệ!");
        resetData();
        return;
      }

      const { buyData, sellData, priceRanges } = response.data;

      setXLabels(labels);

      // Sắp xếp priceRanges theo thứ tự giảm dần (range cao nhất hiển thị ở trên cùng)
      const sortedPriceRanges = [...priceRanges].sort((a, b) => {
        const [aMin] = a.split('-').map(Number);
        const [bMin] = b.split('-').map(Number);
        return bMin - aMin;
      });
      setYLabels(sortedPriceRanges);

      // Hàm chuyển dữ liệu thành ma trận raw (row = priceRange, col = nhóm thời gian)
      const processHeatmapData = (data) => {
        const columns = labels.length;
        const matrix = Array(sortedPriceRanges.length)
          .fill(null)
          .map(() => Array(columns).fill(0));
      
        data.forEach((dataPoint) => {
          let timeGroup;
          if (timeframe === 'day') {
            timeGroup = dataPoint.hour;
          } else if (timeframe === 'month') {
            timeGroup = dataPoint.day;  // BE trả về key 'day' cho dữ liệu theo tháng
          } else if (timeframe === 'year') {
            timeGroup = dataPoint.month; // BE trả về key 'month' cho dữ liệu theo năm
          }
          // Với day: index = timeGroup, còn với month/year (nhận về 1-indexed) thì trừ đi 1
          const idx = timeframe === 'day' ? timeGroup : timeGroup - 1;
          sortedPriceRanges.forEach((range, rowIndex) => {
            matrix[rowIndex][idx] = dataPoint[range] || 0;
          });
        });
        return matrix;
      };
      

      const rawBuyMatrix = processHeatmapData(buyData);
      const rawSellMatrix = processHeatmapData(sellData);

      setRawBuyData(rawBuyMatrix);
      setRawSellData(rawSellMatrix);

      const maxRawBuy = Math.max(...rawBuyMatrix.flat());
      const maxRawSell = Math.max(...rawSellMatrix.flat());

      const normalizeMatrix = (matrix, maxRaw) =>
        matrix.map(row =>
          row.map(val => (maxRaw > 0 ? Math.round((val / maxRaw) * 4) : 0))
        );

      const normalizedBuyMatrix = normalizeMatrix(rawBuyMatrix, maxRawBuy);
      const normalizedSellMatrix = normalizeMatrix(rawSellMatrix, maxRawSell);

      setBuyHeatmapData(normalizedBuyMatrix);
      setSellHeatmapData(normalizedSellMatrix);
      setMaxBuyValue(Math.max(...normalizedBuyMatrix.flat().filter(v => !isNaN(v)), 1));
      setMaxSellValue(Math.max(...normalizedSellMatrix.flat().filter(v => !isNaN(v)), 1));
    } catch (error) {
      console.error("❌ Lỗi khi lấy dữ liệu:", error);
      resetData();
    }
  };

  const resetData = () => {
    setRawBuyData([]);
    setRawSellData([]);
    setBuyHeatmapData([]);
    setSellHeatmapData([]);
    setXLabels([]);
    setYLabels([]);
  };

  // Hàm điều chỉnh độ đậm của màu sắc dựa trên normalized value
  const getOpacity = (value, maxValue) => {
    if (value === 0) return 0.1; 
    return Math.pow(value / maxValue, 0.8);
  };

  const tableClass = "w-full border-collapse min-w-[800px]";
  const thClass = "p-2 border border-gray-300 text-sm bg-gray-100";
  const tdClass = "p-2 border border-gray-300 text-center text-sm h-[50px] w-[70px]";
  const labelTdClass = "p-2 border border-gray-300 font-medium text-sm min-w-[150px] text-right";

  // Xử lý thay đổi timeframe
  const handleTimeframeChange = (e) => {
    setTimeframe(e.target.value);
    setSelectedDate(dayjs());
  };

  // Xử lý thay đổi input ngày/tháng/năm tùy theo timeframe
  const handleDateChange = (e) => {
    const value = e.target.value;
    if (timeframe === 'year') {
      setSelectedDate(dayjs(value, "YYYY"));
    } else if (timeframe === 'month') {
      setSelectedDate(dayjs(value, "YYYY-MM"));
    } else {
      setSelectedDate(dayjs(value, "YYYY-MM-DD"));
    }
  };

  return (
    <div className="w-full max-w-5xl mx-auto p-6 bg-white rounded-lg shadow-lg">
      <h2 className="text-3xl font-bold text-center mb-6 text-gray-800">
        🔥 Heatmap Khối Lượng Giao Dịch BTC/USDT
      </h2>

      <div className="flex flex-col sm:flex-row justify-center items-center gap-4 mb-6">
        <select
          value={timeframe}
          onChange={handleTimeframeChange}
          className="px-4 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="day">Ngày</option>
          <option value="month">Tháng</option>
          <option value="year">Năm</option>
        </select>

        {timeframe === "day" && (
          <input
            type="date"
            value={selectedDate.format('YYYY-MM-DD')}
            onChange={handleDateChange}
            className="px-4 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        )}

        {timeframe === "month" && (
          <input
            type="month"
            value={selectedDate.format('YYYY-MM')}
            onChange={handleDateChange}
            className="px-4 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        )}

        {timeframe === "year" && (
          <input
            type="number"
            value={selectedDate.format('YYYY')}
            onChange={handleDateChange}
            className="px-4 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            min="2009"
            max={dayjs().format('YYYY')}
          />
        )}

        <button 
          onClick={fetchData}
          className="px-4 py-2 bg-blue-500 text-white rounded-md text-sm hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          Lấy dữ liệu
        </button>
      </div>

      <div className="space-y-10">
        <div>
          <h3 className="text-center font-bold mb-4 text-blue-600 text-xl">
            🔵 Heatmap Khối Lượng Mua
          </h3>
          <div className="overflow-x-auto">
            <table className={tableClass}>
              <thead>
                <tr>
                  <th className={thClass}>Price Range</th>
                  {xLabels.map(label => (
                    <th key={label} className={thClass}>
                      {timeframe === 'month' ? `Day ${label}` : label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {buyHeatmapData.map((row, i) => (
                  <tr key={yLabels[i]}>
                    <td className={labelTdClass}>
                      {yLabels[i]}
                    </td>
                    {row.map((value, j) => {
                      const rawValue = rawBuyData[i][j];
                      return (
                        <td
                          key={`${i}-${j}`}
                          className={tdClass}
                          style={{
                            backgroundColor: rawValue <= 0 
                              ? "white" 
                              : `rgba(0, 150, 255, ${getOpacity(value, maxBuyValue)})`,
                            color: value / maxBuyValue > 0.6 ? "white" : "black"
                          }}
                        >
                          {rawValue > 0 ? rawValue.toFixed(1) : ''}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div>
          <h3 className="text-center font-bold mb-4 text-red-600 text-xl">
            🔴 Heatmap Khối Lượng Bán
          </h3>
          <div className="overflow-x-auto">
            <table className={tableClass}>
              <thead>
                <tr>
                  <th className={thClass}>Price Range</th>
                  {xLabels.map(label => (
                    <th key={label} className={thClass}>
                      {timeframe === 'month' ? `Day ${label}` : label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sellHeatmapData.map((row, i) => (
                  <tr key={yLabels[i]}>
                    <td className={labelTdClass}>
                      {yLabels[i]}
                    </td>
                    {row.map((value, j) => {
                      const rawValue = rawSellData[i][j];
                      return (
                        <td
                          key={`${i}-${j}`}
                          className={tdClass}
                          style={{
                            backgroundColor: rawValue <= 0 
                              ? "white" 
                              : `rgba(255, 0, 0, ${getOpacity(value, maxSellValue)})`,
                            color: value / maxSellValue > 0.6 ? "white" : "black"
                          }}
                        >
                          {rawValue > 0 ? rawValue.toFixed(1) : ''}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HeatmapChart;