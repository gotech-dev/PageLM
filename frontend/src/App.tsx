import { useEffect } from "react";
import { Outlet, useNavigate } from "react-router-dom";
import Sidebar from "./components/Sidebar";
import { CompanionProvider } from "./components/Companion/CompanionProvider";
import CompanionDock from "./components/Companion/CompanionDock";

export default function App() {
  const navigate = useNavigate();

  useEffect(() => {
    const token = localStorage.getItem("auth_token");
    if (!token) {
      navigate("/login");
    }
  }, [navigate]);

  return (
    <CompanionProvider>
      <div className="bg-black text-stone-300 min-h-screen flex flex-col">
        <Sidebar />
        <div className="flex-1 relative">
          <Outlet />
        </div>
      </div>
      <CompanionDock />
    </CompanionProvider>
  );
}
