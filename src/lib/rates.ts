export interface ComputeRate {
  id: string;
  classification: string;
  partition: string;
  type: 'GPU' | 'CPU';
  consumableUnit: 'GPU Hour' | 'CPU Hour';
  currentRate: number;
  postOct2026Rate: number;
  hardwareName: string;
  description: string;
  vramOrSpec?: string;
  recommendedFor?: string;
  gresType?: string;
}

export const PACE_RATES: ComputeRate[] = [
  // GPU Nodes
  {
    id: 'gpu-v100',
    classification: '[GEN] gpu-v100',
    partition: 'gpu-v100',
    type: 'GPU',
    consumableUnit: 'GPU Hour',
    currentRate: 0.2307,
    postOct2026Rate: 0.2894,
    hardwareName: 'NVIDIA Tesla V100',
    description: 'Volta architecture with 16GB/32GB HBM2 memory. Great for legacy CUDA models and mid-sized ML training.',
    vramOrSpec: '16/32 GB VRAM',
    recommendedFor: 'Mid-scale Deep Learning, Molecular Dynamics, CUDA workloads',
    gresType: 'v100',
  },
  {
    id: 'gpu-rtx6000',
    classification: '[GEN] gpu-rtx6000',
    partition: 'gpu-rtx6000',
    type: 'GPU',
    consumableUnit: 'GPU Hour',
    currentRate: 0.1491,
    postOct2026Rate: 0.1303,
    hardwareName: 'NVIDIA Quadro RTX 6000 / Ada',
    description: 'High graphics & compute capability with 24GB GDDR6. Only node with a rate DECREASE (-12.6%) post-Oct 2026!',
    vramOrSpec: '24 GB VRAM',
    recommendedFor: 'Cost-effective training, Rendering, Computer Vision, GNNs',
    gresType: 'rtx6000',
  },
  {
    id: 'gpu-a100',
    classification: '[GEN] gpu-a100',
    partition: 'gpu-a100',
    type: 'GPU',
    consumableUnit: 'GPU Hour',
    currentRate: 0.2769,
    postOct2026Rate: 0.5016,
    hardwareName: 'NVIDIA A100 Tensor Core',
    description: 'Ampere flagship GPU with 40GB/80GB high-bandwidth memory. Superb FP32 Tensor Core performance.',
    vramOrSpec: '40/80 GB HBM2e',
    recommendedFor: 'Transformer Training, LLM Fine-Tuning, Multi-GPU Distributed ML',
    gresType: 'a100',
  },
  {
    id: 'gpu-h100',
    classification: '[GEN] gpu-h100',
    partition: 'gpu-h100',
    type: 'GPU',
    consumableUnit: 'GPU Hour',
    currentRate: 0.6730,
    postOct2026Rate: 0.9488,
    hardwareName: 'NVIDIA H100 SXM5 / PCIe',
    description: 'Hopper architecture with Transformer Engine and 80GB HBM3. Top-tier throughput for large-scale generative AI.',
    vramOrSpec: '80 GB HBM3',
    recommendedFor: 'Large Language Model Pretraining, Diffusion Models, Billion-parameter Workloads',
    gresType: 'h100',
  },
  {
    id: 'gpu-h200',
    classification: '[GEN] gpu-h200',
    partition: 'gpu-h200',
    type: 'GPU',
    consumableUnit: 'GPU Hour',
    currentRate: 0.6730,
    postOct2026Rate: 1.4135,
    hardwareName: 'NVIDIA H200 Tensor Core',
    description: 'Ultra-fast Hopper with massive 141GB HBM3e at 4.8 TB/s. Currently billed at H100 rates, adjusting to $1.41/hr post-Oct 2026.',
    vramOrSpec: '141 GB HBM3e',
    recommendedFor: 'Extreme Memory LLM Inference, 70B+ Model Training without offloading',
    gresType: 'h200',
  },
  {
    id: 'gpu-l40s',
    classification: '[GEN] gpu-l40s',
    partition: 'gpu-l40s',
    type: 'GPU',
    consumableUnit: 'GPU Hour',
    currentRate: 0.2167,
    postOct2026Rate: 0.3444,
    hardwareName: 'NVIDIA L40S Ada Lovelace',
    description: 'Powerful universal GPU with 48GB GDDR6 with ECC. Exceptional price-to-performance for multimodal AI & inference.',
    vramOrSpec: '48 GB GDDR6 ECC',
    recommendedFor: 'High-throughput LLM Inference, Image Generation, 48GB Fine-Tuning',
    gresType: 'l40s',
  },
  {
    id: 'gpu-rtxpro-blackwell',
    classification: '[GEN] gpu-rtxpro-blackwell',
    partition: 'gpu-rtxpro-blackwell',
    type: 'GPU',
    consumableUnit: 'GPU Hour',
    currentRate: 0.3585,
    postOct2026Rate: 0.4596,
    hardwareName: 'NVIDIA RTX Pro Blackwell',
    description: 'Next-generation Blackwell architecture for workstations and high-density compute.',
    vramOrSpec: 'Blackwell Generation',
    recommendedFor: 'Next-gen Tensor Core workloads, mixed-precision AI simulations',
    gresType: 'rtx_pro_6000_blackwell',
  },

  // CPU Nodes
  {
    id: 'cpu-small',
    classification: '[GEN] cpu-small',
    partition: 'cpu-small',
    type: 'CPU',
    consumableUnit: 'CPU Hour',
    currentRate: 0.0068,
    postOct2026Rate: 0.0082,
    hardwareName: 'Standard Small Core Node',
    description: 'General purpose small core queue (~24 cores, ~192GB RAM). Default partition for Phoenix.',
    vramOrSpec: '~24 Cores / 192GB',
    recommendedFor: 'Light compute, preprocessing, compilation, single-node jobs',
  },
  {
    id: 'cpu-medium',
    classification: '[GEN] cpu-medium',
    partition: 'cpu-medium',
    type: 'CPU',
    consumableUnit: 'CPU Hour',
    currentRate: 0.0077,
    postOct2026Rate: 0.0099,
    hardwareName: 'Medium Memory & Core Node',
    description: 'Balanced multicore queue (~48 cores, ~384GB RAM).',
    vramOrSpec: '~48 Cores / 384GB',
    recommendedFor: 'Multi-threaded CPU pipelines, bioinformatics, CFD',
  },
  {
    id: 'cpu-large',
    classification: '[GEN] cpu-large',
    partition: 'cpu-large',
    type: 'CPU',
    consumableUnit: 'CPU Hour',
    currentRate: 0.0091,
    postOct2026Rate: 0.0111,
    hardwareName: 'High-Density Compute Node',
    description: 'High core count node pool (~96 cores, ~768GB RAM).',
    vramOrSpec: '~96 Cores / 768GB',
    recommendedFor: 'Large memory in-memory analytics, dense OpenMP jobs',
  },
  {
    id: 'cpu-sas',
    classification: '[GEN] cpu-sas',
    partition: 'cpu-sas',
    type: 'CPU',
    consumableUnit: 'CPU Hour',
    currentRate: 0.0091,
    postOct2026Rate: 0.0131,
    hardwareName: 'High I/O SAS Storage Node',
    description: 'Fast local SAS scratch drive compute node.',
    vramOrSpec: 'High I/O Scratch',
    recommendedFor: 'I/O-intensive datasets, data preparation, local disk caching',
  },
  {
    id: 'cpu-amd',
    classification: '[GEN] cpu-amd',
    partition: 'cpu-amd',
    type: 'CPU',
    consumableUnit: 'CPU Hour',
    currentRate: 0.0027,
    postOct2026Rate: 0.0027,
    hardwareName: 'AMD EPYC High Throughput Node',
    description: 'Lowest cost per core ($0.0027/hr, rate unchanged post-Oct 2026). Excellent throughput.',
    vramOrSpec: 'AMD EPYC Zen Cores',
    recommendedFor: 'Embarrassingly parallel batches, Monte Carlo simulations, high throughput',
  },
  {
    id: 'cpu-gnr',
    classification: '[GEN] cpu-gnr',
    partition: 'cpu-gnr',
    type: 'CPU',
    consumableUnit: 'CPU Hour',
    currentRate: 0.0042,
    postOct2026Rate: 0.0075,
    hardwareName: 'Granite Rapids / Next-Gen Xeon',
    description: 'Modern high-performance compute architecture with DDR5 & AMX acceleration.',
    vramOrSpec: 'Modern Intel Xeon',
    recommendedFor: 'Vectorized numerics, AVX-512 / AMX matrix acceleration',
  },
];

export function getRateForPartition(partitionName: string): ComputeRate | undefined {
  const clean = partitionName.replace(/\*$/, '').toLowerCase().trim();
  return PACE_RATES.find((r) => r.partition.toLowerCase() === clean || r.id.toLowerCase() === clean);
}

export function calculateRateDelta(current: number, future: number) {
  const diff = future - current;
  const pct = ((diff / current) * 100);
  return {
    diff,
    percentage: pct,
    isIncrease: diff > 0.00001,
    isDecrease: diff < -0.00001,
    isUnchanged: Math.abs(diff) <= 0.00001,
  };
}
