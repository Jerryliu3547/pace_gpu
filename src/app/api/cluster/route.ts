import { NextRequest, NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';
import { parseSinfoOutput, DEMO_SINFO_OUTPUT } from '@/lib/slurm-parser';

const execAsync = promisify(exec);

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const isDemo = searchParams.get('demo') === 'true';
  const customUser = searchParams.get('user') || process.env.PACE_USER || 'dliu450';
  const host = process.env.PACE_HOST || 'login-phoenix.pace.gatech.edu';

  if (isDemo) {
    const partitions = parseSinfoOutput(DEMO_SINFO_OUTPUT);
    return NextResponse.json({
      success: true,
      connected: true,
      isDemo: true,
      timestamp: new Date().toISOString(),
      rawOutput: DEMO_SINFO_OUTPUT,
      partitions,
      user: customUser,
      host,
    });
  }

  // SSH command to PACE Phoenix
  const sshCmd = `ssh -o ConnectTimeout=4 -o BatchMode=yes -o StrictHostKeyChecking=accept-new ${customUser}@${host} 'sinfo -o "%20P %10c %10m %25F" | grep -E "^PARTITION|^gpu|^cpu"'`;

  try {
    const { stdout, stderr } = await execAsync(sshCmd, { timeout: 6000 });
    const partitions = parseSinfoOutput(stdout);

    return NextResponse.json({
      success: true,
      connected: true,
      isDemo: false,
      timestamp: new Date().toISOString(),
      rawOutput: stdout,
      partitions,
      user: customUser,
      host,
    });
  } catch (error: any) {
    const stderrText = error.stderr || error.message || 'SSH connection failed';
    return NextResponse.json(
      {
        success: false,
        connected: false,
        isDemo: false,
        timestamp: new Date().toISOString(),
        error: 'Unable to reach PACE Phoenix via SSH. Please ensure you are connected to Georgia Tech VPN and have an authorized SSH key configured.',
        details: stderrText,
        user: customUser,
        host,
        ondemandUrl: 'https://ondemand-phoenix.pace.gatech.edu/pun/sys/shell/ssh/login-phoenix.pace.gatech.edu',
        suggestedCommand: `ssh ${customUser}@${host} 'sinfo -o "%20P %10c %10m %25F" | grep -E "^PARTITION|^gpu"'`,
      },
      { status: 200 } // Return 200 so UI can present the friendly disconnected screen smoothly
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const rawOutput = body.rawOutput || '';
    if (!rawOutput.trim()) {
      return NextResponse.json({ success: false, error: 'Raw output string is empty' }, { status: 400 });
    }

    const partitions = parseSinfoOutput(rawOutput);
    return NextResponse.json({
      success: true,
      connected: true,
      isManualPaste: true,
      timestamp: new Date().toISOString(),
      rawOutput,
      partitions,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
