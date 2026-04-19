import { useEffect, useState, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import InvoiceDetail from './InvoiceDetail';
import IntelligenceTab from './IntelligenceTab';
import { runFullAnalysis } from '../analytics/engine';
import {
  FileText, LogOut, CheckCircle, DatabaseBackup, Clock,
  XCircle, LayoutDashboard, Zap, AlertTriangle, TrendingUp, Users
} from 'lucide-react';

export default function Dashboard({ session }) {
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [updatedInvoiceId, setUpdatedInvoiceId] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');

  // Run analytics whenever invoices change
  const analysis = useMemo(() => runFullAnalysis(invoices), [invoices]);
  const alertCount = analysis.actions.filter(a => a.severity === 'critical' || a.severity === 'warning').length;

  const fetchInvoices = async () => {
    try {
      const { data, error } = await supabase
        .from('invoices')
        .select(`
          *,
          invoice_data (*),
          invoice_line_items (*)
        `)
        .order('uploaded_at', { ascending: false });

      if (error) throw error;
      setInvoices(data || []);
    } catch (error) {
      console.error('Error fetching invoices:', error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInvoices();

    // Set up Realtime subscription on the 'invoices' table
    const channel = supabase
      .channel('public:invoices')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'invoices' }, (payload) => {
        // Flash animation for the updated item
        setUpdatedInvoiceId(payload.new.id);
        setTimeout(() => setUpdatedInvoiceId(null), 2000);
        
        // Re-fetch everything to ensure we grab joined tabular data (invoice_data/line_items) securely
        fetchInvoices(); 
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'invoices' }, () => {
        fetchInvoices();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const handleSignOut = () => {
    supabase.auth.signOut();
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'complete': return <CheckCircle size={16} strokeWidth={2.5} />;
      case 'failed': return <XCircle size={16} strokeWidth={2.5} />;
      default: return <Clock size={16} strokeWidth={2.5} />;
    }
  };

  // Summary stats for overview
  const completedInvoices = invoices.filter(i => i.status === 'complete');
  const thisMonthKey = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
  const thisMonthSpend = completedInvoices.reduce((sum, inv) => {
    const d = inv.invoice_data?.[0];
    if (!d) return sum;
    const dateStr = d.invoice_date || inv.uploaded_at;
    const invMonth = dateStr ? `${new Date(dateStr).getFullYear()}-${String(new Date(dateStr).getMonth() + 1).padStart(2, '0')}` : '';
    return invMonth === thisMonthKey ? sum + parseFloat(d.total || 0) : sum;
  }, 0);
  const primaryCurrency = completedInvoices.find(i => i.invoice_data?.[0]?.currency)?.invoice_data?.[0]?.currency || 'USD';

  const fmtCurrency = (val) => new Intl.NumberFormat('en-US', {
    style: 'currency', currency: primaryCurrency,
    minimumFractionDigits: 0, maximumFractionDigits: 0,
  }).format(val);

  return (
    <div className="dashboard-layout">
      {/* Sidebar */}
      <div className="sidebar">
        <div className="logo">
          <DatabaseBackup size={28} color="#60a5fa" />
          InvoiceAI
        </div>
        
        <div className="nav-menu">
          <div 
            className={`nav-item ${activeTab === 'overview' ? 'active' : ''}`}
            onClick={() => setActiveTab('overview')}
            style={{ cursor: 'pointer' }}
          >
            <LayoutDashboard size={20} />
            Overview
          </div>
          <div 
            className={`nav-item ${activeTab === 'intelligence' ? 'active' : ''}`}
            onClick={() => setActiveTab('intelligence')}
            style={{ cursor: 'pointer' }}
          >
            <Zap size={20} />
            Intelligence
            {alertCount > 0 && (
              <span className="nav-badge">{alertCount}</span>
            )}
          </div>
          <div 
            className={`nav-item ${activeTab === 'processing' ? 'active' : ''}`}
            onClick={() => setActiveTab('processing')}
            style={{ cursor: 'pointer' }}
          >
            <FileText size={20} />
            Processing
          </div>
        </div>

        <div className="user-profile">
          <div style={{ padding: '0.5rem', background: 'rgba(59,130,246,0.2)', borderRadius: '50%', color: '#60a5fa' }}>
            <FileText size={20} />
          </div>
          <div className="user-info">
            <p>{session?.user?.email}</p>
            <button onClick={handleSignOut} style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
              <LogOut size={12} /> Sign Out
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="main-content">

        {/* ── Intelligence Tab ─────────────────── */}
        {activeTab === 'intelligence' && (
          <>
            <div className="page-header">
              <h1 className="page-title">Intelligence</h1>
              <div style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
                {analysis.meta.totalInvoices} invoices analyzed
              </div>
            </div>
            <IntelligenceTab invoices={invoices} />
          </>
        )}

        {/* ── Overview / Processing Tabs ────── */}
        {(activeTab === 'overview' || activeTab === 'processing') && (
          <>
            <div className="page-header">
              <h1 className="page-title">
                {activeTab === 'processing' ? 'Processing' : 'Recent Invoices'}
              </h1>
              <div style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
                Live Sync • Active
              </div>
            </div>

            {/* Summary Cards (Overview only) */}
            {activeTab === 'overview' && !loading && (
              <div className="overview-stats-row">
                <div className="overview-stat-card">
                  <div className="overview-stat-icon" style={{ background: 'rgba(59,130,246,0.15)' }}>
                    <TrendingUp size={20} color="#60a5fa" />
                  </div>
                  <div>
                    <div className="overview-stat-value">{fmtCurrency(thisMonthSpend)}</div>
                    <div className="overview-stat-label">This Month</div>
                  </div>
                </div>
                <div className="overview-stat-card">
                  <div className="overview-stat-icon" style={{ background: 'rgba(16,185,129,0.15)' }}>
                    <Users size={20} color="#34d399" />
                  </div>
                  <div>
                    <div className="overview-stat-value">{analysis.vendors.vendorCount}</div>
                    <div className="overview-stat-label">Active Vendors</div>
                  </div>
                </div>
                <div className="overview-stat-card" 
                  onClick={() => alertCount > 0 && setActiveTab('intelligence')}
                  style={{ cursor: alertCount > 0 ? 'pointer' : 'default' }}
                >
                  <div className="overview-stat-icon" style={{ 
                    background: alertCount > 0 ? 'rgba(239,68,68,0.15)' : 'rgba(255,255,255,0.05)' 
                  }}>
                    <AlertTriangle size={20} color={alertCount > 0 ? '#f87171' : '#64748b'} />
                  </div>
                  <div>
                    <div className="overview-stat-value" style={{ color: alertCount > 0 ? '#f87171' : undefined }}>
                      {alertCount}
                    </div>
                    <div className="overview-stat-label">
                      {alertCount > 0 ? 'Alerts → View' : 'No Alerts'}
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className="invoices-container">
              {loading ? (
                <div className="empty-state">
                  <Clock className="loading-spinner" size={32} />
                  <h3 style={{ marginTop: '1rem' }}>Loading invoices...</h3>
                </div>
              ) : (() => {
                const displayInvoices = activeTab === 'processing' 
                  ? invoices.filter(inv => inv.status === 'processing') 
                  : invoices;

                if (displayInvoices.length === 0) {
                  return (
                    <div className="empty-state">
                      <FileText size={48} />
                      <h3 style={{ fontSize: '1.25rem', marginTop: '1rem', color: 'var(--text-primary)' }}>No invoices found</h3>
                      <p>
                        {activeTab === 'processing' 
                          ? 'There are no invoices currently processing.' 
                          : 'Upload invoices via the Google Sheets add-on to see them here.'}
                      </p>
                    </div>
                  );
                }

                return displayInvoices.map((inv) => {
                  const data = inv.invoice_data?.[0];
                  const isUpdated = inv.id === updatedInvoiceId;

                  return (
                    <div 
                      key={inv.id} 
                      className={`invoice-card ${isUpdated ? 'pulse-update' : ''}`}
                      onClick={() => setSelectedInvoice(inv)}
                    >
                      <div>
                        <span className={`status-badge status-${inv.status}`}>
                          <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                            {getStatusIcon(inv.status)} {inv.status}
                          </span>
                        </span>
                      </div>
                      
                      <div className="invoice-metric" style={{ display: 'flex', flexDirection: 'column' }}>
                        <span className="label">File / Vendor</span>
                        <span className="value" style={{ fontSize: '1.125rem' }}>
                          {data?.vendor || inv.filename}
                        </span>
                      </div>

                      <div className="invoice-metric">
                        <span className="label">Date</span>
                        <span className="value">
                          {new Date(inv.uploaded_at).toLocaleDateString()}
                        </span>
                      </div>

                      <div className="invoice-metric">
                        <span className="label">Total</span>
                        <span className="value" style={{ fontWeight: 600, color: 'var(--accent)' }}>
                          {data?.total 
                            ? new Intl.NumberFormat('en-US', { style: 'currency', currency: data.currency || 'USD' }).format(data.total) 
                            : '-'}
                        </span>
                      </div>
                    </div>
                  );
                });
              })()}
            </div>
          </>
        )}

      </div>

      {selectedInvoice && (
        <InvoiceDetail 
          invoice={selectedInvoice} 
          onClose={() => setSelectedInvoice(null)} 
        />
      )}
    </div>
  );
}
