import { execSync } from 'node:child_process';
import os from 'node:os';

type Status = 'ok' | 'warning' | 'error';

function run(cmd: string): string {
  try {
    return execSync(cmd, { stdio: ['ignore', 'pipe', 'pipe'] }).toString('utf8').trim();
  } catch (error) {
    return `Command failed: ${cmd}\n${String(error)}`;
  }
}

function printSection(title: string, content: string) {
  console.log(`\n=== ${title} ===`);
  console.log(content || 'No data');
}

function assessHealth(percent: number | null, cycleCount: number | null, healthPercent: number | null): { status: Status; notes: string[] } {
  const notes: string[] = [];
  let status: Status = 'ok';

  if (percent !== null) {
    if (percent < 20) {
      status = 'warning';
      notes.push('Battery level is below 20%. Charge soon to avoid deep discharge.');
    } else {
      notes.push(`Battery level is ${percent}%.`);
    }
  }

  if (healthPercent !== null) {
    if (healthPercent < 80) {
      status = 'warning';
      notes.push(`Battery health is ${healthPercent}%, which suggests notable wear.`);
    } else {
      notes.push(`Battery health is ${healthPercent}%.`);
    }
  }

  if (cycleCount !== null) {
    if (cycleCount > 1000) {
      status = 'warning';
      notes.push(`Cycle count is ${cycleCount}, likely near or above common design targets.`);
    } else {
      notes.push(`Cycle count is ${cycleCount}.`);
    }
  }

  if (notes.length === 0) {
    status = 'error';
    notes.push('Unable to parse battery metrics automatically on this machine.');
  }

  return { status, notes };
}

function parseFirstNumber(input: string, labelRegex: RegExp): number | null {
  const match = input.match(labelRegex);
  if (!match) return null;
  const num = Number.parseFloat(match[1]);
  return Number.isNaN(num) ? null : num;
}

function linuxReport() {
  const upowerDevices = run('upower -e');
  printSection('Linux: upower devices', upowerDevices);

  const batteryDevice = upowerDevices
    .split('\n')
    .find((line) => line.includes('battery'));

  let details = '';
  if (batteryDevice && !batteryDevice.startsWith('Command failed')) {
    details = run(`upower -i ${batteryDevice}`);
  } else {
    details = run('ls /sys/class/power_supply && for b in /sys/class/power_supply/BAT*; do [ -e "$b" ] && echo "--- $b" && cat "$b/capacity"; done');
  }

  printSection('Linux: battery details', details);

  const percent = parseFirstNumber(details, /percentage:\s*([\d.]+)/i) ?? parseFirstNumber(details, /\n([\d.]+)\n?/);
  const cycle = parseFirstNumber(details, /cycle count:\s*(\d+)/i);
  const health = parseFirstNumber(details, /capacity:\s*([\d.]+)%/i);

  return assessHealth(percent, cycle, health);
}

function macReport() {
  const pmset = run('pmset -g batt');
  const systemProfiler = run('system_profiler SPPowerDataType');
  printSection('macOS: pmset', pmset);
  printSection('macOS: system_profiler', systemProfiler);

  const percent = parseFirstNumber(pmset, /(\d+)%/);
  const cycle = parseFirstNumber(systemProfiler, /Cycle Count:\s*(\d+)/i);
  const health = parseFirstNumber(systemProfiler, /Maximum Capacity:\s*(\d+)%/i);

  return assessHealth(percent, cycle, health);
}

function windowsReport() {
  const reportPath = `${process.cwd()}\\battery-report.html`;
  const powercfg = run(`powercfg /batteryreport /output "${reportPath}"`);
  const wmics = run('wmic path Win32_Battery get EstimatedChargeRemaining,BatteryStatus /format:list');
  printSection('Windows: powercfg', powercfg);
  printSection('Windows: WMIC', wmics);

  const percent = parseFirstNumber(wmics, /EstimatedChargeRemaining=(\d+)/i);
  return assessHealth(percent, null, null);
}

function usageAdvice() {
  return [
    'Keep battery between 20% and 80% when possible.',
    'Avoid sustained high temperature and heavy load while charging.',
    'Use the original charger and a healthy power outlet.',
    'If available, enable optimized charging in OS settings.',
  ];
}

function main() {
  console.log(`Battery diagnostic report`);
  console.log(`Host: ${os.hostname()} (${os.platform()} ${os.release()})`);
  console.log(`Time: ${new Date().toISOString()}`);

  const platform = process.platform;
  const result = platform === 'linux' ? linuxReport() : platform === 'darwin' ? macReport() : windowsReport();

  printSection('Assessment', `Status: ${result.status}\n- ${result.notes.join('\n- ')}`);
  printSection('Usage advice', usageAdvice().map((note) => `- ${note}`).join('\n'));
}

main();
