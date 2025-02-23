import React, { useState } from "react";
import MarketTable from "../components/MarketTable";
import RealTimeChart from "../components/RealTimeChart";
import TradeBarChart from "../components/TradeBarChart";
import HeatmapChart from "../components/HeatmapChart";
import StackedBarChart from "../components/StackedBarChart";

const Dashboard = () => {
  const [activeTab, setActiveTab] = useState("realtime");

  const NavButton = ({ id, icon, text }) => (
    <button
      onClick={() => setActiveTab(id)}
      className={`flex items-center space-x-3 px-4 py-2 w-full text-left rounded-lg transition-colors
        ${activeTab === id ? "bg-blue-500 text-white" : "hover:bg-blue-100 text-gray-700"}`}
    >
      <span className="text-lg">{icon}</span>
      <span className="text-base">{text}</span>
    </button>
  );

  return (
    <div className="min-h-screen flex bg-gray-50">
      {/* Sidebar */}
      <aside className="w-64 bg-white shadow-md p-6">
        <h2 className="text-xl font-bold mb-6">Dashboard</h2>
        <nav className="space-y-4">
          <NavButton id="realtime" icon="📡" text="Dữ liệu Realtime" />
          <NavButton id="history" icon="📊" text="Dữ liệu History" />
          {/* Thêm các chức năng khác nếu cần */}
        </nav>
      </aside>

      {/* Main Content */}
      <main className="flex-grow p-6">
        {activeTab === "realtime" && (
          <div className="space-y-8">
            <h1 className="text-3xl font-bold mb-4">📡 Dữ liệu Realtime</h1>
            <div className="bg-white rounded-lg shadow p-6">
              <MarketTable />
            </div>
            <div className="bg-white rounded-lg shadow p-6">
              <RealTimeChart />
            </div>
          </div>
        )}

        {activeTab === "history" && (
          <div className="space-y-8">
            <h1 className="text-3xl font-bold mb-4">📊 Dữ liệu History</h1>
            <div className="bg-white rounded-lg shadow p-6">
              <StackedBarChart />
            </div>
            <div className="bg-white rounded-lg shadow p-6">
              <HeatmapChart />
            </div>
            <div className="bg-white rounded-lg shadow p-6">
              <TradeBarChart />
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default Dashboard;
