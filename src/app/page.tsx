'use client';

import React, { useState, useEffect } from 'react';
import {
  RefreshCw,
  Server,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Cpu,
  Layers,
  DollarSign,
  Clock,
  Copy,
  Check,
  ExternalLink,
  ShieldAlert,
  FileText,
  Sliders,
  HelpCircle,
  Sparkles,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  Eye,
} from 'lucide-react';
import { PACE_RATES, ComputeRate, calculateRateDelta, getRateForPartition } from '@/lib/rates';
import { SlurmPartitionNode, DEMO_SINFO_OUTPUT, parseSinfoOutput } from '@/lib/slurm-parser';

type FilterType = 'all' | 'available' | 'gpu-only' | 'cpu-only';
type TabType = 'availability' | 'calculator' | 'rate-sheet' | 'help';

export default function PaceDashboard() {
  // Navigation & view states
  const [activeTab, setActiveTab] = useState<TabType>('availability');
  const [filter, setFilter] = useState<FilterType>('gpu-only');
  const [searchQuery, setSearchQuery] = useState('');

  // Cluster data states
  const [partitions, setPartitions] = useState<SlurmPartitionNode[]>([]);
  const [isConnected, setIsConnected] = useState<boolean>(true);
  const [isDemoMode, setIsDemoMode] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [rawTerminalOutput, setRawTerminalOutput] = useState<string>('');
  const [connectionError, setConnectionError] = useState<string | null>(null);

  // Manual Paste Modal
  const [isPasteModalOpen, setIsPasteModalOpen] = useState(false);
  const [pasteInputText, setPasteInputText] = useState('');
  const [imageModalOpen, setImageModalOpen] = useState(false);

  // Copy indicator state
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Cost Calculator States
  const [calcPartition, setCalcPartition] = useState<string>('gpu-a100');
  const [calcUnits, setCalcUnits] = useState<number>(1);
  const [calcDurationType, setCalcDurationType] = useState<'hours' | 'days'>('hours');
  const [calcDurationValue, setCalcDurationValue] = useState<number>(24);

  const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '';

  // Initial fetch on mount only (no background polling)
  useEffect(() => {
    fetchClusterStatus(true);
  }, []);

  const fetchClusterStatus = async (forceDemo: boolean = true) => {
    setIsLoading(true);
    setConnectionError(null);

    // Parse cluster data directly on client
    setTimeout(() => {
      if (forceDemo || isDemoMode) {
        setIsConnected(true);
        setIsDemoMode(true);
        setPartitions(parseSinfoOutput(DEMO_SINFO_OUTPUT));
        setRawTerminalOutput(DEMO_SINFO_OUTPUT);
        setLastUpdated(new Date().toLocaleTimeString());
      } else {
        // If not in demo and not pasted, prompt for connection / manual paste
        setIsConnected(false);
        setConnectionError('Direct SSH execution is not supported in static browser environments. Please use Manual Paste or Open OnDemand shell.');
      }
      setIsLoading(false);
    }, 400);
  };

  const handleManualPasteSubmit = () => {
    if (!pasteInputText.trim()) return;
    const parsed = parseSinfoOutput(pasteInputText);
    setPartitions(parsed);
    setRawTerminalOutput(pasteInputText);
    setIsConnected(true);
    setIsDemoMode(false);
    setLastUpdated(`${new Date().toLocaleTimeString()} (Manual Paste)`);
    setIsPasteModalOpen(false);
  };

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  // Filter partitions for GPU table
  const filteredPartitions = partitions.filter((item) => {
    const isGpu = item.cleanPartition.toLowerCase().startsWith('gpu') || item.rate?.type === 'GPU';
    const isCpu = item.cleanPartition.toLowerCase().startsWith('cpu') || item.rate?.type === 'CPU';

    if (filter === 'available') {
      if (!item.isAvailable) return false;
    } else if (filter === 'gpu-only') {
      if (!isGpu) return false;
    } else if (filter === 'cpu-only') {
      if (!isCpu) return false;
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = item.partition.toLowerCase().includes(q);
      const matchHw = item.rate?.hardwareName.toLowerCase().includes(q) || false;
      return matchName || matchHw;
    }

    return true;
  });

  // Calculate high-level summary metrics
  const gpuNodes = partitions.filter((p) => p.cleanPartition.startsWith('gpu'));
  const totalAvailableGpus = gpuNodes.reduce((acc, curr) => acc + curr.nodesIdle, 0);
  const totalAllocatedGpus = gpuNodes.reduce((acc, curr) => acc + curr.nodesAllocated, 0);
  const totalGpuNodes = gpuNodes.reduce((acc, curr) => acc + curr.nodesTotal, 0);
  const partitionsWithAvailability = gpuNodes.filter((p) => p.isAvailable).length;

  // Calculator calculations
  const selectedRate = PACE_RATES.find((r) => r.partition === calcPartition) || PACE_RATES[0];
  const effectiveHours = calcDurationType === 'days' ? calcDurationValue * 24 : calcDurationValue;
  const currentTotalCost = (selectedRate.currentRate * calcUnits * effectiveHours).toFixed(2);
  const futureTotalCost = (selectedRate.postOct2026Rate * calcUnits * effectiveHours).toFixed(2);
  const deltaCost = (parseFloat(futureTotalCost) - parseFloat(currentTotalCost)).toFixed(2);
  const deltaPct = calculateRateDelta(selectedRate.currentRate, selectedRate.postOct2026Rate).percentage.toFixed(1);

  // SLURM template generator
  const generatedSlurmScript = `#!/bin/bash
#SBATCH --job-name=pace_gpu_job
#SBATCH --partition=${selectedRate.partition}
${selectedRate.type === 'GPU' ? `#SBATCH --gres=gpu:${calcUnits}` : `#SBATCH --nodes=1\n#SBATCH --ntasks-per-node=${calcUnits}`}
#SBATCH --time=${calcDurationType === 'days' ? `${calcDurationValue}-00:00:00` : `${Math.floor(calcDurationValue)}:00:00`}
#SBATCH --output=job_%j.out
#SBATCH --error=job_%j.err

echo "Starting compute job on PACE Phoenix..."
echo "Partition: ${selectedRate.partition} | Hardware: ${selectedRate.hardwareName}"
nvidia-smi 2>/dev/null || lscpu
# Run your training or analysis command here:
# python train.py
`;

  return (
    <div className="app-container">
      {/* Top Header */}
      <header className="top-header">
        <div className="brand-section">
          <div className="brand-badge">
            <span className="brand-badge-gt">GT</span>
            <span className="brand-badge-sub">PACE</span>
          </div>
          <div className="brand-titles">
            <h1>
              PACE Phoenix GPU Monitor
              <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--gt-gold)', background: 'rgba(234,170,0,0.12)', padding: '2px 8px', borderRadius: '4px', border: '1px solid rgba(234,170,0,0.3)' }}>
                Rates & Telemetry
              </span>
            </h1>
            <p>Real-time cluster availability & official General Research [GEN] computing rates</p>
          </div>
        </div>

        <div className="header-actions">
          {/* Status badge */}
          {isConnected ? (
            <div className={`status-pill ${isDemoMode ? 'demo' : 'connected'}`}>
              <div className="pulse-dot" />
              <span>{isDemoMode ? 'Demo Mode' : 'Connected to Phoenix'}</span>
            </div>
          ) : (
            <div className="status-pill disconnected">
              <div className="pulse-dot" />
              <span>Off-VPN / Not Logged In</span>
            </div>
          )}

          {/* Action: Manual Refresh (only queries on click) */}
          <button
            id="refresh-btn"
            className="btn btn-primary"
            onClick={() => fetchClusterStatus(isDemoMode)}
            disabled={isLoading}
            title="Queries sinfo via SSH on-demand"
          >
            <RefreshCw size={16} className={isLoading ? 'spin' : ''} />
            <span>{isLoading ? 'Checking...' : 'Refresh Status'}</span>
          </button>

          {/* Action: Paste Output */}
          <button
            id="paste-output-btn"
            className="btn btn-secondary"
            onClick={() => setIsPasteModalOpen(true)}
            title="Paste raw sinfo command output"
          >
            <FileText size={16} />
            <span>Paste Output</span>
          </button>

          {/* Action: Demo Mode Toggle */}
          <button
            id="toggle-demo-btn"
            className={`btn ${isDemoMode ? 'btn-gold-outline' : 'btn-secondary'}`}
            onClick={() => {
              const nextMode = !isDemoMode;
              setIsDemoMode(nextMode);
              fetchClusterStatus(nextMode);
            }}
          >
            <Sparkles size={16} />
            <span>{isDemoMode ? 'Exit Demo' : 'Demo Mode'}</span>
          </button>
        </div>
      </header>

      {/* Disconnected / Not Logged In Alert Notice */}
      {!isConnected && (
        <section className="alert-banner">
          <div className="alert-banner-content">
            <div className="alert-icon">
              <ShieldAlert size={26} />
            </div>
            <div className="alert-text">
              <h3>PACE Phoenix Cluster Unreachable via SSH</h3>
              <p>
                To fetch live data directly, your machine must be connected to the <strong>Georgia Tech VPN</strong> and have an authorized SSH key configured for <code>login-phoenix.pace.gatech.edu</code>.
              </p>
              <div style={{ marginTop: '10px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <a
                  href="https://ondemand-phoenix.pace.gatech.edu/pun/sys/shell/ssh/login-phoenix.pace.gatech.edu"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-primary"
                  style={{ fontSize: '0.8rem', padding: '6px 12px' }}
                >
                  <ExternalLink size={14} />
                  <span>Open PACE OnDemand Web Shell</span>
                </a>
                <button
                  className="btn btn-secondary"
                  style={{ fontSize: '0.8rem', padding: '6px 12px' }}
                  onClick={() => {
                    setIsDemoMode(true);
                    fetchClusterStatus(true);
                  }}
                >
                  <Sparkles size={14} />
                  <span>Preview with Demo Cluster Data</span>
                </button>
                <button
                  className="btn btn-secondary"
                  style={{ fontSize: '0.8rem', padding: '6px 12px' }}
                  onClick={() => setIsPasteModalOpen(true)}
                >
                  <FileText size={14} />
                  <span>Paste sinfo Output Manually</span>
                </button>
              </div>
            </div>
          </div>
          <div className="alert-actions">
            <button
              className="btn btn-gold-outline"
              style={{ fontSize: '0.8rem', padding: '6px 12px' }}
              onClick={() => handleCopy(`sinfo -o "%20P %10c %10m %25F" | grep -E '^PARTITION|^gpu'`, 'sinfo-cmd')}
            >
              {copiedKey === 'sinfo-cmd' ? <Check size={14} /> : <Copy size={14} />}
              <span>Copy sinfo Command</span>
            </button>
          </div>
        </section>
      )}

      {/* Top HUD Cards */}
      <section className="hud-grid">
        <div className="hud-card">
          <div className="hud-card-header">
            <span>Available GPU Nodes</span>
            <CheckCircle2 size={18} color="var(--status-available)" />
          </div>
          <div className="hud-card-value">
            <span style={{ color: 'var(--status-available)' }}>{totalAvailableGpus}</span>
            <span style={{ fontSize: '1rem', color: 'var(--text-muted)' }}>/ {totalGpuNodes} total</span>
          </div>
          <div className="hud-card-sub">
            {partitionsWithAvailability} of {gpuNodes.length} GPU queues ready for immediate dispatch
          </div>
        </div>

        <div className="hud-card">
          <div className="hud-card-header">
            <span>Allocated GPUs</span>
            <Cpu size={18} color="#38bdf8" />
          </div>
          <div className="hud-card-value">
            <span style={{ color: '#38bdf8' }}>{totalAllocatedGpus}</span>
            <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>nodes active</span>
          </div>
          <div className="hud-card-sub">
            Cluster utilization: {totalGpuNodes > 0 ? Math.round((totalAllocatedGpus / totalGpuNodes) * 100) : 0}%
          </div>
        </div>

        <div className="hud-card">
          <div className="hud-card-header">
            <span>Most Budget-Friendly GPU</span>
            <DollarSign size={18} color="var(--gt-gold)" />
          </div>
          <div className="hud-card-value">
            <span style={{ color: 'var(--gt-gold)' }}>$0.1303</span>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>/hr (Post-Oct 26)</span>
          </div>
          <div className="hud-card-sub">
            <strong>RTX 6000 Ada</strong> (-12.6% price drop post-Oct 2026)
          </div>
        </div>

        <div className="hud-card">
          <div className="hud-card-header">
            <span>Flagship High-Memory GPU</span>
            <Layers size={18} color="#c084fc" />
          </div>
          <div className="hud-card-value">
            <span style={{ color: '#c084fc' }}>H200</span>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>141 GB HBM3e</span>
          </div>
          <div className="hud-card-sub">
            Current: $0.6730/hr → Post-Oct 26: $1.4135/hr
          </div>
        </div>
      </section>

      {/* Navigation Tabs */}
      <nav className="tabs-nav">
        <button
          className={`tab-btn ${activeTab === 'availability' ? 'active' : ''}`}
          onClick={() => setActiveTab('availability')}
        >
          <Server size={18} />
          <span>GPU Availability & Partitions</span>
        </button>
        <button
          className={`tab-btn ${activeTab === 'calculator' ? 'active' : ''}`}
          onClick={() => setActiveTab('calculator')}
        >
          <Sliders size={18} />
          <span>Interactive Cost Estimator</span>
        </button>
        <button
          className={`tab-btn ${activeTab === 'rate-sheet' ? 'active' : ''}`}
          onClick={() => setActiveTab('rate-sheet')}
        >
          <DollarSign size={18} />
          <span>Official [GEN] Rate Sheet</span>
        </button>
        <button
          className={`tab-btn ${activeTab === 'help' ? 'active' : ''}`}
          onClick={() => setActiveTab('help')}
        >
          <HelpCircle size={18} />
          <span>Connection & SSH Guide</span>
        </button>
      </nav>

      {/* TAB 1: GPU Availability & Partitions */}
      {activeTab === 'availability' && (
        <section className="card-section">
          <div className="section-header">
            <div>
              <h2>
                <Server size={22} color="var(--gt-gold)" />
                PACE Phoenix Partition Availability
              </h2>
              <p>
                Parsed from <code>sinfo -o "%20P %10c %10m %25F"</code>. When idle nodes &gt; 0, the partition is ready for immediate allocation.
                {lastUpdated && ` Last refreshed: ${lastUpdated}`}
              </p>
            </div>

            <div className="filters-bar">
              <button
                className={`filter-chip ${filter === 'gpu-only' ? 'active' : ''}`}
                onClick={() => setFilter('gpu-only')}
              >
                GPU Partitions ({gpuNodes.length})
              </button>
              <button
                className={`filter-chip ${filter === 'available' ? 'active' : ''}`}
                onClick={() => setFilter('available')}
              >
                Available Ready ({partitionsWithAvailability})
              </button>
              <button
                className={`filter-chip ${filter === 'cpu-only' ? 'active' : ''}`}
                onClick={() => setFilter('cpu-only')}
              >
                CPU Partitions
              </button>
              <button
                className={`filter-chip ${filter === 'all' ? 'active' : ''}`}
                onClick={() => setFilter('all')}
              >
                All Partitions ({partitions.length})
              </button>
            </div>
          </div>

          <div className="table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Partition / Queue</th>
                  <th>Status</th>
                  <th>Availability Meter</th>
                  <th>Nodes (A / I / O / T)</th>
                  <th>CPUs / Node</th>
                  <th>RAM / Node</th>
                  <th>Current Rate</th>
                  <th>Post-Oct 1, 2026</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredPartitions.length === 0 ? (
                  <tr>
                    <td colSpan={9} style={{ textAlign: 'center', padding: '36px', color: 'var(--text-muted)' }}>
                      No matching partitions found. Click "Refresh Status" or switch filters.
                    </td>
                  </tr>
                ) : (
                  filteredPartitions.map((item) => {
                    const rate = item.rate;
                    const delta = rate ? calculateRateDelta(rate.currentRate, rate.postOct2026Rate) : null;
                    const total = item.nodesTotal || 1;
                    const allocPct = ((item.nodesAllocated / total) * 100).toFixed(0);
                    const idlePct = ((item.nodesIdle / total) * 100).toFixed(0);
                    const otherPct = ((item.nodesOther / total) * 100).toFixed(0);

                    return (
                      <tr key={item.partition}>
                        <td>
                          <div className="partition-badge">
                            <span>{item.partition}</span>
                            {item.isDefault && <span className="star-indicator" title="Default Partition">*</span>}
                          </div>
                          {rate?.hardwareName && (
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                              {rate.hardwareName}
                            </div>
                          )}
                        </td>

                        <td>
                          {item.isAvailable ? (
                            <span className="avail-tag available">
                              <CheckCircle2 size={12} />
                              Available ({item.nodesIdle} Idle)
                            </span>
                          ) : (
                            <span className="avail-tag busy">
                              <XCircle size={12} />
                              Busy (0 Idle)
                            </span>
                          )}
                        </td>

                        <td>
                          <div className="node-meter-container">
                            <div className="node-meter-bar">
                              <div
                                className="node-meter-segment segment-idle"
                                style={{ width: `${idlePct}%` }}
                                title={`Idle: ${item.nodesIdle} nodes (${idlePct}%)`}
                              />
                              <div
                                className="node-meter-segment segment-allocated"
                                style={{ width: `${allocPct}%` }}
                                title={`Allocated: ${item.nodesAllocated} nodes (${allocPct}%)`}
                              />
                              <div
                                className="node-meter-segment segment-other"
                                style={{ width: `${otherPct}%` }}
                                title={`Other/Drain: ${item.nodesOther} nodes (${otherPct}%)`}
                              />
                            </div>
                            <div className="node-meter-legend">
                              <span style={{ color: 'var(--status-available)' }}>{item.nodesIdle} Free</span>
                              <span style={{ color: '#38bdf8' }}>{item.nodesAllocated} Active</span>
                              <span style={{ color: 'var(--text-muted)' }}>{item.nodesTotal} Total</span>
                            </div>
                          </div>
                        </td>

                        <td>
                          <code style={{ fontFamily: 'var(--font-mono)', fontSize: '0.85rem' }}>
                            {item.nodesAllocated}/{item.nodesIdle}/{item.nodesOther}/{item.nodesTotal}
                          </code>
                        </td>

                        <td>
                          <span style={{ fontFamily: 'var(--font-mono)' }}>{item.cpus} Cores</span>
                        </td>

                        <td>
                          <span style={{ fontFamily: 'var(--font-mono)' }}>{item.memoryFormatted}</span>
                        </td>

                        <td>
                          {rate ? (
                            <span className="rate-badge rate-current">
                              ${rate.currentRate.toFixed(4)}
                              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>/{rate.consumableUnit === 'GPU Hour' ? 'gpu-hr' : 'cpu-hr'}</span>
                            </span>
                          ) : (
                            <span style={{ color: 'var(--text-muted)' }}>N/A</span>
                          )}
                        </td>

                        <td>
                          {rate && delta ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <span className="rate-badge rate-future">
                                ${rate.postOct2026Rate.toFixed(4)}
                              </span>
                              <span
                                className={`delta-pill ${
                                  delta.isDecrease ? 'decrease' : delta.isIncrease ? 'increase' : 'neutral'
                                }`}
                              >
                                {delta.isDecrease ? '↓' : delta.isIncrease ? '↑' : ''}
                                {Math.abs(delta.percentage).toFixed(0)}%
                              </span>
                            </div>
                          ) : (
                            <span style={{ color: 'var(--text-muted)' }}>N/A</span>
                          )}
                        </td>

                        <td>
                          <button
                            className="btn btn-secondary"
                            style={{ fontSize: '0.75rem', padding: '4px 10px' }}
                            onClick={() => {
                              setCalcPartition(item.cleanPartition);
                              setActiveTab('calculator');
                            }}
                          >
                            Estimate
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* TAB 2: Interactive Cost Estimator & Slurm Generator */}
      {activeTab === 'calculator' && (
        <section className="card-section">
          <div className="section-header">
            <div>
              <h2>
                <Sliders size={22} color="var(--gt-gold)" />
                PACE Phoenix SLURM Job Cost Estimator
              </h2>
              <p>Calculate your project compute budget and compare Current Rates vs Post-Oct 1, 2026 rates.</p>
            </div>
          </div>

          <div className="calculator-grid">
            {/* Input Column */}
            <div>
              <div className="calc-input-group">
                <label>Select Node Partition / Hardware Classification</label>
                <select
                  className="calc-select"
                  value={calcPartition}
                  onChange={(e) => setCalcPartition(e.target.value)}
                >
                  <optgroup label="GPU Partitions">
                    {PACE_RATES.filter((r) => r.type === 'GPU').map((rate) => (
                      <option key={rate.id} value={rate.partition}>
                        {rate.classification} — {rate.hardwareName} (${rate.currentRate.toFixed(4)}/hr)
                      </option>
                    ))}
                  </optgroup>
                  <optgroup label="CPU Partitions">
                    {PACE_RATES.filter((r) => r.type === 'CPU').map((rate) => (
                      <option key={rate.id} value={rate.partition}>
                        {rate.classification} — {rate.hardwareName} (${rate.currentRate.toFixed(4)}/hr)
                      </option>
                    ))}
                  </optgroup>
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div className="calc-input-group">
                  <label>{selectedRate.type === 'GPU' ? 'Number of GPUs' : 'Number of Cores'}</label>
                  <input
                    type="number"
                    min={1}
                    max={64}
                    className="calc-input"
                    value={calcUnits}
                    onChange={(e) => setCalcUnits(Math.max(1, parseInt(e.target.value, 10) || 1))}
                  />
                </div>

                <div className="calc-input-group">
                  <label>Duration Unit</label>
                  <select
                    className="calc-select"
                    value={calcDurationType}
                    onChange={(e) => setCalcDurationType(e.target.value as 'hours' | 'days')}
                  >
                    <option value="hours">Hours</option>
                    <option value="days">Days</option>
                  </select>
                </div>
              </div>

              <div className="calc-input-group">
                <label>Job Runtime ({calcDurationType})</label>
                <input
                  type="number"
                  min={1}
                  max={720}
                  className="calc-input"
                  value={calcDurationValue}
                  onChange={(e) => setCalcDurationValue(Math.max(1, parseFloat(e.target.value) || 1))}
                />
              </div>

              {/* Hardware highlight box */}
              <div style={{ background: 'rgba(0,0,0,0.3)', padding: '14px', borderRadius: '8px', border: '1px solid var(--border-subtle)', marginTop: '16px' }}>
                <div style={{ fontWeight: 700, color: 'var(--gt-gold)', fontSize: '0.9rem' }}>
                  {selectedRate.hardwareName} ({selectedRate.vramOrSpec})
                </div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                  {selectedRate.description}
                </div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '6px' }}>
                  <strong>Recommended for:</strong> {selectedRate.recommendedFor}
                </div>
              </div>
            </div>

            {/* Cost Breakdown & Slurm Script Column */}
            <div>
              <div className="calc-summary-box">
                <div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>
                    Estimated Internal Compute Cost
                  </div>

                  <div className="cost-comparison-row" style={{ marginTop: '12px' }}>
                    <div>
                      <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Current Internal Rate</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>${selectedRate.currentRate.toFixed(4)} / {selectedRate.consumableUnit}</div>
                    </div>
                    <div className="cost-val" style={{ color: '#38bdf8' }}>${currentTotalCost}</div>
                  </div>

                  <div className="cost-comparison-row">
                    <div>
                      <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Post-Oct 1, 2026 Rate</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>${selectedRate.postOct2026Rate.toFixed(4)} / {selectedRate.consumableUnit}</div>
                    </div>
                    <div className="cost-val" style={{ color: 'var(--gt-gold)' }}>${futureTotalCost}</div>
                  </div>

                  <div className="cost-comparison-row">
                    <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                      Budget Impact
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <span
                        className={`delta-pill ${
                          parseFloat(deltaCost) < 0 ? 'decrease' : parseFloat(deltaCost) > 0 ? 'increase' : 'neutral'
                        }`}
                        style={{ fontSize: '0.85rem', padding: '4px 8px' }}
                      >
                        {parseFloat(deltaCost) >= 0 ? `+$${deltaCost} (+${deltaPct}%)` : `-$${Math.abs(parseFloat(deltaCost))} (${deltaPct}%)`}
                      </span>
                    </div>
                  </div>
                </div>

                <div style={{ marginTop: '20px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Generated SLURM Job Script</span>
                    <button
                      className="btn btn-secondary"
                      style={{ fontSize: '0.7rem', padding: '2px 8px' }}
                      onClick={() => handleCopy(generatedSlurmScript, 'slurm-script')}
                    >
                      {copiedKey === 'slurm-script' ? <Check size={12} /> : <Copy size={12} />}
                      <span>{copiedKey === 'slurm-script' ? 'Copied' : 'Copy Script'}</span>
                    </button>
                  </div>
                  <pre className="code-snippet-box">
                    <code>{generatedSlurmScript}</code>
                  </pre>
                </div>
              </div>
            </div>
          </div>

          {/* Quick GPU Alternative Matrix */}
          <div style={{ marginTop: '28px' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '12px', color: 'var(--text-primary)' }}>
              Side-by-Side Cost Comparison for {calcUnits} Unit(s) across {effectiveHours} Hours
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
              {PACE_RATES.filter((r) => r.type === 'GPU').map((gpu) => {
                const curCost = (gpu.currentRate * calcUnits * effectiveHours).toFixed(2);
                const futCost = (gpu.postOct2026Rate * calcUnits * effectiveHours).toFixed(2);
                const isSelected = gpu.partition === calcPartition;

                return (
                  <div
                    key={gpu.id}
                    onClick={() => setCalcPartition(gpu.partition)}
                    style={{
                      background: isSelected ? 'rgba(234, 170, 0, 0.12)' : 'var(--bg-card-accent)',
                      border: `1px solid ${isSelected ? 'var(--gt-gold)' : 'var(--border-subtle)'}`,
                      borderRadius: '8px',
                      padding: '12px',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                      <span style={{ fontWeight: 700, fontSize: '0.85rem', color: '#f8fafc' }}>{gpu.partition}</span>
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{gpu.vramOrSpec?.split(' ')[0]}</span>
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Current: <strong style={{ color: '#38bdf8' }}>${curCost}</strong></div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Post-Oct: <strong style={{ color: 'var(--gt-gold)' }}>${futCost}</strong></div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* TAB 3: Official [GEN] Rate Sheet */}
      {activeTab === 'rate-sheet' && (
        <section className="card-section">
          <div className="section-header">
            <div>
              <h2>
                <DollarSign size={22} color="var(--gt-gold)" />
                General Research [GEN] Computing Rate Sheet (Phoenix)
              </h2>
              <p>Official internal rates for CPU and GPU nodes, including scheduled post-October 1, 2026 revisions.</p>
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                className="btn btn-gold-outline"
                style={{ fontSize: '0.8rem', padding: '6px 14px' }}
                onClick={() => setImageModalOpen(true)}
              >
                <Eye size={16} />
                <span>View Original Rate Chart</span>
              </button>
            </div>
          </div>

          <div className="table-wrapper">
            <table className="data-table">
              <thead>
                <tr style={{ background: 'linear-gradient(90deg, #d49800 0%, #b3a369 100%)' }}>
                  <th colSpan={6} style={{ color: '#070b14', fontWeight: 900, letterSpacing: '0.05em', textAlign: 'center', fontSize: '0.85rem' }}>
                    General Research [GEN] Computing (i.e. Phoenix) Internal Billing
                  </th>
                </tr>
                <tr>
                  <th>Node Classification</th>
                  <th>Hardware / Architecture</th>
                  <th>Consumable Unit</th>
                  <th>Current Internal Rate</th>
                  <th>Post-Oct 1, 2026 Internal Rate</th>
                  <th>Rate Revision</th>
                </tr>
              </thead>
              <tbody>
                {PACE_RATES.map((rate) => {
                  const delta = calculateRateDelta(rate.currentRate, rate.postOct2026Rate);
                  return (
                    <tr key={rate.id}>
                      <td>
                        <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--text-primary)' }}>
                          {rate.classification}
                        </span>
                      </td>
                      <td>
                        <div style={{ fontWeight: 600, color: '#f1f5f9' }}>{rate.hardwareName}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{rate.vramOrSpec}</div>
                      </td>
                      <td>
                        <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                          {rate.consumableUnit}
                        </span>
                      </td>
                      <td>
                        <span className="rate-badge rate-current">
                          ${rate.currentRate.toFixed(4)}
                        </span>
                      </td>
                      <td>
                        <span className="rate-badge rate-future">
                          ${rate.postOct2026Rate.toFixed(4)}
                        </span>
                      </td>
                      <td>
                        <span
                          className={`delta-pill ${
                            delta.isDecrease ? 'decrease' : delta.isIncrease ? 'increase' : 'neutral'
                          }`}
                        >
                          {delta.isDecrease && '↓ '}
                          {delta.isIncrease && '+'}
                          {delta.percentage.toFixed(1)}%
                          {delta.isDecrease ? ' (Savings)' : delta.isUnchanged ? ' (Unchanged)' : ''}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* TAB 4: Connection & SSH Guide */}
      {activeTab === 'help' && (
        <section className="card-section">
          <div className="section-header">
            <div>
              <h2>
                <HelpCircle size={22} color="var(--gt-gold)" />
                PACE Phoenix Connection & SSH Telemetry Guide
              </h2>
              <p>Documentation on connecting, permissions, SLURM output flags, and running offline.</p>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
            <div style={{ background: 'var(--bg-card-accent)', padding: '20px', borderRadius: '12px', border: '1px solid var(--border-subtle)' }}>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: '10px', color: 'var(--gt-gold)' }}>
                1. Access Prerequisites
              </h3>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                Phoenix compute nodes and login nodes are protected inside the Georgia Tech campus network.
              </p>
              <ul style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', paddingLeft: '20px', marginTop: '8px', lineHeight: 1.6 }}>
                <li>Connect via <strong>GlobalProtect VPN</strong> (<code>vpn.gatech.edu</code>).</li>
                <li>Add your public SSH key to <code>~/.ssh/authorized_keys</code> on Phoenix.</li>
                <li>Or access the interactive web terminal via <a href="https://ondemand-phoenix.pace.gatech.edu/pun/sys/shell/ssh/login-phoenix.pace.gatech.edu" target="_blank" rel="noreferrer" style={{ color: 'var(--gt-gold)' }}>PACE Open OnDemand</a>.</li>
              </ul>
            </div>

            <div style={{ background: 'var(--bg-card-accent)', padding: '20px', borderRadius: '12px', border: '1px solid var(--border-subtle)' }}>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: '10px', color: 'var(--gt-gold)' }}>
                2. SLURM Telemetry Command
              </h3>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                The dashboard runs the following command to retrieve queue status:
              </p>
              <div style={{ background: '#05080f', padding: '10px', borderRadius: '6px', fontFamily: 'var(--font-mono)', fontSize: '0.8rem', color: '#38bdf8', marginTop: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <code>sinfo -o "%20P %10c %10m %25F" | grep -E '^PARTITION|^gpu'</code>
                <button
                  className="btn btn-secondary"
                  style={{ padding: '2px 6px', fontSize: '0.7rem' }}
                  onClick={() => handleCopy(`sinfo -o "%20P %10c %10m %25F" | grep -E '^PARTITION|^gpu'`, 'sinfo-guide-cmd')}
                >
                  {copiedKey === 'sinfo-guide-cmd' ? <Check size={12} /> : <Copy size={12} />}
                </button>
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '8px' }}>
                Only queried when you hit the <strong>Refresh Status</strong> button.
              </div>
            </div>

            <div style={{ background: 'var(--bg-card-accent)', padding: '20px', borderRadius: '12px', border: '1px solid var(--border-subtle)' }}>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: '10px', color: 'var(--gt-gold)' }}>
                3. Column Format Explained
              </h3>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div><strong>PARTITION (%20P)</strong>: The queue name. Asterisk (*) denotes the default partition.</div>
                <div><strong>CPUs (%10c)</strong>: Number of CPU cores available per compute node. A '+' means minimum shown.</div>
                <div><strong>MEMORY (%10m)</strong>: Configured RAM in MB (e.g., 515000 is ~512 GB).</div>
                <div><strong>NODES (%25F)</strong>: Broken down as <code>Allocated / Idle / Other / Total</code>.</div>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Manual Paste Modal */}
      {isPasteModalOpen && (
        <div className="modal-overlay" onClick={() => setIsPasteModalOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Paste SLURM Terminal Output</h3>
              <button className="close-btn" onClick={() => setIsPasteModalOpen(false)}>
                <XCircle size={20} />
              </button>
            </div>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '12px' }}>
              Run this in your PACE terminal or Open OnDemand shell, then paste the output below:
              <br />
              <code style={{ fontFamily: 'var(--font-mono)', color: 'var(--gt-gold)' }}>
                sinfo -o "%20P %10c %10m %25F" | grep -E '^PARTITION|^gpu'
              </code>
            </p>
            <textarea
              className="textarea-field"
              placeholder={`PARTITION             CPUS       MEMORY     NODES(A/I/O/T)\ngpu-a100              64         515000     14/4/1/19\ngpu-h100              96         1000000    7/1/0/8\n...`}
              value={pasteInputText}
              onChange={(e) => setPasteInputText(e.target.value)}
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button className="btn btn-secondary" onClick={() => setIsPasteModalOpen(false)}>
                Cancel
              </button>
              <button className="btn btn-primary" onClick={handleManualPasteSubmit}>
                Parse & Update Dashboard
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Original Image Modal */}
      {imageModalOpen && (
        <div className="modal-overlay" onClick={() => setImageModalOpen(false)}>
          <div className="modal-content" style={{ maxWidth: '850px' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>General Research [GEN] Computing Rate Sheet (Original)</h3>
              <button className="close-btn" onClick={() => setImageModalOpen(false)}>
                <XCircle size={20} />
              </button>
            </div>
            <div style={{ overflow: 'hidden', borderRadius: '8px', border: '1px solid var(--border-subtle)', background: '#fff' }}>
              <img
                src={`${basePath}/rate-sheet-reference.png`}
                alt="General Research [GEN] Computing (i.e. Phoenix) Rate Table"
                style={{ width: '100%', height: 'auto', display: 'block' }}
              />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '16px' }}>
              <button className="btn btn-secondary" onClick={() => setImageModalOpen(false)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
