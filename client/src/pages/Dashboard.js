import React from "react";
import MarketTable from "../components/MarketTable";
import RealTimeChart from "../components/RealTimeChart";
import TradeBarChart from "../components/TradeBarChart";
import HeatmapChart from "../components/HeatmapChart";
import StackedBarChart from "../components/StackedBarChart";

const Dashboard = () => {
  return (
    <div className="p-6">
      {/* Section 1: Dữ liệu Realtime */}
      <h1 className="text-3xl font-bold">📡 Dữ liệu Realtime</h1>
      {/* <MarketTable /> */}
      {/* <RealTimeChart /> */}

      {/* Section 2: Dữ liệu History */}
      <h1 className="text-3xl font-bold mt-6">📊 Dữ liệu History</h1>
      {/* <StackedBarChart /> */}
      <HeatmapChart />
      <TradeBarChart />

    </div>
  );
};

export default Dashboard;
 