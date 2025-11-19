import { Link, Route, Routes, useLocation } from "react-router-dom";
import Dashboard from "./pages/Dashboard.jsx";
import Incidents from "./pages/Incidents.jsx";
import IncidentDetails from "./pages/IncidentDetails.jsx";
import Projects from "./pages/Projects.jsx";
import { LayoutDashboard, AlertCircle, FolderGit2, User } from "lucide-react";

const App = () => {
  const location = useLocation();

  const navItems = [
    { path: "/", label: "Dashboard", icon: LayoutDashboard },
    { path: "/projects", label: "Projects", icon: FolderGit2 },
    { path: "/incidents", label: "Incidents", icon: AlertCircle },
  ];

  const isActive = (path: string) => {
    if (path === "/") return location.pathname === "/";
    return location.pathname.startsWith(path);
  };

  return (
    <div className="min-h-screen flex bg-gradient-to-br from-slate-50 to-slate-100">
      <aside className="w-72 bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 text-white shadow-2xl flex flex-col">
        <div className="p-6 flex-1">
          <div className="flex items-center gap-3 mb-8">
            <div className="p-2.5 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl shadow-lg">
              <AlertCircle className="w-6 h-6" />
            </div>
            <div>
              <h1 className="font-bold text-xl bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
                AI Incident Copilot
              </h1>
              <p className="text-xs text-slate-400">Intelligent automation</p>
            </div>
          </div>
          <nav className="flex flex-col gap-2">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.path);
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 ${
                    active
                      ? "bg-gradient-to-r from-blue-600 to-purple-600 shadow-lg scale-105"
                      : "hover:bg-slate-700/50 hover:translate-x-1"
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  <span className="font-medium">{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>
        
        <div className="p-6 border-t border-slate-700/50">
          <div className="flex items-center gap-3 p-3 rounded-lg bg-slate-800/50 hover:bg-slate-700/50 transition-colors cursor-pointer">
            <div className="p-2 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-full">
              <User className="w-4 h-4" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">Developer</p>
              <p className="text-xs text-slate-400">System User</p>
            </div>
          </div>
          <div className="mt-4 text-center">
            <p className="text-xs text-slate-500">v1.0.0 • Powered by AI</p>
          </div>
        </div>
      </aside>

      <main className="flex-1 p-8 overflow-auto">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/projects" element={<Projects />} />
          <Route path="/incidents" element={<Incidents />} />
          <Route path="/incidents/:id" element={<IncidentDetails />} />
        </Routes>
      </main>
    </div>
  );
};

export default App;
