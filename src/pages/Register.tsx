import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ChefHat, ArrowLeft, User, Lock, Mail, AlertCircle, Ruler, Weight } from 'lucide-react';
import { motion } from 'motion/react';

const Register: React.FC = () => {
  const [formData, setFormData] = useState({
    name: '', username: '', password: '',
    age: '' as any, height: '' as any, weight: '' as any,
    goal: 'maintenance' as 'weight-loss' | 'weight-gain' | 'muscle-gain' | 'maintenance'
  });
  const [error, setError]     = useState('');
  const [loading, setLoading] = useState(false);
  const { register }          = useAuth();
  const navigate              = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!formData.height || !formData.weight || !formData.age) {
      setError('Please fill in all fields'); return;
    }
    setLoading(true);
    try {
      await register(formData);
      navigate('/dashboard');
    } catch (err: any) {
      setError(err.message || 'Registration failed');
    } finally { setLoading(false); }
  };

  const inputClass = "w-full bg-white border border-ink/5 rounded-2xl py-4 pl-12 pr-4 focus:outline-none focus:border-spice transition-colors shadow-sm";

  return (
    <div className="min-h-screen flex flex-col md:flex-row">
      <div className="hidden md:block md:w-1/3 relative bg-ink overflow-hidden">
        <img src="https://images.unsplash.com/photo-1505253716362-afaea1d3d1af?auto=format&fit=crop&q=80&w=1000"
          alt="Fresh Ingredients" className="w-full h-full object-cover opacity-40" referrerPolicy="no-referrer" />
        <div className="absolute inset-0 flex flex-col justify-end p-12 bg-gradient-to-t from-ink via-transparent to-transparent">
          <h2 className="text-5xl font-serif font-bold text-paper mb-4">Your health,<br />your heritage.</h2>
          <p className="text-paper/60 text-lg">Personalised Indian cooking for a better you.</p>
        </div>
      </div>

      <div className="flex-1 bg-paper flex flex-col p-8 md:p-12 overflow-y-auto">
        <div className="mb-8">
          <Link to="/" className="inline-flex items-center gap-2 text-ink/40 hover:text-spice transition-colors group">
            <ArrowLeft size={18} className="group-hover:-translate-x-1 transition-transform" />
            <span className="text-sm font-bold uppercase tracking-widest">Back to home</span>
          </Link>
        </div>

        <div className="max-w-xl w-full mx-auto">
          <div className="mb-10">
            <div className="w-12 h-12 bg-spice text-paper rounded-xl flex items-center justify-center mb-4">
              <ChefHat size={24} />
            </div>
            <h1 className="text-4xl font-serif font-bold mb-2">Create Account</h1>
            <p className="text-ink/60">Tell us about yourself to personalise your experience.</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
                className="p-4 bg-spice/10 border border-spice/20 rounded-xl flex items-center gap-3 text-spice text-sm font-medium"
              >
                <AlertCircle size={18} /> {error}
              </motion.div>
            )}

            <div className="space-y-2">
              <label className="text-[10px] uppercase tracking-[0.2em] font-bold text-ink/40 ml-1">Full Name</label>
              <div className="relative">
                <input type="text" required value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  className={inputClass} placeholder="Your full name"
                  minLength={2} maxLength={50}
                  pattern="^[a-zA-Z\s]+$" title="Name should only contain letters and spaces." />
                <User size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-ink/20" />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] uppercase tracking-[0.2em] font-bold text-ink/40 ml-1">Email Address</label>
              <div className="relative">
                <input type="email" required value={formData.username}
                  onChange={e => setFormData({ ...formData, username: e.target.value })}
                  className={inputClass} placeholder="you@example.com"
                  pattern="[a-z0-9._%+\-]+@[a-z0-9.\-]+\.[a-z]{2,}$"
                  title="Please enter a valid email address." />
                <Mail size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-ink/20" />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] uppercase tracking-[0.2em] font-bold text-ink/40 ml-1">Password</label>
              <div className="relative">
                <input type="password" required minLength={6} value={formData.password}
                  onChange={e => setFormData({ ...formData, password: e.target.value })}
                  className={inputClass} placeholder="Min. 6 characters" />
                <Lock size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-ink/20" />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <label className="text-[10px] uppercase tracking-[0.2em] font-bold text-ink/40 ml-1">Age</label>
                <div className="relative">
                  <input type="number" required min={10} max={100} value={formData.age}
                    onChange={e => setFormData({ ...formData, age: e.target.value })}
                    className={inputClass} placeholder="e.g. 21" />
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-ink/20 text-sm font-bold">🎂</span>
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] uppercase tracking-[0.2em] font-bold text-ink/40 ml-1">Height (cm)</label>
                <div className="relative">
                  <input type="number" required min={100} max={250} value={formData.height}
                    onChange={e => setFormData({ ...formData, height: e.target.value })}
                    className={inputClass} placeholder="e.g. 165" />
                  <Ruler size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-ink/20" />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] uppercase tracking-[0.2em] font-bold text-ink/40 ml-1">Weight (kg)</label>
                <div className="relative">
                  <input type="number" required min={30} max={300} value={formData.weight}
                    onChange={e => setFormData({ ...formData, weight: e.target.value })}
                    className={inputClass} placeholder="e.g. 60" />
                  <Weight size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-ink/20" />
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <label className="text-[10px] uppercase tracking-[0.2em] font-bold text-ink/40 ml-1">Fitness Goal</label>
              <div className="grid grid-cols-2 gap-3">
                {([
                  { value: 'weight-loss', label: 'Weight Loss' },
                  { value: 'weight-gain', label: 'Weight Gain' },
                  { value: 'muscle-gain', label: 'Muscle Gain' },
                  { value: 'maintenance', label: 'Maintenance' },
                ] as const).map(g => (
                  <button key={g.value} type="button"
                    onClick={() => setFormData({ ...formData, goal: g.value })}
                    className={`py-3 px-4 rounded-2xl border text-xs font-bold uppercase tracking-widest transition-all ${
                      formData.goal === g.value
                        ? 'bg-spice border-spice text-paper shadow-lg shadow-spice/20'
                        : 'bg-white border-ink/5 text-ink/40 hover:border-spice/30'
                    }`}
                  >{g.label}</button>
                ))}
              </div>
            </div>

            <button type="submit" disabled={loading}
              className="w-full bg-ink text-paper py-5 rounded-2xl font-bold text-lg hover:bg-spice transition-all active:scale-[0.98] disabled:opacity-50 flex items-center justify-center"
            >
              {loading
                ? <div className="w-6 h-6 border-2 border-paper border-t-transparent rounded-full animate-spin" />
                : 'Create Account'
              }
            </button>
          </form>

          <p className="mt-8 text-center text-ink/40 text-sm pb-12">
            Already have an account?{' '}
            <Link to="/login" className="text-spice font-bold hover:underline">Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Register;