const MEMORY_SIZE = 256;
const HEX_RE = /^[0-9a-f]$/i;

const state = {
  memory: new Uint8Array(MEMORY_SIZE),
  pc: 0,
  a: 0,
  b: 0,
  y: 0,
  z: 0,
  carry: 0,
  running: false,
  timer: null,
  display: 0,
};

const sourceInput = document.querySelector('#sourceInput');
const statusText = document.querySelector('#statusText');
const pcText = document.querySelector('#pcText');
const sevenSegment = document.querySelector('#sevenSegment');
const ledBank = document.querySelector('#ledBank');
const registerGrid = document.querySelector('#registerGrid');
const memoryGrid = document.querySelector('#memoryGrid');
const serialStatus = document.querySelector('#serialStatus');

const opcodes = new Map([
  ['KA', [0x0]],
  ['AO', [0x1]],
  ['CH', [0x2]],
  ['CY', [0x3]],
  ['AM', [0x4]],
  ['MA', [0x5]],
  ['M+', [0x6]],
  ['M-', [0x7]],
  ['TIA', [0x8, 'n']],
  ['AIA', [0x9, 'n']],
  ['TIY', [0xa, 'n']],
  ['AIY', [0xb, 'n']],
  ['CIA', [0xc, 'n']],
  ['CIY', [0xd, 'n']],
  ['CAL', [0xe, 'n']],
  ['JUMP', [0xf, 'nn']],
]);

function reset() {
  stop();
  state.memory.fill(0);
  state.pc = 0;
  state.a = 0;
  state.b = 0;
  state.y = 0;
  state.z = 0;
  state.carry = 0;
  state.display = 0;
  setStatus('Reset');
  render();
}

function parseHex(input) {
  const tokens = input
    .replace(/;.*/g, '')
    .replace(/:/g, ' ')
    .split(/\s+/)
    .map((token) => token.trim())
    .filter(Boolean);

  const bytes = [];
  for (const token of tokens) {
    if (token.length === 2 && /^[0-9a-f]{2}$/i.test(token)) {
      bytes.push(parseInt(token[0], 16), parseInt(token[1], 16));
    } else if (HEX_RE.test(token)) {
      bytes.push(parseInt(token, 16));
    }
  }
  return bytes;
}

function assemble(input) {
  const bytes = [];
  const lines = input.split('\n');

  for (const [lineIndex, rawLine] of lines.entries()) {
    const line = rawLine.replace(/;.*/g, '').trim();
    if (!line) continue;

    const [mnemonicRaw, operandRaw] = line.split(/\s+/, 2);
    const mnemonic = mnemonicRaw.toUpperCase();
    const pattern = opcodes.get(mnemonic);
    if (!pattern) {
      throw new Error(`${lineIndex + 1}行目: 未対応命令 ${mnemonic}`);
    }

    bytes.push(pattern[0]);
    if (pattern[1] === 'n') {
      bytes.push(parseNibble(operandRaw, lineIndex));
    }
    if (pattern[1] === 'nn') {
      const value = parseByte(operandRaw, lineIndex);
      bytes.push((value >> 4) & 0xf, value & 0xf);
    }
  }

  return bytes;
}

function parseNibble(value, lineIndex) {
  if (!value || !/^[0-9a-f]$/i.test(value)) {
    throw new Error(`${lineIndex + 1}行目: 4bit値が必要です`);
  }
  return parseInt(value, 16);
}

function parseByte(value, lineIndex) {
  if (!value || !/^[0-9a-f]{1,2}$/i.test(value)) {
    throw new Error(`${lineIndex + 1}行目: 8bitアドレスが必要です`);
  }
  return parseInt(value, 16);
}

function loadProgram(bytes) {
  state.memory.fill(0);
  bytes.slice(0, MEMORY_SIZE).forEach((byte, index) => {
    state.memory[index] = byte & 0xf;
  });
  state.pc = 0;
  setStatus(`${bytes.length} nibbles loaded`);
  render();
}

function step() {
  const opcode = readNibble();
  switch (opcode) {
    case 0x0:
      state.a = 0;
      break;
    case 0x1:
      state.display = state.a;
      break;
    case 0x2:
      [state.a, state.b] = [state.b, state.a];
      [state.y, state.z] = [state.z, state.y];
      break;
    case 0x3:
      [state.a, state.y] = [state.y, state.a];
      break;
    case 0x4:
      state.memory[state.y] = state.a;
      break;
    case 0x5:
      state.a = state.memory[state.y] & 0xf;
      break;
    case 0x6:
      add(state.memory[state.y]);
      break;
    case 0x7:
      add(-state.memory[state.y]);
      break;
    case 0x8:
      state.a = readNibble();
      break;
    case 0x9:
      add(readNibble());
      break;
    case 0xa:
      state.y = readNibble();
      break;
    case 0xb:
      state.y = (state.y + readNibble()) & 0xf;
      break;
    case 0xc:
      skipIf(state.a !== readNibble());
      break;
    case 0xd:
      skipIf(state.y !== readNibble());
      break;
    case 0xe:
      call(readNibble());
      break;
    case 0xf:
      state.pc = readAddress();
      break;
    default:
      stop();
      setStatus(`Unknown opcode: ${opcode.toString(16).toUpperCase()}`);
  }
  render();
}

function readNibble() {
  const value = state.memory[state.pc] & 0xf;
  state.pc = (state.pc + 1) & 0xff;
  return value;
}

function readAddress() {
  return ((readNibble() << 4) | readNibble()) & 0xff;
}

function add(value) {
  const result = state.a + value;
  state.carry = result < 0 || result > 0xf ? 1 : 0;
  state.a = result & 0xf;
}

function skipIf(condition) {
  if (condition) {
    state.pc = (state.pc + 1) & 0xff;
  }
}

function call(code) {
  // GMC-4のCAL詳細は実機・資料で詰める。今は表示/LED系だけ仮実装する。
  if (code === 0x1) {
    setLed(state.a, true);
  } else if (code === 0x2) {
    setLed(state.a, false);
  } else if (code === 0xc) {
    state.display = state.a;
  }
}

function setLed(index, enabled) {
  const ledIndex = index % 7;
  const current = state.memory[0x50] || 0;
  state.memory[0x50] = enabled ? current | (1 << ledIndex) : current & ~(1 << ledIndex);
}

function run() {
  if (state.running) {
    stop();
    return;
  }
  state.running = true;
  document.querySelector('#runButton').textContent = 'Stop';
  state.timer = window.setInterval(step, 250);
}

function stop() {
  state.running = false;
  if (state.timer) window.clearInterval(state.timer);
  state.timer = null;
  document.querySelector('#runButton').textContent = 'Run';
}

async function connectSerial() {
  if (!('serial' in navigator)) {
    serialStatus.textContent = 'このブラウザは Web Serial API に未対応です。Chrome/Edge系で確認してください。';
    return;
  }

  const port = await navigator.serial.requestPort();
  serialStatus.textContent = `Serial port selected: ${port.getInfo().usbVendorId ?? 'unknown'}`;
}

function render() {
  pcText.textContent = `PC: ${hex2(state.pc)}`;
  sevenSegment.textContent = state.display.toString(16).toUpperCase();

  registerGrid.innerHTML = ['a', 'b', 'y', 'z', 'carry']
    .map((key) => `<div class="register"><span>${key.toUpperCase()}</span>${state[key].toString(16).toUpperCase()}</div>`)
    .join('');

  memoryGrid.innerHTML = Array.from({ length: 64 }, (_, index) => {
    const active = index === state.pc ? ' active' : '';
    return `<div class="memory-cell${active}" title="${hex2(index)}">${state.memory[index].toString(16).toUpperCase()}</div>`;
  }).join('');

  ledBank.innerHTML = Array.from({ length: 7 }, (_, index) => {
    const on = state.memory[0x50] & (1 << index) ? ' on' : '';
    return `<span class="led${on}" title="LED ${index}"></span>`;
  }).join('');
}

function hex2(value) {
  return value.toString(16).toUpperCase().padStart(2, '0');
}

function setStatus(message) {
  statusText.textContent = message;
}

document.querySelector('#assembleButton').addEventListener('click', () => {
  try {
    loadProgram(assemble(sourceInput.value));
  } catch (error) {
    setStatus(error.message);
  }
});

document.querySelector('#loadHexButton').addEventListener('click', () => {
  loadProgram(parseHex(sourceInput.value));
});

document.querySelector('#stepButton').addEventListener('click', step);
document.querySelector('#runButton').addEventListener('click', run);
document.querySelector('#resetButton').addEventListener('click', reset);
document.querySelector('#connectSerialButton').addEventListener('click', () => {
  connectSerial().catch((error) => {
    serialStatus.textContent = error.message;
  });
});

reset();
