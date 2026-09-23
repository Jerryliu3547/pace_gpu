import { ComputeRate, getRateForPartition } from './rates';

export interface SlurmPartitionNode {
  partition: string;
  cleanPartition: string;
  isDefault: boolean;
  cpus: string;
  memoryMb: string;
  memoryFormatted: string;
  nodesAllocated: number;
  nodesIdle: number;
  nodesOther: number;
  nodesTotal: number;
  isAvailable: boolean;
  availabilityRatio: number; // 0 to 1
  rate?: ComputeRate;
}

export function formatMemory(mbStr: string): string {
  const isPlus = mbStr.includes('+');
  const num = parseInt(mbStr.replace(/[^0-9]/g, ''), 10);
  if (isNaN(num)) return mbStr;

  if (num >= 1000000) {
    const tb = (num / 1024 / 1024).toFixed(1);
    return `~${tb} TB${isPlus ? '+' : ''}`;
  }
  const gb = Math.round(num / 1024);
  return `~${gb} GB${isPlus ? '+' : ''}`;
}

export function parseSinfoOutput(rawOutput: string): SlurmPartitionNode[] {
  const lines = rawOutput.split('\n');
  const parsedNodes: SlurmPartitionNode[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (trimmed.toUpperCase().startsWith('PARTITION')) continue;

    // Tokens typically split by whitespace
    const parts = trimmed.split(/\s+/);
    if (parts.length < 4) continue;

    const partitionRaw = parts[0];
    const cpus = parts[1];
    const memoryMb = parts[2];
    const nodesRatio = parts[3];

    const isDefault = partitionRaw.endsWith('*');
    const cleanPartition = partitionRaw.replace(/\*$/, '');

    // Format for nodes ratio is A/I/O/T (Allocated / Idle / Other / Total)
    const ratioParts = nodesRatio.split('/');
    if (ratioParts.length !== 4) continue;

    const allocated = parseInt(ratioParts[0], 10) || 0;
    const idle = parseInt(ratioParts[1], 10) || 0;
    const other = parseInt(ratioParts[2], 10) || 0;
    const total = parseInt(ratioParts[3], 10) || 0;

    const isAvailable = idle > 0;
    const availabilityRatio = total > 0 ? idle / total : 0;
    const rate = getRateForPartition(cleanPartition);

    parsedNodes.push({
      partition: partitionRaw,
      cleanPartition,
      isDefault,
      cpus,
      memoryMb,
      memoryFormatted: formatMemory(memoryMb),
      nodesAllocated: allocated,
      nodesIdle: idle,
      nodesOther: other,
      nodesTotal: total,
      isAvailable,
      availabilityRatio,
      rate,
    });
  }

  return parsedNodes;
}
