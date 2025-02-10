import React from "react";
import MarketTable from "../components/MarketTable";
import RealTimeChart from "../components/RealTimeChart";
import HistoryChart from "../components/HistoryChart";
import Candlestick from "../components/CandlestickChart";

const Dashboard = () => {
  const symbol = "BTCUSDT"; // Đảm bảo truyền đúng symbol

  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold">🔥 Binance Dashboard</h1>
      <MarketTable />
      <RealTimeChart />
      <Candlestick symbol={symbol}/>
      <HistoryChart symbol={symbol} />  {/* Đảm bảo truyền symbol đúng */}
    </div>
  );
};

export default Dashboard;
