import { Gmc4System, assemble, parseHex } from './gmc4.js';

const system = new Gmc4System();
const runner = {
  running: false,
  timer: null,
};

const keyMap = new Map([
  ['z', 0x0],
  ['x', 0x1],
  ['c', 0x2],
  ['v', 0x3],
  ['a', 0x4],
  ['s', 0x5],
  ['d', 0x6],
  ['f', 0x7],
  ['q', 0x8],
  ['w', 0x9],
  ['e', 0xa],
  ['r', 0xb],
  ['1', 0xc],
  ['2', 0xd],
  ['3', 0xe],
  ['4', 0xf],
]);

const sourceInput = document.querySelector('#sourceInput');
const statusText = document.querySelector('#statusText');
const pcText = document.querySelector('#pcText');
const instText = document.querySelector('#instText');
const soundText = document.querySelector('#soundText');
const sevenSegment = document.querySelector('#sevenSegment');
const ledBank = document.querySelector('#ledBank');
const registerGrid = document.querySelector('#registerGrid');
const memoryGrid = document.querySelector('#memoryGrid');
const keyboardGrid = document.querySelector('#keyboardGrid');
const machineCodeInput = document.querySelector('#machineCodeInput');
const serialStatus = document.querySelector('#serialStatus');
const serialLog = document.querySelector('#serialLog');
const baudRateSelect = document.querySelector('#baudRateSelect');
const serialFormatSelect = document.querySelector('#serialFormatSelect');
const lineEndingSelect = document.querySelector('#lineEndingSelect');
const flashPageSelect = document.querySelector('#flashPageSelect');
const serialCommandInput = document.querySelector('#serialCommandInput');
const connectSerialButton = document.querySelector('#connectSerialButton');
const disconnectSerialButton = document.querySelector('#disconnectSerialButton');
const sendProgramButton = document.querySelector('#sendProgramButton');
const sendCommandButton = document.querySelector('#sendCommandButton');
const saveFlashButton = document.querySelector('#saveFlashButton');
const runButton = document.querySelector('#runButton');

const serial = {
  port: null,
  reader: null,
  keepReading: false,
};

let currentProgram = [];

function reset() {
  stop();
  system.reset({ clearRam: currentProgram.length === 0 });
  setStatus('Reset');
  render();
}

function loadProgram(bytes, label) {
  stop();
  currentProgram = bytes.slice(0, 0x60);
  system.loadProgram(bytes);
  setStatus(`${label}: ${bytes.length} nibbles loaded`);
  renderMachineCode();
  render();
}

function stepOnce() {
  try {
    system.step();
    render();
  } catch (error) {
    stop();
    setStatus(error.message);
  }
}

function run() {
  if (runner.running) {
    stop();
    return;
  }
  runner.running = true;
  runButton.textContent = 'Stop Emulator';
  runner.timer = window.setInterval(() => {
    for (let i = 0; i < 8; i += 1) stepOnce();
  }, 120);
}

function stop() {
  runner.running = false;
  if (runner.timer) window.clearInterval(runner.timer);
  runner.timer = null;
  runButton.textContent = 'Run Emulator';
}

async function connectSerial() {
  if (!('serial' in navigator)) {
    serialStatus.textContent = 'このブラウザは Web Serial API に未対応です。Chrome/Edge系で確認してください。';
    return;
  }

  serial.port = await navigator.serial.requestPort();
  await serial.port.open({
    baudRate: Number.parseInt(baudRateSelect.value, 10),
    dataBits: 8,
    stopBits: 1,
    parity: 'none',
    flowControl: 'none',
  });

  const info = serial.port.getInfo();
  serialStatus.textContent = `Connected: vendor=${info.usbVendorId ?? 'unknown'}, product=${info.usbProductId ?? 'unknown'}`;
  appendSerialLog('SYS', `connected @ ${baudRateSelect.value}bps`);
  setSerialConnected(true);
  readSerialLoop();
}

async function disconnectSerial() {
  serial.keepReading = false;
  if (serial.reader) {
    await serial.reader.cancel().catch(() => {});
  }
  if (serial.port) {
    await serial.port.close().catch(() => {});
  }
  serial.reader = null;
  serial.port = null;
  serialStatus.textContent = 'Disconnected';
  appendSerialLog('SYS', 'disconnected');
  setSerialConnected(false);
}

async function readSerialLoop() {
  const decoder = new TextDecoder();
  serial.keepReading = true;

  while (serial.port?.readable && serial.keepReading) {
    serial.reader = serial.port.readable.getReader();
    try {
      while (serial.keepReading) {
        const { value, done } = await serial.reader.read();
        if (done) break;
        if (value) appendSerialLog('RX', decoder.decode(value));
      }
    } catch (error) {
      appendSerialLog('ERR', error.message);
    } finally {
      serial.reader.releaseLock();
      serial.reader = null;
    }
  }
}

async function writeSerial(text) {
  if (!serial.port?.writable) {
    serialStatus.textContent = 'Serial port is not connected';
    return;
  }

  const writer = serial.port.writable.getWriter();
  try {
    await writer.write(new TextEncoder().encode(text));
    appendSerialLog('TX', printable(text));
  } finally {
    writer.releaseLock();
  }
}

function setSerialConnected(connected) {
  connectSerialButton.disabled = connected;
  disconnectSerialButton.disabled = !connected;
  sendProgramButton.disabled = false;
  sendCommandButton.disabled = !connected;
  saveFlashButton.disabled = !connected;
  document.querySelectorAll('.monitor-command').forEach((button) => {
    button.disabled = !connected;
  });
  baudRateSelect.disabled = connected;
}

function appendSerialLog(type, message) {
  const time = new Date().toLocaleTimeString();
  serialLog.textContent += `[${time}] ${type} ${message}\n`;
  serialLog.scrollTop = serialLog.scrollHeight;
}

function printable(text) {
  return text.replace(/\r/g, '\\r').replace(/\n/g, '\\n');
}

function lineEnding() {
  return lineEndingSelect.value.replace('\\r', '\r').replace('\\n', '\n');
}

function formatProgramForSerial() {
  const nibbles = parseHex(machineCodeInput.value);
  currentProgram = nibbles.slice(0, 0x60);
  if (serialFormatSelect.value === 'spaced') {
    return nibbles.map((value) => value.toString(16).toUpperCase()).join(' ');
  }
  const compact = nibbles.map((value) => value.toString(16).toUpperCase()).join('');
  if (serialFormatSelect.value === 'monitor') {
    return `e00:${compact}`;
  }
  return compact;
}

function renderMachineCode() {
  if (currentProgram.length === 0) {
    machineCodeInput.value = '';
    return;
  }
  machineCodeInput.value = currentProgram.map((value) => value.toString(16).toUpperCase()).join(' ');
}

function render() {
  const snapshot = system.snapshot();
  pcText.textContent = `PC: ${hex2(snapshot.pc)}`;
  instText.textContent = `INST: ${snapshot.inst.toString(16).toUpperCase()}`;
  soundText.textContent = snapshot.lastSound ? `SOUND: ${snapshot.lastSound}` : 'SOUND: -';

  sevenSegment.innerHTML = Array.from(snapshot.segments)
    .map((enabled, index) => `<span class="seg seg-${index}${enabled ? ' on' : ''}"></span>`)
    .join('');

  ledBank.innerHTML = Array.from(snapshot.led, (enabled, index) => {
    return `<span class="led${enabled ? ' on' : ''}" title="LED ${index}"></span>`;
  }).join('');

  const registers = [
    ['A', snapshot.a],
    ['B', snapshot.b],
    ['Y', snapshot.y],
    ['Z', snapshot.z],
    ["A'", snapshot.ap],
    ["B'", snapshot.bp],
    ["Y'", snapshot.yp],
    ["Z'", snapshot.zp],
    ['F', snapshot.flag],
    ['KEY', snapshot.keyFlag ? snapshot.key : '-'],
  ];

  registerGrid.innerHTML = registers
    .map(([label, value]) => `<div class="register"><span>${label}</span>${formatRegister(value)}</div>`)
    .join('');

  memoryGrid.innerHTML = Array.from({ length: 0x60 }, (_, index) => {
    const active = index === snapshot.pc ? ' active' : '';
    const data = snapshot.ram[index].toString(16).toUpperCase();
    return `<div class="memory-cell${active}" title="${hex2(index)}">${data}</div>`;
  }).join('');

  keyboardGrid.querySelectorAll('button').forEach((button) => {
    const value = Number.parseInt(button.dataset.keyValue, 16);
    button.classList.toggle('active', snapshot.keyFlag && snapshot.key === value);
  });
}

function buildKeyboard() {
  const labels = [
    ['C', 'D', 'E', 'F'],
    ['8', '9', 'A', 'B'],
    ['4', '5', '6', '7'],
    ['0', '1', '2', '3'],
  ];

  keyboardGrid.innerHTML = labels
    .flat()
    .map((label) => `<button type="button" data-key-value="${label}">${label}</button>`)
    .join('');

  keyboardGrid.addEventListener('pointerdown', (event) => {
    const button = event.target.closest('button');
    if (!button) return;
    system.pressKey(Number.parseInt(button.dataset.keyValue, 16));
    render();
  });

  keyboardGrid.addEventListener('pointerup', () => {
    system.releaseKey();
    render();
  });
}

function formatRegister(value) {
  return typeof value === 'number' ? value.toString(16).toUpperCase() : value;
}

function hex2(value) {
  return value.toString(16).toUpperCase().padStart(2, '0');
}

function setStatus(message) {
  statusText.textContent = message;
}

document.querySelector('#assembleButton').addEventListener('click', () => {
  try {
    currentProgram = assemble(sourceInput.value).slice(0, 0x60);
    renderMachineCode();
    setStatus(`Assembly: ${currentProgram.length} nibbles ready`);
  } catch (error) {
    setStatus(error.message);
  }
});

document.querySelector('#loadMachineCodeButton').addEventListener('click', () => {
  loadProgram(parseHex(machineCodeInput.value), 'Machine Code');
});

document.querySelector('#stepButton').addEventListener('click', stepOnce);
document.querySelector('#runButton').addEventListener('click', run);
document.querySelector('#resetButton').addEventListener('click', reset);
connectSerialButton.addEventListener('click', () => {
  connectSerial().catch((error) => {
    serialStatus.textContent = error.message;
    appendSerialLog('ERR', error.message);
  });
});
disconnectSerialButton.addEventListener('click', () => {
  disconnectSerial().catch((error) => appendSerialLog('ERR', error.message));
});
sendProgramButton.addEventListener('click', () => {
  sendMachineCodeToHardware().catch((error) => appendSerialLog('ERR', error.message));
});
sendCommandButton.addEventListener('click', () => {
  writeSerial(`${serialCommandInput.value}${lineEnding()}`).catch((error) => appendSerialLog('ERR', error.message));
  serialCommandInput.value = '';
});
saveFlashButton.addEventListener('click', () => {
  writeSerial(`w${flashPageSelect.value}${lineEnding()}`).catch((error) => appendSerialLog('ERR', error.message));
});
document.querySelectorAll('.monitor-command').forEach((button) => {
  button.addEventListener('click', () => {
    writeSerial(`${button.dataset.command}${lineEnding()}`).catch((error) => appendSerialLog('ERR', error.message));
  });
});
serialCommandInput.addEventListener('keydown', (event) => {
  if (event.key !== 'Enter') return;
  sendCommandButton.click();
});
document.querySelector('#clearSerialLogButton').addEventListener('click', () => {
  serialLog.textContent = '';
});

window.addEventListener('keydown', (event) => {
  const key = event.key.toLowerCase();
  if (!keyMap.has(key) || event.target === sourceInput || event.target === machineCodeInput) return;
  event.preventDefault();
  system.pressKey(keyMap.get(key));
  render();
});

window.addEventListener('keyup', (event) => {
  if (!keyMap.has(event.key.toLowerCase())) return;
  system.releaseKey();
  render();
});

system.addEventListener('sound', (event) => {
  setStatus(`Sound: ${event.detail}`);
});

buildKeyboard();
setSerialConnected(false);
reset();

async function sendMachineCodeToHardware() {
  if (!serial.port?.writable) {
    await connectSerial();
  }
  await writeSerial(`${formatProgramForSerial()}${lineEnding()}`);
}
