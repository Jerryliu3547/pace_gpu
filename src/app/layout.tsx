import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'PACE Phoenix GPU Monitor & Rate Calculator | Georgia Tech HPC',
  description:
    'Live GPU partition availability telemetry and official General Research computing rates for the Georgia Tech PACE Phoenix cluster.',
  keywords: [
    'PACE Phoenix',
    'Georgia Tech',
    'GPU Availability',
    'SLURM',
    'Compute Rates',
    'A100',
    'H100',
    'H200',
    'L40S',
    'RTX 6000',
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
