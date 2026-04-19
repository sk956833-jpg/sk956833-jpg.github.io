// ============================================================
//  InvoiceAI Analytics Engine
//  Pure JS — zero dependencies. All functions take the fetched
//  invoices array (with joined invoice_data + line_items) and
//  return structured insight objects.
// ============================================================

// ── Helpers ──────────────────────────────────────────────────

function getInvoiceData(inv) {
  return inv.invoice_data?.[0] || null;
}

function toNum(val) {
  const n = parseFloat(val);
  return isNaN(n) ? 0 : n;
}

function monthKey(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (isNaN(d)) return null;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function monthLabel(key) {
  if (!key) return '';
  const [y, m] = key.split('-');
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${months[parseInt(m) - 1]} ${y}`;
}

function daysBetween(dateA, dateB) {
  const a = new Date(dateA);
  const b = new Date(dateB);
  if (isNaN(a) || isNaN(b)) return null;
  return Math.round((b - a) / (1000 * 60 * 60 * 24));
}

function pctChange(oldVal, newVal) {
  if (!oldVal || oldVal === 0) return newVal > 0 ? 100 : 0;
  return Math.round(((newVal - oldVal) / Math.abs(oldVal)) * 100);
}

function formatCurrency(val, currency = 'USD') {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency || 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(val);
}


// ── 1. Cost Anomaly Detection ────────────────────────────────
//  Compares each vendor's latest month spend to their
//  historical average. Flags spikes > threshold%.

export function detectCostAnomalies(invoices, threshold = 25) {
  const vendorMonthly = {};

  for (const inv of invoices) {
    const d = getInvoiceData(inv);
    if (!d || !d.vendor || !d.total) continue;
    const mk = monthKey(d.invoice_date || inv.uploaded_at);
    if (!mk) continue;
    const vendor = d.vendor;
    if (!vendorMonthly[vendor]) vendorMonthly[vendor] = {};
    vendorMonthly[vendor][mk] = (vendorMonthly[vendor][mk] || 0) + toNum(d.total);
  }

  const anomalies = [];

  for (const [vendor, months] of Object.entries(vendorMonthly)) {
    const sortedKeys = Object.keys(months).sort();
    if (sortedKeys.length < 2) continue;

    const latestKey = sortedKeys[sortedKeys.length - 1];
    const latestSpend = months[latestKey];

    // Average of all previous months
    const previousKeys = sortedKeys.slice(0, -1);
    const avgPrevious = previousKeys.reduce((s, k) => s + months[k], 0) / previousKeys.length;

    const change = pctChange(avgPrevious, latestSpend);

    if (Math.abs(change) >= threshold) {
      const currency = invoices.find(i =>
        getInvoiceData(i)?.vendor === vendor
      )?.invoice_data?.[0]?.currency || 'USD';

      anomalies.push({
        vendor,
        latestMonth: monthLabel(latestKey),
        latestSpend,
        avgPrevious: Math.round(avgPrevious),
        changePercent: change,
        direction: change > 0 ? 'increase' : 'decrease',
        severity: Math.abs(change) > 50 ? 'critical' : 'warning',
        currency,
        action: change > 0
          ? `Renegotiate contract with ${vendor}`
          : `Review if ${vendor} deliveries have reduced`,
      });
    }
  }

  return anomalies.sort((a, b) => Math.abs(b.changePercent) - Math.abs(a.changePercent));
}


// ── 2. Duplicate / Suspicious Invoice Detection ──────────────
//  Layer 1: Exact invoice_id + vendor match
//  Layer 2: Fuzzy — same vendor, similar amount (±5%), within 7 days

export function detectDuplicates(invoices) {
  const results = { exact: [], suspicious: [] };
  const dataList = [];

  for (const inv of invoices) {
    const d = getInvoiceData(inv);
    if (!d) continue;
    dataList.push({
      uploadId: inv.id,
      filename: inv.filename,
      invoiceId: d.invoice_id,
      vendor: d.vendor,
      total: toNum(d.total),
      date: d.invoice_date || inv.uploaded_at,
      currency: d.currency,
    });
  }

  // Exact duplicates
  const seen = {};
  for (const item of dataList) {
    const key = `${(item.invoiceId || '').toLowerCase()}|${(item.vendor || '').toLowerCase()}`;
    if (!item.invoiceId || !item.vendor) continue;
    if (seen[key]) {
      results.exact.push({
        invoiceId: item.invoiceId,
        vendor: item.vendor,
        files: [seen[key].filename, item.filename],
        total: item.total,
        currency: item.currency,
        severity: 'critical',
        action: 'Block duplicate payment — same invoice submitted twice',
      });
    } else {
      seen[key] = item;
    }
  }

  // Fuzzy / suspicious
  for (let i = 0; i < dataList.length; i++) {
    for (let j = i + 1; j < dataList.length; j++) {
      const a = dataList[i];
      const b = dataList[j];
      if (!a.vendor || !b.vendor) continue;
      if (a.vendor.toLowerCase() !== b.vendor.toLowerCase()) continue;
      if (a.invoiceId === b.invoiceId) continue; // already caught as exact

      const amountDiff = Math.abs(a.total - b.total);
      const amountThreshold = Math.max(a.total, b.total) * 0.05;
      const days = Math.abs(daysBetween(a.date, b.date) || 999);

      if (amountDiff <= amountThreshold && days <= 7 && a.total > 0) {
        results.suspicious.push({
          vendor: a.vendor,
          invoiceA: { id: a.invoiceId, total: a.total, file: a.filename },
          invoiceB: { id: b.invoiceId, total: b.total, file: b.filename },
          amountDiffPercent: a.total > 0 ? Math.round((amountDiff / a.total) * 100) : 0,
          daysBetween: days,
          currency: a.currency,
          severity: 'warning',
          action: 'Review — possible duplicate with slight variations (common fraud trick)',
        });
      }
    }
  }

  return results;
}


// ── 3. Vendor Intelligence ───────────────────────────────────
//  Concentration risk + price trend analysis

export function analyzeVendors(invoices) {
  const vendorTotals = {};
  const vendorMonthly = {};
  const vendorInvoiceCount = {};
  let grandTotal = 0;
  let primaryCurrency = 'USD';

  for (const inv of invoices) {
    const d = getInvoiceData(inv);
    if (!d || !d.vendor) continue;
    const total = toNum(d.total);
    const vendor = d.vendor;
    const mk = monthKey(d.invoice_date || inv.uploaded_at);

    vendorTotals[vendor] = (vendorTotals[vendor] || 0) + total;
    vendorInvoiceCount[vendor] = (vendorInvoiceCount[vendor] || 0) + 1;
    grandTotal += total;

    if (mk) {
      if (!vendorMonthly[vendor]) vendorMonthly[vendor] = {};
      vendorMonthly[vendor][mk] = (vendorMonthly[vendor][mk] || 0) + total;
    }

    if (d.currency) primaryCurrency = d.currency;
  }

  // Concentration analysis
  const vendorShare = Object.entries(vendorTotals)
    .map(([vendor, total]) => ({
      vendor,
      total,
      share: grandTotal > 0 ? Math.round((total / grandTotal) * 100) : 0,
      invoiceCount: vendorInvoiceCount[vendor] || 0,
    }))
    .sort((a, b) => b.total - a.total);

  const concentrationRisks = vendorShare
    .filter(v => v.share >= 40)
    .map(v => ({
      vendor: v.vendor,
      share: v.share,
      total: v.total,
      severity: v.share >= 60 ? 'critical' : 'warning',
      action: `Diversify suppliers — ${v.vendor} controls ${v.share}% of your spend`,
    }));

  // Price trend per vendor (last 3 months comparison)
  const priceTrends = [];
  for (const [vendor, months] of Object.entries(vendorMonthly)) {
    const sortedKeys = Object.keys(months).sort();
    if (sortedKeys.length < 2) continue;
    const recent = sortedKeys.slice(-2);
    const change = pctChange(months[recent[0]], months[recent[1]]);
    if (Math.abs(change) >= 10) {
      priceTrends.push({
        vendor,
        previousMonth: monthLabel(recent[0]),
        currentMonth: monthLabel(recent[1]),
        previousSpend: months[recent[0]],
        currentSpend: months[recent[1]],
        changePercent: change,
        direction: change > 0 ? 'increasing' : 'decreasing',
      });
    }
  }

  return {
    vendorShare,
    concentrationRisks,
    priceTrends,
    grandTotal,
    currency: primaryCurrency,
    vendorCount: Object.keys(vendorTotals).length,
  };
}


// ── 4. Payment Optimization ──────────────────────────────────
//  Analyzes gap between invoice_date and due_date

export function analyzePaymentTimeline(invoices) {
  const earlyPayments = [];
  const tightDeadlines = [];
  let totalDaysEarly = 0;
  let earlyCount = 0;
  let currency = 'USD';

  for (const inv of invoices) {
    const d = getInvoiceData(inv);
    if (!d || !d.invoice_date || !d.due_date) continue;

    const paymentWindow = daysBetween(d.invoice_date, d.due_date);
    if (paymentWindow === null) continue;

    if (d.currency) currency = d.currency;

    if (paymentWindow > 30) {
      earlyPayments.push({
        vendor: d.vendor,
        invoiceId: d.invoice_id,
        invoiceDate: d.invoice_date,
        dueDate: d.due_date,
        daysUntilDue: paymentWindow,
        total: toNum(d.total),
        currency: d.currency,
        action: paymentWindow > 45
          ? 'Delay payment to optimize cash flow — you have 45+ days'
          : 'Consider holding payment closer to due date',
      });
      totalDaysEarly += paymentWindow - 30;
      earlyCount++;
    } else if (paymentWindow <= 7 && paymentWindow >= 0) {
      tightDeadlines.push({
        vendor: d.vendor,
        invoiceId: d.invoice_id,
        dueDate: d.due_date,
        daysLeft: paymentWindow,
        total: toNum(d.total),
        currency: d.currency,
        severity: paymentWindow <= 3 ? 'critical' : 'warning',
      });
    }
  }

  const cashFlowOpportunity = earlyPayments.reduce((s, p) => s + p.total, 0);

  return {
    earlyPayments: earlyPayments.sort((a, b) => b.daysUntilDue - a.daysUntilDue),
    tightDeadlines: tightDeadlines.sort((a, b) => a.daysLeft - b.daysLeft),
    avgDaysEarly: earlyCount > 0 ? Math.round(totalDaysEarly / earlyCount) : 0,
    cashFlowOpportunity,
    currency,
  };
}


// ── 5. Spending Trends (Growth / Decline Signals) ────────────
//  Month-over-month total spend + per-vendor trends

export function analyzeSpendingTrends(invoices) {
  const monthlySpend = {};
  const vendorMonthly = {};
  let currency = 'USD';

  for (const inv of invoices) {
    const d = getInvoiceData(inv);
    if (!d) continue;
    const total = toNum(d.total);
    const mk = monthKey(d.invoice_date || inv.uploaded_at);
    if (!mk) continue;
    if (d.currency) currency = d.currency;

    monthlySpend[mk] = (monthlySpend[mk] || 0) + total;

    if (d.vendor) {
      if (!vendorMonthly[d.vendor]) vendorMonthly[d.vendor] = {};
      vendorMonthly[d.vendor][mk] = (vendorMonthly[d.vendor][mk] || 0) + total;
    }
  }

  // Overall trend
  const sortedMonths = Object.keys(monthlySpend).sort();
  const monthlyTrend = sortedMonths.map(mk => ({
    month: monthLabel(mk),
    key: mk,
    total: monthlySpend[mk],
  }));

  // MoM change
  let overallChange = null;
  if (sortedMonths.length >= 2) {
    const prev = monthlySpend[sortedMonths[sortedMonths.length - 2]];
    const curr = monthlySpend[sortedMonths[sortedMonths.length - 1]];
    overallChange = {
      previousMonth: monthLabel(sortedMonths[sortedMonths.length - 2]),
      currentMonth: monthLabel(sortedMonths[sortedMonths.length - 1]),
      previousSpend: prev,
      currentSpend: curr,
      changePercent: pctChange(prev, curr),
    };
  }

  // Category signals (which vendors are driving changes)
  const signals = [];
  for (const [vendor, months] of Object.entries(vendorMonthly)) {
    const keys = Object.keys(months).sort();
    if (keys.length < 2) continue;
    const prev = months[keys[keys.length - 2]];
    const curr = months[keys[keys.length - 1]];
    const change = pctChange(prev, curr);

    if (Math.abs(change) >= 15) {
      let signalType = '';
      if (change > 30) signalType = 'spike';
      else if (change > 0) signalType = 'growth';
      else if (change < -30) signalType = 'drop';
      else signalType = 'decline';

      signals.push({
        vendor,
        changePercent: change,
        direction: change > 0 ? 'up' : 'down',
        signalType,
        previousSpend: prev,
        currentSpend: curr,
        action: change > 30
          ? `${vendor} purchases surging → demand rising or price increase`
          : change < -30
          ? `${vendor} spend dropped sharply → check if deliveries stopped`
          : change > 0
          ? `${vendor} costs trending up → monitor closely`
          : `${vendor} spend declining → potential savings or service gap`,
      });
    }
  }

  return {
    monthlyTrend,
    overallChange,
    signals: signals.sort((a, b) => Math.abs(b.changePercent) - Math.abs(a.changePercent)),
    currency,
  };
}


// ── 6. Generate Actions (Decision Support) ───────────────────
//  Aggregates all insights into a prioritized action list

export function generateActions(invoices) {
  const actions = [];

  // Cost anomalies
  const anomalies = detectCostAnomalies(invoices);
  for (const a of anomalies) {
    actions.push({
      type: 'cost_anomaly',
      severity: a.severity,
      icon: '🚨',
      title: `${a.vendor}: ${a.direction === 'increase' ? '+' : ''}${a.changePercent}% spending change`,
      description: `Spending went from ${formatCurrency(a.avgPrevious, a.currency)}/mo avg to ${formatCurrency(a.latestSpend, a.currency)} in ${a.latestMonth}`,
      action: a.action,
    });
  }

  // Duplicates
  const dupes = detectDuplicates(invoices);
  for (const d of dupes.exact) {
    actions.push({
      type: 'duplicate',
      severity: 'critical',
      icon: '🧾',
      title: `Duplicate invoice #${d.invoiceId} from ${d.vendor}`,
      description: `Same invoice submitted in: ${d.files.join(', ')}`,
      action: d.action,
    });
  }
  for (const d of dupes.suspicious) {
    actions.push({
      type: 'suspicious',
      severity: 'warning',
      icon: '⚠️',
      title: `Suspicious match: ${d.vendor}`,
      description: `${d.invoiceA.id} (${formatCurrency(d.invoiceA.total, d.currency)}) vs ${d.invoiceB.id} (${formatCurrency(d.invoiceB.total, d.currency)}) — ${d.daysBetween} days apart`,
      action: d.action,
    });
  }

  // Vendor concentration
  const vendors = analyzeVendors(invoices);
  for (const r of vendors.concentrationRisks) {
    actions.push({
      type: 'vendor_risk',
      severity: r.severity,
      icon: '📊',
      title: `High vendor concentration: ${r.vendor} (${r.share}%)`,
      description: `${r.vendor} accounts for ${r.share}% of your total spend`,
      action: r.action,
    });
  }

  // Payment optimization
  const payments = analyzePaymentTimeline(invoices);
  if (payments.earlyPayments.length > 0) {
    actions.push({
      type: 'payment',
      severity: 'info',
      icon: '⏳',
      title: `${payments.earlyPayments.length} invoices with extended payment windows`,
      description: `Potential to optimize ${formatCurrency(payments.cashFlowOpportunity, payments.currency)} in cash flow`,
      action: 'Delay non-critical payments to improve working capital',
    });
  }
  for (const t of payments.tightDeadlines) {
    actions.push({
      type: 'payment_urgent',
      severity: t.severity,
      icon: '🔴',
      title: `${t.vendor} invoice due in ${t.daysLeft} days`,
      description: `Invoice #${t.invoiceId} — ${formatCurrency(t.total, t.currency)}`,
      action: 'Prioritize payment to avoid late fees',
    });
  }

  // Sort: critical first, then warning, then info
  const severityOrder = { critical: 0, warning: 1, info: 2 };
  actions.sort((a, b) => (severityOrder[a.severity] ?? 3) - (severityOrder[b.severity] ?? 3));

  return actions;
}


// ── Master Analysis ──────────────────────────────────────────
//  Runs all engines and returns a unified result

export function runFullAnalysis(invoices) {
  const completedInvoices = invoices.filter(
    inv => inv.status === 'complete' && getInvoiceData(inv)
  );

  return {
    anomalies: detectCostAnomalies(completedInvoices),
    duplicates: detectDuplicates(completedInvoices),
    vendors: analyzeVendors(completedInvoices),
    payments: analyzePaymentTimeline(completedInvoices),
    trends: analyzeSpendingTrends(completedInvoices),
    actions: generateActions(completedInvoices),
    meta: {
      totalInvoices: completedInvoices.length,
      analyzedAt: new Date().toISOString(),
    },
  };
}
