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
  Download,
  RotateCcw,
  Terminal,
} from 'lucide-react';
import { PACE_RATES, ComputeRate, calculateRateDelta, getRateForPartition, getCoresPerGpu } from '@/lib/rates';
import { SlurmPartitionNode, parseSinfoOutput } from '@/lib/slurm-parser';

type FilterType = 'all' | 'available' | 'gpu-only' | 'cpu-only';
type TabType = 'availability' | 'calculator' | 'rate-sheet' | 'help';

function parseWalltimeToHours(walltime: string): number {
  const trimmed = (walltime || '').trim();
  if (trimmed.includes('-')) {
    const [dayStr, rest] = trimmed.split('-');
    const days = parseFloat(dayStr) || 0;
    const parts = (rest || '').split(':').map((p) => parseFloat(p) || 0);
    const hours = parts[0] || 0;
    const mins = parts[1] || 0;
    const secs = parts[2] || 0;
    return days * 24 + hours + mins / 60 + secs / 3600;
  }
  if (trimmed.includes(':')) {
    const parts = trimmed.split(':').map((p) => parseFloat(p) || 0);
    if (parts.length === 3) {
      return parts[0] + parts[1] / 60 + parts[2] / 3600;
    } else if (parts.length === 2) {
      return parts[0] + parts[1] / 60;
    }
  }
  const numeric = parseFloat(trimmed);
  return isNaN(numeric) || numeric <= 0 ? 1 : numeric;
}

export default function PaceDashboard() {
  // Navigation & view states
  const [activeTab, setActiveTab] = useState<TabType>('availability');
  const [filter, setFilter] = useState<FilterType>('gpu-only');
  const [searchQuery, setSearchQuery] = useState('');

  // Cluster data states
  const [partitions, setPartitions] = useState<SlurmPartitionNode[]>([]);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [rawTerminalOutput, setRawTerminalOutput] = useState<string>('');
  const [connectionError, setConnectionError] = useState<string | null>(null);

  // Manual Paste Modal
  const [isPasteModalOpen, setIsPasteModalOpen] = useState(false);
  const [pasteInputText, setPasteInputText] = useState('');
  const [imageModalOpen, setImageModalOpen] = useState(false);

  // Copy indicator state
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Cost Calculator & SLURM Script Builder States
  const [calcPartition, setCalcPartition] = useState<string>('gpu-rtxpro-blackwell');
  const [calcUnits, setCalcUnits] = useState<number>(1);
  const [sbatchAccount, setSbatchAccount] = useState<string>('paceship-ulora');
  const [sbatchNodes, setSbatchNodes] = useState<number>(1);
  const [sbatchCores, setSbatchCores] = useState<number>(8);
  const [sbatchMem, setSbatchMem] = useState<string>('32G');
  const [sbatchTime, setSbatchTime] = useState<string>('01:00:00');
  const [sbatchQos, setSbatchQos] = useState<string>('embers');
  const [sbatchJobName, setSbatchJobName] = useState<string>('Mottt_FT_GSM8k');
  const [sbatchOutput, setSbatchOutput] = useState<string>('Mottt_FT_GSM8k-%j.out');
  const [sbatchWorkdir, setSbatchWorkdir] = useState<string>('/storage/project/ps-ulora-0/dliu450/MoTTT');
  const [sbatchModule, setSbatchModule] = useState<string>('anaconda3');
  const [sbatchCondaEnv, setSbatchCondaEnv] = useState<string>('mottt');
  const [sbatchCondaParams, setSbatchCondaParams] = useState<string>('');
  const [sbatchEnvVars, setSbatchEnvVars] = useState<string>('');
  const [sbatchCommand, setSbatchCommand] = useState<string>(
    'python experiments/gsm8k/train_full_finetune.py \\\n  --model_name_or_path meta-llama/Llama-3.2-1B \\\n  --dataset gsm8k'
  );

  const PACE_SHELL_URL = 'https://ondemand-phoenix.pace.gatech.edu/pun/sys/shell/ssh/login-phoenix.pace.gatech.edu';
  const SINFO_CHECK_CMD = `sinfo -o "%20P %10c %10m %25F" | grep -E '^PARTITION|^gpu'`;
  const SQUEUE_CHECK_CMD = `squeue -h -t PENDING -p gpu-v100,gpu-a100,gpu-h100,gpu-h200,gpu-l40s,gpu-rtx6000,gpu-rtxpro-blackwell -o "%P" | tr ',' '\\n' | sort | uniq -c | sort -rn`;

  const [shellToast, setShellToast] = useState<{ active: boolean; title: string; cmd: string } | null>(null);

  const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '';

  const handleOpenShellWithCommand = async (command: string, key: string, title: string) => {
    try {
      await navigator.clipboard.writeText(command);
      setCopiedKey(key);
      setShellToast({
        active: true,
        title,
        cmd: command,
      });
      window.open(PACE_SHELL_URL, '_blank', 'noopener,noreferrer');
      setTimeout(() => setCopiedKey(null), 3500);
      setTimeout(() => setShellToast(null), 9000);
    } catch (err) {
      console.error('Failed to copy to clipboard', err);
      window.open(PACE_SHELL_URL, '_blank', 'noopener,noreferrer');
    }
  };

  const handlePartitionChange = (newPartition: string, units: number = calcUnits) => {
    setCalcPartition(newPartition);
    const rate = PACE_RATES.find((r) => r.partition === newPartition);
    if (rate && rate.type === 'GPU') {
      const cores = getCoresPerGpu(newPartition) * units;
      setSbatchCores(cores);
    }
  };

  const handleUnitsChange = (newUnits: number) => {
    setCalcUnits(newUnits);
    const rate = PACE_RATES.find((r) => r.partition === calcPartition);
    if (rate && rate.type === 'GPU') {
      const cores = getCoresPerGpu(calcPartition) * newUnits;
      setSbatchCores(cores);
    }
  };

  const handleRefresh = () => {
    setIsLoading(true);
    setTimeout(() => {
      if (rawTerminalOutput.trim()) {
        const parsed = parseSinfoOutput(rawTerminalOutput);
        setPartitions(parsed);
        setIsConnected(true);
        setLastUpdated(`${new Date().toLocaleTimeString()} (Refreshed)`);
      } else {
        setIsPasteModalOpen(true);
      }
      setIsLoading(false);
    }, 300);
  };

  const handleManualPasteSubmit = () => {
    if (!pasteInputText.trim()) return;
    const parsed = parseSinfoOutput(pasteInputText);
    setPartitions(parsed);
    setRawTerminalOutput(pasteInputText);
    setIsConnected(true);
    setConnectionError(null);
    setLastUpdated(`${new Date().toLocaleTimeString()}`);
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
  const effectiveHours = parseWalltimeToHours(sbatchTime);
  const currentTotalCost = (selectedRate.currentRate * calcUnits * effectiveHours).toFixed(2);
  const futureTotalCost = (selectedRate.postOct2026Rate * calcUnits * effectiveHours).toFixed(2);
  const deltaCost = (parseFloat(futureTotalCost) - parseFloat(currentTotalCost)).toFixed(2);
  const deltaPct = calculateRateDelta(selectedRate.currentRate, selectedRate.postOct2026Rate).percentage.toFixed(1);

  // Exact PACE SLURM GRES directive
  const gresTag = selectedRate.type === 'GPU'
    ? `#SBATCH --gres=gpu:${selectedRate.gresType || selectedRate.partition.replace('gpu-', '')}:${calcUnits}`
    : `#SBATCH -p ${selectedRate.partition}`;

  const condaActivateLine = sbatchCondaParams.trim()
    ? `conda activate ${sbatchCondaEnv} ${sbatchCondaParams.trim()}`
    : `conda activate ${sbatchCondaEnv}`;

  const envVarsBlock = sbatchEnvVars.trim()
    ? `\n# Conda & Environment Parameters\n${sbatchEnvVars.trim()}\n`
    : '';

  // Full SLURM script generator matching user's PACE specification
  const generatedSlurmScript = `#!/bin/bash
#SBATCH -A ${sbatchAccount}
#SBATCH -N ${sbatchNodes}
#SBATCH -n ${sbatchCores}
#SBATCH --mem=${sbatchMem}
#SBATCH -t ${sbatchTime}
#SBATCH --qos=${sbatchQos}
#SBATCH -J ${sbatchJobName}
#SBATCH -o ${sbatchOutput}
${gresTag}

cd ${sbatchWorkdir}
module load ${sbatchModule}
eval "$(conda shell.bash hook)"
${condaActivateLine}
${envVarsBlock}
${sbatchCommand}
`;

  const resetToMotttExample = () => {
    setCalcPartition('gpu-rtxpro-blackwell');
    setCalcUnits(1);
    setSbatchAccount('paceship-ulora');
    setSbatchNodes(1);
    setSbatchCores(8);
    setSbatchMem('32G');
    setSbatchTime('01:00:00');
    setSbatchQos('embers');
    setSbatchJobName('Mottt_FT_GSM8k');
    setSbatchOutput('Mottt_FT_GSM8k-%j.out');
    setSbatchWorkdir('/storage/project/ps-ulora-0/dliu450/MoTTT');
    setSbatchModule('anaconda3');
    setSbatchCondaEnv('mottt');
    setSbatchCondaParams('');
    setSbatchEnvVars('');
    setSbatchCommand('python experiments/gsm8k/train_full_finetune.py \\\n  --model_name_or_path meta-llama/Llama-3.2-1B \\\n  --dataset gsm8k');
  };

  const handleDownloadScript = () => {
    const blob = new Blob([generatedSlurmScript], { type: 'text/x-sh' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${sbatchJobName || 'pace_job'}.sbatch`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

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
          {isConnected && partitions.length > 0 ? (
            <div className="status-pill connected">
              <div className="pulse-dot" />
              <span>Live Output Loaded ({partitions.length} Queues)</span>
            </div>
          ) : (
            <div className="status-pill disconnected">
              <div className="pulse-dot" />
              <span>Awaiting sinfo Output</span>
            </div>
          )}

          {/* Action: Paste Output (Primary Action) */}
          <button
            id="paste-output-btn"
            className="btn btn-primary"
            onClick={() => setIsPasteModalOpen(true)}
            title="Paste raw sinfo command output from PACE Phoenix"
          >
            <FileText size={16} />
            <span>Paste Output</span>
          </button>

          {/* Action: Manual Refresh (only queries on click) */}
          <button
            id="refresh-btn"
            className="btn btn-secondary"
            onClick={handleRefresh}
            disabled={isLoading}
            title="Refresh or re-parse output"
          >
            <RefreshCw size={16} className={isLoading ? 'spin' : ''} />
            <span>{isLoading ? 'Checking...' : 'Refresh Status'}</span>
          </button>
        </div>
      </header>

      {/* Disconnected / Not Logged In Alert Notice */}
      {!isConnected && (
        <section className="alert-banner">
          <div className="alert-banner-content">
            <div className="alert-icon">
              <FileText size={26} />
            </div>
            <div className="alert-text">
              <h3>Awaiting PACE Phoenix Cluster Telemetry</h3>
              <p>
                To view live partition availability and compute rates, run the SLURM command in your PACE shell or Open OnDemand web terminal, then click <strong>Paste Output</strong>:
              </p>
              <div style={{ marginTop: '10px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <button
                  className="btn btn-primary"
                  style={{ fontSize: '0.8rem', padding: '6px 14px' }}
                  onClick={() => setIsPasteModalOpen(true)}
                >
                  <FileText size={14} />
                  <span>Paste sinfo Output</span>
                </button>
                <a
                  href="https://ondemand-phoenix.pace.gatech.edu/pun/sys/shell/ssh/login-phoenix.pace.gatech.edu"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-secondary"
                  style={{ fontSize: '0.8rem', padding: '6px 12px' }}
                >
                  <ExternalLink size={14} />
                  <span>Open PACE OnDemand Shell</span>
                </a>
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

        {/* Shortcut Card 1: sinfo partition availability */}
        <div className="hud-card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <div className="hud-card-header">
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Terminal size={15} color="var(--gt-gold)" />
                <span>Check GPU Status (sinfo)</span>
              </span>
              <span className="badge badge-gold" style={{ fontSize: '0.68rem', padding: '2px 6px' }}>
                Shortcut
              </span>
            </div>
            <div
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '0.72rem',
                background: 'rgba(0,0,0,0.4)',
                padding: '8px 10px',
                borderRadius: '6px',
                border: '1px solid var(--border-subtle)',
                color: '#e2e8f0',
                wordBreak: 'break-all',
                lineHeight: 1.4,
                marginBottom: '10px'
              }}
              title={SINFO_CHECK_CMD}
            >
              <code>sinfo -o &quot;%20P %10c %10m %25F&quot; | grep -E &apos;^PARTITION|^gpu&apos;</code>
            </div>
          </div>

          <div>
            <button
              className="btn btn-primary"
              style={{
                width: '100%',
                fontSize: '0.8rem',
                padding: '8px 12px',
                justifyContent: 'center',
                gap: '8px',
                background: copiedKey === 'sinfo-shortcut' ? '#16a34a' : undefined
              }}
              onClick={() => handleOpenShellWithCommand(
                SINFO_CHECK_CMD,
                'sinfo-shortcut',
                'GPU Partition sinfo Command'
              )}
            >
              {copiedKey === 'sinfo-shortcut' ? (
                <>
                  <Check size={15} />
                  <span>Copied! Opening Shell...</span>
                </>
              ) : (
                <>
                  <ExternalLink size={15} />
                  <span>Open Shell &amp; Run sinfo</span>
                </>
              )}
            </button>
            <div className="hud-card-sub" style={{ textAlign: 'center', marginTop: '6px', fontSize: '0.72rem' }}>
              Auto-copies command &bull; paste in terminal
            </div>
          </div>
        </div>

        {/* Shortcut Card 2: squeue pending backlog */}
        <div className="hud-card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <div className="hud-card-header">
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Layers size={15} color="#c084fc" />
                <span>Check Queue Backlog (squeue)</span>
              </span>
              <span className="badge badge-blue" style={{ fontSize: '0.68rem', padding: '2px 6px', color: '#c084fc', borderColor: 'rgba(192,132,252,0.3)', background: 'rgba(192,132,252,0.1)' }}>
                Shortcut
              </span>
            </div>
            <div
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '0.72rem',
                background: 'rgba(0,0,0,0.4)',
                padding: '8px 10px',
                borderRadius: '6px',
                border: '1px solid var(--border-subtle)',
                color: '#e2e8f0',
                wordBreak: 'break-all',
                lineHeight: 1.4,
                marginBottom: '10px'
              }}
              title={SQUEUE_CHECK_CMD}
            >
              <code>squeue -h -t PENDING -p gpu-... | uniq -c | sort -rn</code>
            </div>
          </div>

          <div>
            <button
              className="btn btn-secondary"
              style={{
                width: '100%',
                fontSize: '0.8rem',
                padding: '8px 12px',
                justifyContent: 'center',
                gap: '8px',
                borderColor: 'rgba(192,132,252,0.4)',
                color: '#e9d5ff',
                background: copiedKey === 'squeue-shortcut' ? '#16a34a' : 'rgba(192,132,252,0.1)'
              }}
              onClick={() => handleOpenShellWithCommand(
                SQUEUE_CHECK_CMD,
                'squeue-shortcut',
                'GPU Pending Queue squeue Command'
              )}
            >
              {copiedKey === 'squeue-shortcut' ? (
                <>
                  <Check size={15} />
                  <span>Copied! Opening Shell...</span>
                </>
              ) : (
                <>
                  <ExternalLink size={15} />
                  <span>Open Shell &amp; Run squeue</span>
                </>
              )}
            </button>
            <div className="hud-card-sub" style={{ textAlign: 'center', marginTop: '6px', fontSize: '0.72rem' }}>
              Auto-copies command &bull; paste in terminal
            </div>
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
                    <td colSpan={9} style={{ textAlign: 'center', padding: '48px 20px', color: 'var(--text-muted)' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
                        <Server size={36} color="var(--text-muted)" style={{ opacity: 0.5 }} />
                        <div style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                          {partitions.length === 0 ? 'No Cluster Partition Data Loaded' : 'No partitions matching current filter'}
                        </div>
                        <p style={{ fontSize: '0.85rem', maxWidth: '480px', margin: '0 auto', color: 'var(--text-muted)' }}>
                          {partitions.length === 0
                            ? 'Run the SLURM command in your PACE terminal and click "Paste Output" to populate real-time queue availability.'
                            : 'Try switching to another filter or clearing your search query.'}
                        </p>
                        {partitions.length === 0 && (
                          <div style={{ marginTop: '8px' }}>
                            <button className="btn btn-primary" style={{ fontSize: '0.8rem', padding: '6px 16px' }} onClick={() => setIsPasteModalOpen(true)}>
                              <FileText size={14} />
                              <span>Paste sinfo Output</span>
                            </button>
                          </div>
                        )}
                      </div>
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
                              handlePartitionChange(item.cleanPartition);
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
                PACE Phoenix SLURM Script Builder & Cost Estimator
              </h2>
              <p>Construct ready-to-run PACE SLURM job scripts and calculate real-time compute costs.</p>
            </div>

            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <button
                className="btn btn-gold-outline"
                style={{ fontSize: '0.8rem', padding: '6px 12px' }}
                onClick={resetToMotttExample}
                title="Load the MoTTT Blackwell fine-tuning example"
              >
                <RotateCcw size={14} />
                <span>Load MoTTT Example</span>
              </button>
            </div>
          </div>

          <div className="calculator-grid">
            {/* Input Column: Form Fields */}
            <div>
              <div className="script-section-title">
                <Server size={15} />
                <span>1. SLURM Allocation & Queue Directives</span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div className="calc-input-group">
                  <label>PACE Account (-A)</label>
                  <input
                    type="text"
                    className="calc-input"
                    value={sbatchAccount}
                    onChange={(e) => setSbatchAccount(e.target.value)}
                    placeholder="paceship-ulora"
                  />
                </div>

                <div className="calc-input-group">
                  <label>Quality of Service (--qos)</label>
                  <select
                    className="calc-select"
                    value={sbatchQos}
                    onChange={(e) => setSbatchQos(e.target.value)}
                  >
                    <option value="embers">embers</option>
                    <option value="inferno">inferno</option>
                  </select>
                </div>
              </div>

              <div className="calc-input-group">
                <label>Select GPU Architecture & Partition</label>
                <select
                  className="calc-select"
                  value={calcPartition}
                  onChange={(e) => handlePartitionChange(e.target.value)}
                >
                  <optgroup label="GPU Nodes">
                    {PACE_RATES.filter((r) => r.type === 'GPU').map((rate) => (
                      <option key={rate.id} value={rate.partition}>
                        {rate.classification} — {rate.hardwareName} (${rate.currentRate.toFixed(4)}/hr)
                      </option>
                    ))}
                  </optgroup>
                  <optgroup label="CPU Nodes">
                    {PACE_RATES.filter((r) => r.type === 'CPU').map((rate) => (
                      <option key={rate.id} value={rate.partition}>
                        {rate.classification} — {rate.hardwareName} (${rate.currentRate.toFixed(4)}/hr)
                      </option>
                    ))}
                  </optgroup>
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div className="calc-input-group">
                  <label>{selectedRate.type === 'GPU' ? 'Number of GPUs (--gres)' : 'Number of Tasks (-n)'}</label>
                  <input
                    type="number"
                    min={1}
                    max={64}
                    className="calc-input"
                    value={calcUnits}
                    onChange={(e) => handleUnitsChange(Math.max(1, parseInt(e.target.value, 10) || 1))}
                  />
                </div>

                <div className="calc-input-group">
                  <label>Nodes Count (-N)</label>
                  <input
                    type="number"
                    min={1}
                    max={32}
                    className="calc-input"
                    value={sbatchNodes}
                    onChange={(e) => setSbatchNodes(Math.max(1, parseInt(e.target.value, 10) || 1))}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div className="calc-input-group">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                    <label style={{ margin: 0 }}>CPU Cores per Node (-n)</label>
                    {selectedRate.type === 'GPU' && (
                      <span style={{ fontSize: '0.72rem', color: 'var(--gt-gold)', fontWeight: 600 }}>
                        {getCoresPerGpu(calcPartition)} cores/GPU
                      </span>
                    )}
                  </div>
                  <input
                    type="number"
                    min={1}
                    max={128}
                    className="calc-input"
                    value={sbatchCores}
                    onChange={(e) => setSbatchCores(Math.max(1, parseInt(e.target.value, 10) || 1))}
                  />
                  {selectedRate.type === 'GPU' && (
                    <div className="input-chip-group">
                      <button
                        type="button"
                        className={`chip-btn ${sbatchCores === getCoresPerGpu(calcPartition) * calcUnits ? 'active' : ''}`}
                        onClick={() => setSbatchCores(getCoresPerGpu(calcPartition) * calcUnits)}
                        title={`Reset to default allocation for ${calcUnits} GPU(s)`}
                      >
                        Auto: {getCoresPerGpu(calcPartition) * calcUnits}c
                      </button>
                      {[4, 6, 8, 16, 32].map((c) => (
                        <button
                          key={c}
                          type="button"
                          className={`chip-btn ${sbatchCores === c ? 'active' : ''}`}
                          onClick={() => setSbatchCores(c)}
                        >
                          {c}c
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div className="calc-input-group">
                  <label>RAM Allocation (--mem)</label>
                  <input
                    type="text"
                    className="calc-input"
                    value={sbatchMem}
                    onChange={(e) => setSbatchMem(e.target.value)}
                    placeholder="32G"
                  />
                  <div className="input-chip-group">
                    {['16G', '32G', '64G', '128G', '256G'].map((mem) => (
                      <button
                        key={mem}
                        type="button"
                        className={`input-chip ${sbatchMem === mem ? 'active' : ''}`}
                        onClick={() => setSbatchMem(mem)}
                      >
                        {mem}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="calc-input-group">
                <label>Job Walltime Limit (-t)</label>
                <input
                  type="text"
                  className="calc-input"
                  value={sbatchTime}
                  onChange={(e) => setSbatchTime(e.target.value)}
                  placeholder="01:00:00"
                />
                <div className="input-chip-group">
                  {[
                    { label: '1h', val: '01:00:00' },
                    { label: '4h', val: '04:00:00' },
                    { label: '12h', val: '12:00:00' },
                    { label: '24h', val: '24:00:00' },
                    { label: '2 Days', val: '2-00:00:00' },
                  ].map((preset) => (
                    <button
                      key={preset.val}
                      type="button"
                      className={`input-chip ${sbatchTime === preset.val ? 'active' : ''}`}
                      onClick={() => setSbatchTime(preset.val)}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div className="calc-input-group">
                  <label>Job Name (-J)</label>
                  <input
                    type="text"
                    className="calc-input"
                    value={sbatchJobName}
                    onChange={(e) => {
                      const newName = e.target.value;
                      setSbatchJobName(newName);
                      setSbatchOutput(`${newName}-%j.out`);
                    }}
                    placeholder="Mottt_FT_GSM8k"
                  />
                </div>

                <div className="calc-input-group">
                  <label>Output Log File (-o)</label>
                  <input
                    type="text"
                    className="calc-input"
                    value={sbatchOutput}
                    onChange={(e) => setSbatchOutput(e.target.value)}
                    placeholder="Mottt_FT_GSM8k-%j.out"
                  />
                </div>
              </div>

              <div className="script-section-title" style={{ marginTop: '24px' }}>
                <Terminal size={15} />
                <span>2. Working Directory & Execution Setup</span>
              </div>

              <div className="calc-input-group">
                <label>Working Directory (cd)</label>
                <input
                  type="text"
                  className="calc-input"
                  value={sbatchWorkdir}
                  onChange={(e) => setSbatchWorkdir(e.target.value)}
                  placeholder="/storage/project/ps-ulora-0/dliu450/MoTTT"
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
                <div className="calc-input-group">
                  <label>Module to Load</label>
                  <input
                    type="text"
                    className="calc-input"
                    value={sbatchModule}
                    onChange={(e) => setSbatchModule(e.target.value)}
                    placeholder="anaconda3"
                  />
                </div>

                <div className="calc-input-group">
                  <label>Conda Environment Name</label>
                  <input
                    type="text"
                    className="calc-input"
                    value={sbatchCondaEnv}
                    onChange={(e) => setSbatchCondaEnv(e.target.value)}
                    placeholder="mottt"
                  />
                </div>

                <div className="calc-input-group">
                  <label>Conda Environment Parameters</label>
                  <input
                    type="text"
                    className="calc-input"
                    value={sbatchCondaParams}
                    onChange={(e) => setSbatchCondaParams(e.target.value)}
                    placeholder="e.g. --stack, --no-capture-output"
                  />
                </div>
              </div>

              <div className="calc-input-group">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <label style={{ margin: 0 }}>Conda Environment Variables / Exports (Optional)</label>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button
                      type="button"
                      style={{
                        background: 'rgba(255,255,255,0.06)',
                        border: '1px solid var(--border-color)',
                        borderRadius: '4px',
                        color: 'var(--text-secondary)',
                        fontSize: '0.72rem',
                        padding: '2px 8px',
                        cursor: 'pointer'
                      }}
                      onClick={() => setSbatchEnvVars(prev => prev ? `${prev}\nexport PYTHONUNBUFFERED=1` : 'export PYTHONUNBUFFERED=1')}
                    >
                      + PYTHONUNBUFFERED
                    </button>
                    <button
                      type="button"
                      style={{
                        background: 'rgba(255,255,255,0.06)',
                        border: '1px solid var(--border-color)',
                        borderRadius: '4px',
                        color: 'var(--text-secondary)',
                        fontSize: '0.72rem',
                        padding: '2px 8px',
                        cursor: 'pointer'
                      }}
                      onClick={() => setSbatchEnvVars(prev => prev ? `${prev}\nexport CUDA_VISIBLE_DEVICES=0` : 'export CUDA_VISIBLE_DEVICES=0')}
                    >
                      + CUDA_VISIBLE_DEVICES
                    </button>
                  </div>
                </div>
                <input
                  type="text"
                  className="calc-input"
                  value={sbatchEnvVars}
                  onChange={(e) => setSbatchEnvVars(e.target.value)}
                  placeholder="e.g. export PYTHONUNBUFFERED=1 or export HF_HOME=/storage/project/..."
                />
              </div>

              <div className="calc-input-group">
                <label>Execution Command / Python Script</label>
                <textarea
                  className="textarea-field"
                  style={{ height: '100px', marginBottom: '0' }}
                  value={sbatchCommand}
                  onChange={(e) => setSbatchCommand(e.target.value)}
                  placeholder="python experiments/gsm8k/train_full_finetune.py \"
                />
              </div>
            </div>

            {/* Output Column: Live Cost Estimation & Script Preview */}
            <div>
              <div className="calc-summary-box">
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700 }}>
                      Live Cost Estimation
                    </div>
                    <span style={{ fontSize: '0.75rem', color: 'var(--gt-gold)', background: 'rgba(234,170,0,0.12)', padding: '2px 8px', borderRadius: '4px', border: '1px solid rgba(234,170,0,0.3)' }}>
                      Walltime: {effectiveHours.toFixed(1)} hrs
                    </span>
                  </div>

                  <div className="cost-comparison-row">
                    <div>
                      <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Current Internal Rate</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        ${selectedRate.currentRate.toFixed(4)} / {selectedRate.consumableUnit}
                      </div>
                    </div>
                    <div className="cost-val" style={{ color: '#38bdf8' }}>${currentTotalCost}</div>
                  </div>

                  <div className="cost-comparison-row">
                    <div>
                      <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Post-Oct 1, 2026 Rate</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        ${selectedRate.postOct2026Rate.toFixed(4)} / {selectedRate.consumableUnit}
                      </div>
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
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', flexWrap: 'wrap', gap: '8px' }}>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 700 }}>
                      Generated SLURM Job Script
                    </span>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button
                        className="btn btn-secondary"
                        style={{ fontSize: '0.75rem', padding: '4px 10px' }}
                        onClick={() => handleCopy(generatedSlurmScript, 'slurm-script')}
                      >
                        {copiedKey === 'slurm-script' ? <Check size={12} /> : <Copy size={12} />}
                        <span>{copiedKey === 'slurm-script' ? 'Copied' : 'Copy Script'}</span>
                      </button>
                      <button
                        className="btn btn-primary"
                        style={{ fontSize: '0.75rem', padding: '4px 10px' }}
                        onClick={handleDownloadScript}
                      >
                        <Download size={12} />
                        <span>Download .sbatch</span>
                      </button>
                    </div>
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
                    onClick={() => handlePartitionChange(gpu.partition)}
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

      {/* Shell Auto-Copy Floating Notification Toast */}
      {shellToast && (
        <aside
          role="status"
          aria-live="polite"
          style={{
            position: 'fixed',
            bottom: '24px',
            right: '24px',
            zIndex: 9999,
            background: 'rgba(15, 23, 42, 0.96)',
            backdropFilter: 'blur(16px)',
            border: '1px solid var(--gt-gold)',
            borderRadius: '10px',
            padding: '14px 18px',
            boxShadow: '0 12px 32px rgba(0, 0, 0, 0.6), 0 0 20px rgba(234, 170, 0, 0.25)',
            maxWidth: '460px',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '12px',
            animation: 'fadeIn 0.25s ease'
          }}
        >
          <CheckCircle2 size={22} color="var(--gt-gold)" style={{ flexShrink: 0, marginTop: '2px' }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#fff', marginBottom: '3px' }}>
              Command Copied to Clipboard!
            </div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.45 }}>
              PACE Open OnDemand Shell opened in a new tab. Press <kbd style={{ background: '#1e293b', border: '1px solid #334155', padding: '1px 6px', borderRadius: '4px', color: '#f8fafc', fontWeight: 600 }}>Ctrl+V</kbd> or <kbd style={{ background: '#1e293b', border: '1px solid #334155', padding: '1px 6px', borderRadius: '4px', color: '#f8fafc', fontWeight: 600 }}>Cmd+V</kbd> inside the shell to paste &amp; run:
            </div>
            <div
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '0.72rem',
                background: 'rgba(0,0,0,0.5)',
                padding: '6px 8px',
                borderRadius: '4px',
                marginTop: '6px',
                color: 'var(--gt-gold)',
                wordBreak: 'break-all'
              }}
            >
              {shellToast.cmd}
            </div>
          </div>
          <button
            onClick={() => setShellToast(null)}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              fontSize: '1.25rem',
              lineHeight: 1,
              padding: '0 4px'
            }}
            title="Dismiss notification"
          >
            &times;
          </button>
        </aside>
      )}
    </div>
  );
}
