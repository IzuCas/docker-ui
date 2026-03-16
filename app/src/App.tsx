import { Routes, Route, NavLink, Navigate } from 'react-router-dom';
import {
  Box,
  Layers,
  HardDrive,
  Network,
  Activity,
  Cog,
  FolderOpen,
} from 'lucide-react';
import ContainersPage from './pages/Containers';
import ContainerDetailPage from './pages/ContainerDetail';
import ImagesPage from './pages/Images';
import ImageDetailPage from './pages/ImageDetail';
import VolumesPage from './pages/Volumes';
import NetworksPage from './pages/Networks';
import StacksPage from './pages/Stacks';
import StackDetailPage from './pages/StackDetail';
import SystemPage from './pages/System';
import SettingsPage from './pages/Settings';

function App() {
  return (
    <div className="flex min-h-screen bg-bg-primary">
      <aside className="w-64 bg-bg-secondary border-r border-border flex flex-col fixed h-screen">
        {/* Logo */}
        <div className="flex items-center gap-3 px-4 py-5 border-b border-border">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-accent-purple to-accent-blue flex items-center justify-center">
            <Layers size={22} className="text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-text-primary">Docker</h1>
            <p className="text-xs text-text-secondary">Management UI</p>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-4 px-3 space-y-1 overflow-y-auto">
          <div className="text-xs font-semibold text-text-secondary uppercase tracking-wider px-3 mb-2">
            Resources
          </div>
          <NavLink 
            to="/containers" 
            className={({ isActive }) => 
              `flex items-center gap-3 py-2.5 px-3 rounded-lg text-sm font-medium transition-all duration-200 ${
                isActive 
                  ? 'bg-accent-blue/10 text-accent-blue border-l-2 border-accent-blue' 
                  : 'text-text-secondary hover:bg-bg-tertiary hover:text-text-primary'
              }`
            }
          >
            <Box size={18} />
            Containers
          </NavLink>
          <NavLink 
            to="/stacks" 
            className={({ isActive }) => 
              `flex items-center gap-3 py-2.5 px-3 rounded-lg text-sm font-medium transition-all duration-200 ${
                isActive 
                  ? 'bg-accent-blue/10 text-accent-blue border-l-2 border-accent-blue' 
                  : 'text-text-secondary hover:bg-bg-tertiary hover:text-text-primary'
              }`
            }
          >
            <FolderOpen size={18} />
            Stacks
          </NavLink>
          <NavLink 
            to="/images" 
            className={({ isActive }) => 
              `flex items-center gap-3 py-2.5 px-3 rounded-lg text-sm font-medium transition-all duration-200 ${
                isActive 
                  ? 'bg-accent-blue/10 text-accent-blue border-l-2 border-accent-blue' 
                  : 'text-text-secondary hover:bg-bg-tertiary hover:text-text-primary'
              }`
            }
          >
            <Layers size={18} />
            Images
          </NavLink>
          <NavLink 
            to="/volumes" 
            className={({ isActive }) => 
              `flex items-center gap-3 py-2.5 px-3 rounded-lg text-sm font-medium transition-all duration-200 ${
                isActive 
                  ? 'bg-accent-blue/10 text-accent-blue border-l-2 border-accent-blue' 
                  : 'text-text-secondary hover:bg-bg-tertiary hover:text-text-primary'
              }`
            }
          >
            <HardDrive size={18} />
            Volumes
          </NavLink>
          <NavLink 
            to="/networks" 
            className={({ isActive }) => 
              `flex items-center gap-3 py-2.5 px-3 rounded-lg text-sm font-medium transition-all duration-200 ${
                isActive 
                  ? 'bg-accent-blue/10 text-accent-blue border-l-2 border-accent-blue' 
                  : 'text-text-secondary hover:bg-bg-tertiary hover:text-text-primary'
              }`
            }
          >
            <Network size={18} />
            Networks
          </NavLink>

          <div className="text-xs font-semibold text-text-secondary uppercase tracking-wider px-3 mt-6 mb-2">
            System
          </div>
          <NavLink 
            to="/system" 
            className={({ isActive }) => 
              `flex items-center gap-3 py-2.5 px-3 rounded-lg text-sm font-medium transition-all duration-200 ${
                isActive 
                  ? 'bg-accent-blue/10 text-accent-blue border-l-2 border-accent-blue' 
                  : 'text-text-secondary hover:bg-bg-tertiary hover:text-text-primary'
              }`
            }
          >
            <Activity size={18} />
            Dashboard
          </NavLink>
          <NavLink 
            to="/settings" 
            className={({ isActive }) => 
              `flex items-center gap-3 py-2.5 px-3 rounded-lg text-sm font-medium transition-all duration-200 ${
                isActive 
                  ? 'bg-accent-blue/10 text-accent-blue border-l-2 border-accent-blue' 
                  : 'text-text-secondary hover:bg-bg-tertiary hover:text-text-primary'
              }`
            }
          >
            <Cog size={18} />
            Settings
          </NavLink>
        </nav>

        {/* Footer */}
        <div className="p-4 border-t border-border">
          <div className="text-xs text-text-secondary text-center">
            Docker Management v1.0
          </div>
        </div>
      </aside>

      <main className="flex-1 ml-64 p-6 bg-bg-primary">
        <Routes>
          <Route path="/" element={<Navigate to="/containers" replace />} />
          <Route path="/containers" element={<ContainersPage />} />
          <Route path="/containers/:id" element={<ContainerDetailPage />} />
          <Route path="/stacks" element={<StacksPage />} />
          <Route path="/stacks/:name" element={<StackDetailPage />} />
          <Route path="/images" element={<ImagesPage />} />
          <Route path="/images/:id" element={<ImageDetailPage />} />
          <Route path="/volumes" element={<VolumesPage />} />
          <Route path="/networks" element={<NetworksPage />} />
          <Route path="/system" element={<SystemPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Routes>
      </main>
    </div>
  );
}

export default App;
