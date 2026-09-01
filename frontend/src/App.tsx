import { useEffect } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import Sidebar from "./components/Sidebar";
import { CompanionProvider } from "./components/Companion/CompanionProvider";
import CompanionDock from "./components/Companion/CompanionDock";

export default function App() {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const urlToken = params.get('token');

    if (urlToken && !localStorage.getItem("auth_token")) {
      if (!params.get('redirect')) {
        params.set('redirect', '/');
      }

      console.log('[App Component] Detected token in URL, redirecting to /sso-callback');
      navigate(`/sso-callback?${params.toString()}`, { replace: true });
      return;
    }

    const token = localStorage.getItem("auth_token");
    console.log('[App Component] Authentication check - Token found:', token ? 'YES' : 'NO');
    
    if (!token) {
      console.log('[App Component] No token, redirecting to /login');
      navigate("/login");
    } else {
      console.log('[App Component] Token found, user is authenticated');
      try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        console.log('[App Component] User info:', { email: payload.email, name: payload.name, credits: payload.credits });
      } catch (error) {
        console.log('[App Component] Error decoding token:', (error as Error).message);
      }
    }
  }, [navigate, location.search]);

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
