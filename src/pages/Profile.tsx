import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { User, Lock, Ruler, Weight, Target, Save, ArrowLeft, AlertCircle, CheckCircle } from 'lucide-react';
import client from '../api/client';
import { motion } from 'motion/react';

const Profile: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate         = useNavigate();
  const [loading, setLoading]   = useState(false);
  const [success, setSuccess]   = useState('');
  const [error, setError]       = useState('');
  const [activeTab, setActiveTab] = useState<'profile' | 'password'>('profile');

  const [profileData, setProfileData] = useState({
    name:   user?.name   || '',
    height: user?.height || '',
    weight: user?.weight || '',
    goal:   user?.goal   || 'maintenance',
  });

  const [passwordData, setPasswordData] = useState({
    current_password: '',
    new_password:     '',
    confirm_password: '',
  });

  const handleProfileSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); setError(''); setSuccess('');
    try {
      const res = await client.put('/api/profile', profileData);
      if (res.data.success) {
        setSuccess('Profile updated successfully!');
        // Update localStorage
        const saved = JSON.parse(localStorage.getItem('smartchef_user') || '{}');
        localStorage.setItem('smartchef_user', JSON.stringify({ ...saved, ...profileData }));
        // Refresh JWT token if returned (goal may have changed)
        if (res.data.token) {
          localStorage.setItem('smartchef_token', res.data.token);
        }
        setTimeout(() => window.location.reload(), 1000);
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to update profile');
    } finally { setLoading(false); }
  };

  const handlePasswordSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (passwordData.new_password !== passwordData.confirm_password) {
      setError('New passwords do not match'); return;
    }
    if (passwordData.new_password.length < 6) {
      setError('Password must be at least 6 characters'); return;
    }
    setLoading(true); setError(''); setSuccess('');
    try {
      const res = await client.put('/api/password', {
        current_password: passwordData.current_password,
        new_password:     passwordData.new_password,
      });
      if (res.data.success) {
        setSuccess('Password updated successfully!');
        setPasswordData({ current_password: '', new_password: '', confirm_password: '' });
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to update password');
    } finally { setLoading(false); }
  };

  const inputClass = "w-full bg-white border border-ink/5 rounded-2xl py-4 pl-12 pr-4 focus:outline-none focus:border-spice transition-colors shadow-sm";

  return (
    <div className="min-h-screen bg-paper">
      <div className="max-w-2xl mx-auto px-6 py-12">
        {/* Header */}
        <div className="flex items-center gap-4 mb-10">
          <button onClick={() => navigate('/dashboard')}
            className="p-2 hover:bg-spice/10 rounded-full text-spice transition-colors"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="font-serif font-bold text-4xl text-ink">Edit Profile</h1>
            <p className="text-ink/50 mt-1">Update your health profile and account settings</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-8 bg-ink/5 p-1 rounded-2xl w-fit">
          {(['profile', 'password'] as const).map(tab => (
            <button key={tab} onClick={() => { setActiveTab(tab); setError(''); setSuccess(''); }}
              className={`px-6 py-2.5 rounded-xl text-sm font-bold uppercase tracking-widest transition-all ${
                activeTab === tab ? 'bg-white text-ink shadow-sm' : 'text-ink/40 hover:text-ink/60'
              }`}
            >
              {tab === 'profile' ? 'Health Profile' : 'Password'}
            </button>
          ))}
        </div>

        {/* Messages */}
        {error && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
            className="mb-6 p-4 bg-spice/10 border border-spice/20 rounded-xl flex items-center gap-3 text-spice text-sm font-medium"
          >
            <AlertCircle size={18} /> {error}
          </motion.div>
        )}
        {success && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
            className="mb-6 p-4 bg-mint/10 border border-mint/20 rounded-xl flex items-center gap-3 text-mint text-sm font-medium"
          >
            <CheckCircle size={18} /> {success}
          </motion.div>
        )}

        {/* Profile Tab */}
        {activeTab === 'profile' && (
          <form onSubmit={handleProfileSave} className="space-y-6 bg-white rounded-3xl p-8 shadow-sm border border-ink/5">
            <div className="space-y-2">
              <label className="text-[10px] uppercase tracking-[0.2em] font-bold text-ink/40 ml-1">Full Name</label>
              <div className="relative">
                <input type="text" required value={profileData.name}
                  onChange={e => setProfileData({ ...profileData, name: e.target.value })}
                  className={inputClass} />
                <User size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-ink/20" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-[10px] uppercase tracking-[0.2em] font-bold text-ink/40 ml-1">Height (cm)</label>
                <div className="relative">
                  <input type="number" required min={100} max={250} value={profileData.height}
                    onChange={e => setProfileData({ ...profileData, height: e.target.value })}
                    className={inputClass} />
                  <Ruler size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-ink/20" />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] uppercase tracking-[0.2em] font-bold text-ink/40 ml-1">Weight (kg)</label>
                <div className="relative">
                  <input type="number" required min={30} max={300} value={profileData.weight}
                    onChange={e => setProfileData({ ...profileData, weight: e.target.value })}
                    className={inputClass} />
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
                    onClick={() => setProfileData({ ...profileData, goal: g.value })}
                    className={`py-3 px-4 rounded-2xl border text-xs font-bold uppercase tracking-widest transition-all ${
                      profileData.goal === g.value
                        ? 'bg-spice border-spice text-paper shadow-lg shadow-spice/20'
                        : 'bg-white border-ink/5 text-ink/40 hover:border-spice/30'
                    }`}
                  >{g.label}</button>
                ))}
              </div>
            </div>

            <button type="submit" disabled={loading}
              className="w-full bg-ink text-paper py-4 rounded-2xl font-bold hover:bg-spice transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {loading
                ? <div className="w-5 h-5 border-2 border-paper border-t-transparent rounded-full animate-spin" />
                : <><Save size={18} /> Save Changes</>
              }
            </button>
          </form>
        )}

        {/* Password Tab */}
        {activeTab === 'password' && (
          <form onSubmit={handlePasswordSave} className="space-y-6 bg-white rounded-3xl p-8 shadow-sm border border-ink/5">
            {[
              { label: 'Current Password', key: 'current_password', placeholder: '••••••••' },
              { label: 'New Password',     key: 'new_password',     placeholder: 'Min. 6 characters' },
              { label: 'Confirm New Password', key: 'confirm_password', placeholder: 'Repeat new password' },
            ].map(field => (
              <div key={field.key} className="space-y-2">
                <label className="text-[10px] uppercase tracking-[0.2em] font-bold text-ink/40 ml-1">{field.label}</label>
                <div className="relative">
                  <input type="password" required value={(passwordData as any)[field.key]}
                    onChange={e => setPasswordData({ ...passwordData, [field.key]: e.target.value })}
                    className={inputClass} placeholder={field.placeholder} />
                  <Lock size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-ink/20" />
                </div>
              </div>
            ))}

            <button type="submit" disabled={loading}
              className="w-full bg-ink text-paper py-4 rounded-2xl font-bold hover:bg-spice transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {loading
                ? <div className="w-5 h-5 border-2 border-paper border-t-transparent rounded-full animate-spin" />
                : <><Save size={18} /> Update Password</>
              }
            </button>
          </form>
        )}
      </div>
    </div>
  );
};

export default Profile;
