import { X } from 'lucide-react';

export default function InvoiceDetail({ invoice, onClose }) {
  if (!invoice) return null;

  const data = invoice.invoice_data?.[0]; // Usually an array if joined
  const lineItems = invoice.invoice_line_items || [];

  const formatCurrency = (val, currency) => {
    if (val === null || val === undefined) return '-';
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: currency || 'USD' }).format(val);
  };
  
  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 600 }}>Invoice {data?.invoice_id || invoice.filename}</h2>
            <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
              Status: <span className={`status-badge status-${invoice.status}`}>{invoice.status}</span>
            </p>
          </div>
          <button className="modal-close" onClick={onClose}><X size={24} /></button>
        </div>

        <div className="modal-body">
          {invoice.status === 'processing' ? (
            <div className="empty-state">
              <div className="loading-spinner" style={{ marginBottom: '1rem' }}><X size={40} style={{ opacity: 0 }} /></div>
              <h2>Processing Invoice</h2>
              <p>Azure and Mindee are currently running OCR on this document...</p>
            </div>
          ) : !data ? (
            <div className="empty-state">
              <h2>Data Unavailable</h2>
              <p>Extraction failed or the document couldn't be parsed.</p>
            </div>
          ) : (
            <>
              <div className="detail-section">
                <h3>Header Information</h3>
                <div className="detail-grid">
                  <div>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Vendor</p>
                    <p>{data.vendor || '-'}</p>
                  </div>
                  <div>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Customer</p>
                    <p>{data.customer_name || '-'}</p>
                  </div>
                  <div>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Invoice Date</p>
                    <p>{formatDate(data.invoice_date)}</p>
                  </div>
                  <div>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Due Date</p>
                    <p>{formatDate(data.due_date)}</p>
                  </div>
                  <div>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Total Amount</p>
                    <p style={{ fontSize: '1.25rem', fontWeight: 600, color: 'var(--accent)' }}>
                      {formatCurrency(data.total, data.currency)}
                    </p>
                  </div>
                </div>
              </div>

              <div className="detail-section">
                <h3>Line Items ({lineItems.length})</h3>
                {lineItems.length === 0 ? (
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>No line items extracted.</p>
                ) : (
                  <div style={{ overflowX: 'auto' }}>
                    <table className="line-item-table">
                      <thead>
                        <tr>
                          <th>Description</th>
                          <th>Qty</th>
                          <th>Price</th>
                          <th>Amount</th>
                        </tr>
                      </thead>
                      <tbody>
                        {lineItems.map((item) => (
                          <tr key={item.id}>
                            <td>{item.description || item.product_code || '-'}</td>
                            <td>{item.quantity || '-'} {item.unit || ''}</td>
                            <td>{formatCurrency(item.unit_price, data.currency)}</td>
                            <td>{formatCurrency(item.amount, data.currency)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
