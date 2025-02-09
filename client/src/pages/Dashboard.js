import React from "react";
import MarketTable from "../components/MarketTable";
import RealTimeChart from "../components/RealTimeChart";

const Dashboard = () => {
  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold">🔥 Binance Dashboard</h1>
      <MarketTable />
      <RealTimeChart />
    </div>
  );
};

export default Dashboard;
