import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ChefHat, ArrowLeft, Lock, Mail, AlertCircle } from 'lucide-react';
import { motion } from 'motion/react';

const Login: React.FC = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);
  const { login }    = useAuth();
  const navigate     = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const domain = username.split('@')[1]?.toLowerCase();
    const typoDomains = ['gma.com', 'gmil.com', 'gmail.co', 'yaho.com', 'yahoo.co', 'outloo.com', 'hotmai.com', 'gamil.com'];
    if (domain && typoDomains.includes(domain)) {
      setError(`Invalid email domain format. Did you mean @${domain.replace('gma.com', 'gmail.com').replace('gmil.com', 'gmail.com').replace('gmail.co', 'gmail.com').replace('gamil.com', 'gmail.com')}?`);
      return;
    }

    setLoading(true);
    try {
      await login(username, password);
      navigate('/dashboard');
    } catch (err: any) {
      setError(err.message || 'Invalid credentials');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col md:flex-row">
      {/* Left Panel */}
      <div className="hidden md:block md:w-1/2 relative bg-ink overflow-hidden">
        <img
          src="https://images.unsplash.com/photo-1596797038530-2c39df80bdd9?auto=format&fit=crop&q=80&w=1000"
          alt="Cooking"
          className="w-full h-full object-cover opacity-40 scale-110 hover:scale-100 transition-transform duration-[10s]"
          referrerPolicy="no-referrer"
        />
        <div className="absolute inset-0 flex flex-col justify-end p-16 bg-gradient-to-t from-ink via-transparent to-transparent">
          <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.3 }}>
            <h2 className="text-6xl font-serif font-bold text-paper mb-6">
              Master the spice,<br />control the health.
            </h2>
            <p className="text-paper/60 text-xl max-w-md">
              Join thousands of home chefs using ML to transform their kitchens.
            </p>
          </motion.div>
        </div>
      </div>

      {/* Right Panel */}
      <div className="flex-1 bg-paper flex flex-col p-8 md:p-16">
        <div className="mb-12">
          <Link to="/" className="inline-flex items-center gap-2 text-ink/40 hover:text-spice transition-colors group">
            <ArrowLeft size={18} className="group-hover:-translate-x-1 transition-transform" />
            <span className="text-sm font-bold uppercase tracking-widest">Back to home</span>
          </Link>
        </div>

        <div className="max-w-md w-full mx-auto flex-1 flex flex-col justify-center">
          <div className="mb-12">
            <div className="w-16 h-16 bg-spice text-paper rounded-2xl flex items-center justify-center mb-6">
              <ChefHat size={32} />
            </div>
            <h1 className="text-5xl font-serif font-bold mb-4">Welcome Back</h1>
            <p className="text-ink/60">Sign in to your SmartChef account to continue your culinary journey.</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
                className="p-4 bg-spice/10 border border-spice/20 rounded-xl flex items-center gap-3 text-spice text-sm font-medium"
              >
                <AlertCircle size={18} /> {error}
              </motion.div>
            )}

            <div className="space-y-2">
              <label className="text-[10px] uppercase tracking-[0.2em] font-bold text-ink/40 ml-1">Email Address</label>
              <div className="relative">
                <input
                  type="email" required
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  className="w-full bg-white border border-ink/5 rounded-2xl py-4 pl-12 pr-4 focus:outline-none focus:border-spice transition-colors shadow-sm"
                  placeholder="you@example.com"
                  pattern="[a-z0-9._%+\-]+@[a-z0-9.\-]+\.[a-z]{2,}$"
                  title="Please enter a valid email address."
                />
                <Mail size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-ink/20" />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] uppercase tracking-[0.2em] font-bold text-ink/40 ml-1">Password</label>
              <div className="relative">
                <input
                  type="password" required minLength={6}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="w-full bg-white border border-ink/5 rounded-2xl py-4 pl-12 pr-4 focus:outline-none focus:border-spice transition-colors shadow-sm"
                  placeholder="••••••••"
                  title="Password must be at least 6 characters long."
                />
                <Lock size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-ink/20" />
              </div>
            </div>

            <button
              type="submit" disabled={loading}
              className="w-full bg-ink text-paper py-5 rounded-2xl font-bold text-lg hover:bg-spice transition-all active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-3"
            >
              {loading
                ? <div className="w-6 h-6 border-2 border-paper border-t-transparent rounded-full animate-spin" />
                : 'Sign In'
              }
            </button>
          </form>

          <p className="mt-12 text-center text-ink/40 text-sm">
            Don't have an account?{' '}
            <Link to="/register" className="text-spice font-bold hover:underline">Create one here</Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;