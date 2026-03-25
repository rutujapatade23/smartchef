import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { LogOut, ChefHat, Settings } from 'lucide-react';

const Navbar: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  const displayName = user?.name
    ? user.name.split(' ')[0]
    : user?.username ?? 'Chef';

  return (
    <nav className="sticky top-0 z-50 bg-paper/80 backdrop-blur-md border-b border-ink/5 px-6 py-4 flex items-center justify-between">
      <Link to="/" className="flex items-center gap-2 group">
        <div className="bg-spice p-2 rounded-lg text-paper group-hover:rotate-12 transition-transform">
          <ChefHat size={24} />
        </div>
        <span className="font-serif text-2xl font-bold tracking-tight">SmartChef</span>
      </Link>

      {user && (
        <div className="flex items-center gap-4">
          <div className="text-right hidden sm:block">
            <p className="text-xs uppercase tracking-widest text-ink/50 font-semibold">Welcome back</p>
            <p className="font-serif font-bold text-lg leading-none">{displayName}</p>
          </div>
          {/* Edit Profile button */}
          <Link to="/profile"
            className="p-2 hover:bg-spice/10 rounded-full text-ink/40 hover:text-spice transition-colors"
            title="Edit Profile"
          >
            <Settings size={20} />
          </Link>
          <button
            onClick={handleLogout}
            className="p-2 hover:bg-spice/10 rounded-full text-spice transition-colors"
            title="Logout"
          >
            <LogOut size={20} />
          </button>
        </div>
      )}
    </nav>
  );
};

export default Navbar;