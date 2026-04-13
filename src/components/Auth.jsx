import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { Mail, Lock, Loader2 } from 'lucide-react';

export default function Auth() {
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLogin, setIsLogin] = useState(true);
  const [errorMsg, setErrorMsg] = useState(null);

  const handleAuth = async (e) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg(null);

    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signUp({ 
          email, 
          password,
          // Optional: Email confirmations are usually ON by default in Supabase.
          // If you test locally and want immediate login without email confirm:
          // options: { emailRedirectTo: window.location.origin }
        });
        if (error) throw error;
        if (!isLogin) {
          setErrorMsg('Check your email for the confirmation link!');
        }
      }
    } catch (error) {
      setErrorMsg(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="glass-card">
        <div className="auth-header">
          <h1>InvoiceAI</h1>
          <p>Sign in to view your dashboard</p>
        </div>
        
        <form onSubmit={handleAuth} className="auth-form">
          <div className="input-group">
            <label>Email Address</label>
            <div style={{ position: 'relative' }}>
              <Mail style={{ position: 'absolute', left: '1rem', top: '0.875rem', color: '#94a3b8' }} size={20} />
              <input 
                type="email" 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="glass-input" 
                style={{ width: '100%', paddingLeft: '3rem' }}
                placeholder="you@company.com"
                required
              />
            </div>
          </div>

          <div className="input-group">
            <label>Password</label>
            <div style={{ position: 'relative' }}>
              <Lock style={{ position: 'absolute', left: '1rem', top: '0.875rem', color: '#94a3b8' }} size={20} />
              <input 
                type="password" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="glass-input" 
                style={{ width: '100%', paddingLeft: '3rem' }}
                placeholder="••••••••"
                required
              />
            </div>
          </div>

          {errorMsg && <div className="error-msg">{errorMsg}</div>}

          <button type="submit" className="primary-btn" disabled={loading}>
            {loading && <Loader2 className="loading-spinner" size={18} />}
            {isLogin ? 'Sign In' : 'Create Account'}
          </button>

          <div className="switch-auth-mode">
            {isLogin ? "Don't have an account?" : "Already have an account?"}
            <button type="button" onClick={() => { setIsLogin(!isLogin); setErrorMsg(null); }}>
              {isLogin ? 'Sign up' : 'Sign in'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
