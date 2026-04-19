import { useMemo, useState } from 'react';
import { runFullAnalysis } from '../analytics/engine';
import {
  AlertTriangle, Shield, TrendingUp, TrendingDown,
  Clock, Users, Zap, ChevronDown, ChevronUp, X,
  AlertCircle, ArrowUpRight, ArrowDownRight
} from 'lucide-react';

export default function IntelligenceTab({ invoices }) {
  const analysis = useMemo(() => runFullAnalysis(invoices), [invoices]);
  const [dismissedAlerts, setDismissedAlerts] = useState([]);
  const [expandedCard, setExpandedCard] = useState(null);

  const dismissAlert = (idx) => {
    setDismissedAlerts(prev => [...prev, idx]);
  };

  const toggleCard = (id) => {
    setExpandedCard(prev => prev === id ? null : id);
  };

  const activeActions = analysis.actions.filter((_, i) => !dismissedAlerts.includes(i));
  const criticalCount = activeActions.filter(a => a.severity === 'critical').length;
  const warningCount = activeActions.filter(a => a.severity === 'warning').length;

  const fmtCurrency = (val, currency = 'USD') => {
    if (!val && val !== 0) return '-';
    return new Intl.NumberFormat('en-US', {
      style: 'currency', currency: currency || 'USD',
      minimumFractionDigits: 0, maximumFractionDigits: 0,
    }).format(val);
  };

  if (analysis.meta.totalInvoices === 0) {
    return (
      <div className="empty-state">
        <Zap size={48} />
        <h3 style={{ fontSize: '1.25rem', marginTop: '1rem', color: 'var(--text-primary)' }}>
          No data to analyze yet
        </h3>
        <p>Upload and process invoices to unlock intelligence insights.</p>
      </div>
    );
  }

  // Find max for bar scaling
  const maxVendorTotal = analysis.vendors.vendorShare.length > 0
    ? analysis.vendors.vendorShare[0].total
    : 1;

  const maxMonthlySpend = analysis.trends.monthlyTrend.length > 0
    ? Math.max(...analysis.trends.monthlyTrend.map(m => m.total))
    : 1;

  return (
    <div className="intelligence-layout">

      {/* ── Alert Banner ─────────────────────────────────── */}
      {activeActions.filter(a => a.severity === 'critical').length > 0 && (
        <div className="alert-banner alert-critical">
          <div className="alert-banner-icon">
            <AlertTriangle size={20} />
          </div>
          <div className="alert-banner-content">
            <strong>{criticalCount} critical alert{criticalCount > 1 ? 's' : ''}</strong>
            <span> — {activeActions.find(a => a.severity === 'critical')?.title}</span>
          </div>
        </div>
      )}

      {/* ── Summary Stats ──────────────────────────────── */}
      <div className="intel-stats-row">
        <div className="intel-stat-card">
          <div className="intel-stat-icon" style={{ background: 'rgba(239, 68, 68, 0.15)', color: '#f87171' }}>
            <AlertTriangle size={20} />
          </div>
          <div>
            <div className="intel-stat-value">{criticalCount}</div>
            <div className="intel-stat-label">Critical Alerts</div>
          </div>
        </div>
        <div className="intel-stat-card">
          <div className="intel-stat-icon" style={{ background: 'rgba(245, 158, 11, 0.15)', color: '#fbbf24' }}>
            <AlertCircle size={20} />
          </div>
          <div>
            <div className="intel-stat-value">{warningCount}</div>
            <div className="intel-stat-label">Warnings</div>
          </div>
        </div>
        <div className="intel-stat-card">
          <div className="intel-stat-icon" style={{ background: 'rgba(59, 130, 246, 0.15)', color: '#60a5fa' }}>
            <Users size={20} />
          </div>
          <div>
            <div className="intel-stat-value">{analysis.vendors.vendorCount}</div>
            <div className="intel-stat-label">Active Vendors</div>
          </div>
        </div>
        <div className="intel-stat-card">
          <div className="intel-stat-icon" style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#34d399' }}>
            <TrendingUp size={20} />
          </div>
          <div>
            <div className="intel-stat-value">{fmtCurrency(analysis.vendors.grandTotal, analysis.vendors.currency)}</div>
            <div className="intel-stat-label">Total Spend</div>
          </div>
        </div>
      </div>

      {/* ── Cards Grid ─────────────────────────────────── */}
      <div className="intel-grid">

        {/* ── 🚨 Cost Anomalies ──────────────────────── */}
        <div className={`intel-card ${expandedCard === 'anomaly' ? 'expanded' : ''}`}>
          <div className="intel-card-header" onClick={() => toggleCard('anomaly')}>
            <div className="intel-card-title">
              <span className="intel-card-emoji">🚨</span>
              Cost Anomalies
              {analysis.anomalies.length > 0 && (
                <span className="intel-badge badge-danger">{analysis.anomalies.length}</span>
              )}
            </div>
            {expandedCard === 'anomaly' ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
          </div>

          <div className="intel-card-body">
            {analysis.anomalies.length === 0 ? (
              <div className="intel-empty">
                <Shield size={24} />
                <span>No cost anomalies detected. Spending is within normal ranges.</span>
              </div>
            ) : (
              analysis.anomalies.slice(0, expandedCard === 'anomaly' ? undefined : 3).map((a, i) => (
                <div key={i} className={`intel-insight-row severity-${a.severity}`}>
                  <div className="intel-insight-main">
                    <div className="intel-insight-vendor">{a.vendor}</div>
                    <div className="intel-insight-detail">
                      {fmtCurrency(a.avgPrevious, a.currency)}/mo avg → {fmtCurrency(a.latestSpend, a.currency)} in {a.latestMonth}
                    </div>
                  </div>
                  <div className={`intel-change-badge ${a.direction === 'increase' ? 'change-up' : 'change-down'}`}>
                    {a.direction === 'increase' ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
                    {a.changePercent > 0 ? '+' : ''}{a.changePercent}%
                  </div>
                </div>
              ))
            )}
          </div>

          {analysis.anomalies.length > 0 && (
            <div className="intel-card-action">
              <Zap size={14} />
              {analysis.anomalies[0].action}
            </div>
          )}
        </div>

        {/* ── 🧾 Duplicate / Suspicious ──────────────── */}
        <div className={`intel-card ${expandedCard === 'dupes' ? 'expanded' : ''}`}>
          <div className="intel-card-header" onClick={() => toggleCard('dupes')}>
            <div className="intel-card-title">
              <span className="intel-card-emoji">🧾</span>
              Duplicate Detection
              {(analysis.duplicates.exact.length + analysis.duplicates.suspicious.length) > 0 && (
                <span className="intel-badge badge-danger">
                  {analysis.duplicates.exact.length + analysis.duplicates.suspicious.length}
                </span>
              )}
            </div>
            {expandedCard === 'dupes' ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
          </div>

          <div className="intel-card-body">
            {analysis.duplicates.exact.length === 0 && analysis.duplicates.suspicious.length === 0 ? (
              <div className="intel-empty">
                <Shield size={24} />
                <span>No duplicates or suspicious matches found.</span>
              </div>
            ) : (
              <>
                {analysis.duplicates.exact.map((d, i) => (
                  <div key={`exact-${i}`} className="intel-insight-row severity-critical">
                    <div className="intel-insight-main">
                      <div className="intel-insight-vendor">
                        <span className="dupe-tag dupe-exact">EXACT MATCH</span>
                        Invoice #{d.invoiceId}
                      </div>
                      <div className="intel-insight-detail">
                        {d.vendor} — {fmtCurrency(d.total, d.currency)} — Files: {d.files.join(', ')}
                      </div>
                    </div>
                  </div>
                ))}
                {analysis.duplicates.suspicious.slice(0, expandedCard === 'dupes' ? undefined : 3).map((d, i) => (
                  <div key={`sus-${i}`} className="intel-insight-row severity-warning">
                    <div className="intel-insight-main">
                      <div className="intel-insight-vendor">
                        <span className="dupe-tag dupe-suspicious">SUSPICIOUS</span>
                        {d.vendor}
                      </div>
                      <div className="intel-insight-detail">
                        {d.invoiceA.id} ({fmtCurrency(d.invoiceA.total, d.currency)}) vs {d.invoiceB.id} ({fmtCurrency(d.invoiceB.total, d.currency)}) — {d.daysBetween}d apart
                      </div>
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>

          {(analysis.duplicates.exact.length > 0) && (
            <div className="intel-card-action action-critical">
              <AlertTriangle size={14} />
              Block duplicate payments immediately
            </div>
          )}
        </div>

        {/* ── 📊 Vendor Intelligence ─────────────────── */}
        <div className={`intel-card ${expandedCard === 'vendors' ? 'expanded' : ''}`}>
          <div className="intel-card-header" onClick={() => toggleCard('vendors')}>
            <div className="intel-card-title">
              <span className="intel-card-emoji">📊</span>
              Vendor Intelligence
            </div>
            {expandedCard === 'vendors' ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
          </div>

          <div className="intel-card-body">
            {/* Concentration warnings */}
            {analysis.vendors.concentrationRisks.map((r, i) => (
              <div key={`risk-${i}`} className="intel-insight-row severity-warning" style={{ marginBottom: '0.75rem' }}>
                <div className="intel-insight-main">
                  <div className="intel-insight-vendor">⚠️ {r.vendor} — {r.share}% of total spend</div>
                  <div className="intel-insight-detail">{r.action}</div>
                </div>
              </div>
            ))}

            {/* Vendor share bars */}
            <div className="vendor-bars">
              {analysis.vendors.vendorShare.slice(0, expandedCard === 'vendors' ? undefined : 5).map((v, i) => (
                <div key={i} className="vendor-bar-row">
                  <div className="vendor-bar-label">
                    <span className="vendor-bar-name">{v.vendor}</span>
                    <span className="vendor-bar-amount">{fmtCurrency(v.total, analysis.vendors.currency)} ({v.share}%)</span>
                  </div>
                  <div className="vendor-bar-track">
                    <div
                      className="vendor-bar-fill"
                      style={{
                        width: `${Math.max((v.total / maxVendorTotal) * 100, 2)}%`,
                        background: v.share >= 40
                          ? 'linear-gradient(90deg, #ef4444, #f87171)'
                          : v.share >= 20
                          ? 'linear-gradient(90deg, #f59e0b, #fbbf24)'
                          : 'linear-gradient(90deg, #3b82f6, #60a5fa)',
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>

            {/* Price trends */}
            {analysis.vendors.priceTrends.length > 0 && (
              <div style={{ marginTop: '1rem', paddingTop: '0.75rem', borderTop: '1px solid var(--panel-border)' }}>
                <div className="intel-subsection-title">Price Trends</div>
                {analysis.vendors.priceTrends.slice(0, 3).map((t, i) => (
                  <div key={i} className="intel-insight-row" style={{ padding: '0.5rem 0' }}>
                    <div className="intel-insight-main">
                      <div className="intel-insight-vendor">{t.vendor}</div>
                      <div className="intel-insight-detail">{t.previousMonth} → {t.currentMonth}</div>
                    </div>
                    <div className={`intel-change-badge ${t.direction === 'increasing' ? 'change-up' : 'change-down'}`}>
                      {t.direction === 'increasing' ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
                      {t.changePercent > 0 ? '+' : ''}{t.changePercent}%
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── ⏳ Payment Optimization ────────────────── */}
        <div className={`intel-card ${expandedCard === 'payments' ? 'expanded' : ''}`}>
          <div className="intel-card-header" onClick={() => toggleCard('payments')}>
            <div className="intel-card-title">
              <span className="intel-card-emoji">⏳</span>
              Payment Optimization
              {analysis.payments.tightDeadlines.length > 0 && (
                <span className="intel-badge badge-warning">{analysis.payments.tightDeadlines.length}</span>
              )}
            </div>
            {expandedCard === 'payments' ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
          </div>

          <div className="intel-card-body">
            {analysis.payments.earlyPayments.length === 0 && analysis.payments.tightDeadlines.length === 0 ? (
              <div className="intel-empty">
                <Shield size={24} />
                <span>No payment timing insights available. Ensure invoices have due dates.</span>
              </div>
            ) : (
              <>
                {analysis.payments.tightDeadlines.length > 0 && (
                  <div style={{ marginBottom: '0.75rem' }}>
                    <div className="intel-subsection-title" style={{ color: '#f87171' }}>🔴 Urgent Deadlines</div>
                    {analysis.payments.tightDeadlines.map((t, i) => (
                      <div key={i} className={`intel-insight-row severity-${t.severity}`}>
                        <div className="intel-insight-main">
                          <div className="intel-insight-vendor">{t.vendor} — #{t.invoiceId}</div>
                          <div className="intel-insight-detail">Due in {t.daysLeft} day{t.daysLeft !== 1 ? 's' : ''} — {fmtCurrency(t.total, t.currency)}</div>
                        </div>
                        <div className="intel-change-badge change-up" style={{ background: 'rgba(239,68,68,0.15)', color: '#f87171' }}>
                          <Clock size={14} /> {t.daysLeft}d
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {analysis.payments.earlyPayments.length > 0 && (
                  <>
                    <div className="intel-subsection-title">💰 Cash Flow Opportunity</div>
                    <div className="intel-insight-row" style={{ background: 'rgba(16,185,129,0.08)', borderColor: 'rgba(16,185,129,0.2)' }}>
                      <div className="intel-insight-main">
                        <div className="intel-insight-vendor" style={{ color: '#34d399' }}>
                          {fmtCurrency(analysis.payments.cashFlowOpportunity, analysis.payments.currency)} in delayed payments possible
                        </div>
                        <div className="intel-insight-detail">
                          {analysis.payments.earlyPayments.length} invoices with 30+ day windows (avg {analysis.payments.avgDaysEarly} days early)
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </>
            )}
          </div>

          {analysis.payments.earlyPayments.length > 0 && (
            <div className="intel-card-action">
              <Zap size={14} />
              Delay non-critical payments to improve working capital
            </div>
          )}
        </div>

        {/* ── 📈 Spending Trends ─────────────────────── */}
        <div className={`intel-card intel-card-wide ${expandedCard === 'trends' ? 'expanded' : ''}`}>
          <div className="intel-card-header" onClick={() => toggleCard('trends')}>
            <div className="intel-card-title">
              <span className="intel-card-emoji">📈</span>
              Spending Trends
              {analysis.trends.overallChange && (
                <span className={`intel-change-badge ${analysis.trends.overallChange.changePercent >= 0 ? 'change-up' : 'change-down'}`}
                  style={{ marginLeft: '0.5rem' }}>
                  {analysis.trends.overallChange.changePercent >= 0 ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
                  {analysis.trends.overallChange.changePercent > 0 ? '+' : ''}{analysis.trends.overallChange.changePercent}% MoM
                </span>
              )}
            </div>
            {expandedCard === 'trends' ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
          </div>

          <div className="intel-card-body">
            {/* Monthly spend chart (CSS bars) */}
            {analysis.trends.monthlyTrend.length > 0 && (
              <div className="trend-chart">
                {analysis.trends.monthlyTrend.map((m, i) => {
                  const heightPct = maxMonthlySpend > 0 ? (m.total / maxMonthlySpend) * 100 : 0;
                  return (
                    <div key={i} className="trend-bar-col">
                      <div className="trend-bar-value">{fmtCurrency(m.total, analysis.trends.currency)}</div>
                      <div className="trend-bar-track">
                        <div className="trend-bar-fill" style={{ height: `${Math.max(heightPct, 4)}%` }} />
                      </div>
                      <div className="trend-bar-label">{m.month}</div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Growth/decline signals */}
            {analysis.trends.signals.length > 0 && (
              <div style={{ marginTop: '1.5rem' }}>
                <div className="intel-subsection-title">Signals</div>
                {analysis.trends.signals.slice(0, expandedCard === 'trends' ? undefined : 4).map((s, i) => (
                  <div key={i} className="intel-insight-row">
                    <div className="intel-insight-main">
                      <div className="intel-insight-vendor">
                        {s.direction === 'up' ? '📈' : '📉'} {s.vendor}
                      </div>
                      <div className="intel-insight-detail">{s.action}</div>
                    </div>
                    <div className={`intel-change-badge ${s.direction === 'up' ? 'change-up' : 'change-down'}`}>
                      {s.direction === 'up' ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
                      {s.changePercent > 0 ? '+' : ''}{s.changePercent}%
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

      </div>

      {/* ── Action Center ────────────────────────────── */}
      {activeActions.length > 0 && (
        <div className="action-center">
          <h3 className="action-center-title">
            <Zap size={18} />
            Action Center — What should you do?
          </h3>
          <div className="action-list">
            {activeActions.slice(0, 10).map((a, idx) => {
              const originalIdx = analysis.actions.indexOf(a);
              return (
                <div key={originalIdx} className={`action-item action-${a.severity}`}>
                  <div className="action-item-icon">{a.icon}</div>
                  <div className="action-item-content">
                    <div className="action-item-title">{a.title}</div>
                    <div className="action-item-desc">{a.description}</div>
                    <div className="action-item-recommendation">
                      <Zap size={12} /> {a.action}
                    </div>
                  </div>
                  <button
                    className="action-dismiss"
                    onClick={() => dismissAlert(originalIdx)}
                    title="Dismiss"
                  >
                    <X size={16} />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
