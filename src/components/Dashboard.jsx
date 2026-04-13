import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import InvoiceDetail from './InvoiceDetail';
import { FileText, LogOut, CheckCircle, DatabaseBackup, Clock, XCircle, LayoutDashboard } from 'lucide-react';

export default function Dashboard({ session }) {
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [updatedInvoiceId, setUpdatedInvoiceId] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');

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
        <div className="page-header">
          <h1 className="page-title">Recent Invoices</h1>
          <div style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
            Live Sync • Active
          </div>
        </div>

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
