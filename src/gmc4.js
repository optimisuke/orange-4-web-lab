const RAM_SIZE = 0x60;

export const SEGMENT_FIGURES = [
  [1, 1, 1, 1, 1, 1, 0, 0],
  [0, 1, 1, 0, 0, 0, 0, 0],
  [1, 1, 0, 1, 1, 0, 1, 0],
  [1, 1, 1, 1, 0, 0, 1, 0],
  [0, 1, 1, 0, 0, 1, 1, 0],
  [1, 0, 1, 1, 0, 1, 1, 0],
  [1, 0, 1, 1, 1, 1, 1, 0],
  [1, 1, 1, 0, 0, 0, 0, 0],
  [1, 1, 1, 1, 1, 1, 1, 0],
  [1, 1, 1, 1, 0, 1, 1, 0],
  [1, 1, 1, 0, 1, 1, 1, 0],
  [0, 0, 1, 1, 1, 1, 1, 0],
  [0, 0, 0, 1, 1, 0, 1, 0],
  [0, 1, 1, 1, 1, 0, 1, 0],
  [1, 0, 0, 1, 1, 1, 1, 0],
  [1, 0, 0, 0, 1, 1, 1, 0],
];

export const INSTRUCTIONS = new Map([
  ['KA', { opcode: 0x0 }],
  ['AO', { opcode: 0x1 }],
  ['CH', { opcode: 0x2 }],
  ['CY', { opcode: 0x3 }],
  ['AM', { opcode: 0x4 }],
  ['MA', { opcode: 0x5 }],
  ['M+', { opcode: 0x6 }],
  ['M-', { opcode: 0x7 }],
  ['TIA', { opcode: 0x8, operand: 'n' }],
  ['AIA', { opcode: 0x9, operand: 'n' }],
  ['TIY', { opcode: 0xa, operand: 'n' }],
  ['AIY', { opcode: 0xb, operand: 'n' }],
  ['CIA', { opcode: 0xc, operand: 'n' }],
  ['CIY', { opcode: 0xd, operand: 'n' }],
  ['CAL', { opcode: 0xe, operand: 'n' }],
  ['JUMP', { opcode: 0xf, operand: 'nn' }],
]);

export class Gmc4System extends EventTarget {
  constructor() {
    super();
    this.ram = new Uint8Array(RAM_SIZE);
    this.led = new Uint8Array(7);
    this.segments = new Uint8Array(8);
    this.key = 0;
    this.keyFlag = 0;
    this.reset();
  }

  reset({ clearRam = true } = {}) {
    if (clearRam) this.ram.fill(0);
    this.led.fill(0);
    this.segments.fill(0);
    this.key = 0;
    this.keyFlag = 0;
    this.pc = 0;
    this.inst = 0;
    this.a = 0;
    this.b = 0;
    this.y = 0;
    this.z = 0;
    this.ap = 0;
    this.bp = 0;
    this.yp = 0;
    this.zp = 0;
    this.flag = 1;
    this.lastSound = '';
    this.waitUntil = 0;
  }

  loadProgram(nibbles) {
    this.reset();
    nibbles.slice(0, RAM_SIZE).forEach((value, index) => {
      this.ram[index] = value & 0xf;
    });
  }

  pressKey(value) {
    this.key = value & 0xf;
    this.keyFlag = 1;
  }

  releaseKey() {
    this.keyFlag = 0;
  }

  step() {
    if (performance.now() < this.waitUntil) return;

    this.inst = this.read(this.pc);
    this.pc = (this.pc + 1) & 0xff;

    switch (this.inst) {
      case 0x0:
        this.keyToA();
        break;
      case 0x1:
        this.outputA();
        break;
      case 0x2:
        this.exchangeABYZ();
        break;
      case 0x3:
        this.exchangeAY();
        break;
      case 0x4:
        this.write(0x50 + this.y, this.a);
        this.flag = 1;
        break;
      case 0x5:
        this.a = this.read(0x50 + this.y);
        this.flag = 1;
        break;
      case 0x6:
        this.addMemory();
        break;
      case 0x7:
        this.subMemory();
        break;
      case 0x8:
        this.a = this.nextNibble();
        this.flag = 1;
        break;
      case 0x9:
        this.addImmediate();
        break;
      case 0xa:
        this.y = this.nextNibble();
        this.flag = 1;
        break;
      case 0xb:
        this.addYImmediate();
        break;
      case 0xc:
        this.flag = this.a !== this.nextNibble() ? 1 : 0;
        break;
      case 0xd:
        this.flag = this.y !== this.nextNibble() ? 1 : 0;
        break;
      case 0xe:
        this.call(this.nextNibble());
        break;
      case 0xf:
        this.jump();
        break;
      default:
        throw new Error(`Unknown opcode ${this.inst.toString(16).toUpperCase()}`);
    }
  }

  keyToA() {
    if (this.keyFlag) {
      this.a = this.key;
      this.flag = 0;
      this.releaseKey();
    } else {
      this.flag = 1;
    }
  }

  outputA() {
    this.segments.set(SEGMENT_FIGURES[this.a]);
    this.flag = 1;
  }

  exchangeABYZ() {
    [this.a, this.b] = [this.b, this.a];
    [this.y, this.z] = [this.z, this.y];
    this.flag = 1;
  }

  exchangeAY() {
    [this.a, this.y] = [this.y, this.a];
    this.flag = 1;
  }

  addMemory() {
    const result = this.read(0x50 + this.y) + this.a;
    this.flag = result & 0x10 ? 1 : 0;
    this.a = result & 0xf;
  }

  subMemory() {
    const result = this.read(0x50 + this.y) - this.a;
    this.flag = result < 0 ? 1 : 0;
    this.a = result < 0 ? (result + 0x10) & 0xf : result & 0xf;
  }

  addImmediate() {
    const result = this.a + this.nextNibble();
    this.flag = result & 0x10 ? 1 : 0;
    this.a = result & 0xf;
  }

  addYImmediate() {
    const result = this.y + this.nextNibble();
    this.flag = result & 0x10 ? 1 : 0;
    this.y = result & 0xf;
  }

  call(code) {
    if (this.flag !== 1) return;

    switch (code) {
      case 0x0:
        this.segments.fill(0);
        this.flag = 1;
        break;
      case 0x1:
        this.led[this.y % 7] = 1;
        this.flag = 1;
        break;
      case 0x2:
        this.led[this.y % 7] = 0;
        this.flag = 1;
        break;
      case 0x4:
        this.a = ~this.a & 0xf;
        this.flag = 1;
        break;
      case 0x5:
        [this.a, this.ap] = [this.ap, this.a];
        [this.b, this.bp] = [this.bp, this.b];
        [this.y, this.yp] = [this.yp, this.y];
        [this.z, this.zp] = [this.zp, this.z];
        this.flag = 1;
        break;
      case 0x6:
        this.flag = this.a & 0x1;
        this.a >>= 1;
        break;
      case 0x7:
        this.sound('end');
        break;
      case 0x8:
        this.sound('error');
        break;
      case 0x9:
        this.sound('short');
        break;
      case 0xa:
        this.sound('long');
        break;
      case 0xb:
        this.sound(`note ${this.a.toString(16).toUpperCase()}`);
        break;
      case 0xc:
        this.waitUntil = performance.now() + 100 * (this.a + 1);
        this.flag = 1;
        break;
      case 0xd:
        this.displayRamOnLeds();
        break;
      case 0xe:
        this.decimalMinus();
        break;
      case 0xf:
        this.decimalPlus();
        break;
      default:
        this.flag = 1;
    }
  }

  jump() {
    if (this.flag === 1) {
      this.pc = ((this.read(this.pc) << 4) + this.read(this.pc + 1)) & 0xff;
    } else {
      this.pc = (this.pc + 2) & 0xff;
    }
    this.flag = 1;
  }

  displayRamOnLeds() {
    const m5e = this.read(0x5e);
    const m5f = this.read(0x5f);
    this.led[0] = m5e & 0x1;
    this.led[1] = (m5e & 0x2) >> 1;
    this.led[2] = (m5e & 0x4) >> 2;
    this.led[3] = (m5e & 0x8) >> 3;
    this.led[4] = m5f & 0x1;
    this.led[5] = (m5f & 0x2) >> 1;
    this.led[6] = (m5f & 0x4) >> 2;
    this.flag = 1;
  }

  decimalMinus() {
    const address = 0x50 + this.y;
    this.write(address, (this.read(address) - this.a + 10) % 10);
    this.y = (this.y - 1) & 0xf;
    this.flag = 1;
  }

  decimalPlus() {
    const address = 0x50 + this.y;
    const result = this.read(address) + this.a;
    this.write(address, result % 10);
    if (result >= 10) {
      const carryAddress = 0x50 + ((this.y - 1) & 0xf);
      this.write(carryAddress, this.read(carryAddress) + 1);
    }
    this.y = (this.y - 1) & 0xf;
    this.flag = 1;
  }

  sound(name) {
    this.lastSound = name;
    this.flag = 1;
    this.dispatchEvent(new CustomEvent('sound', { detail: name }));
  }

  nextNibble() {
    const value = this.read(this.pc);
    this.pc = (this.pc + 1) & 0xff;
    return value;
  }

  read(address) {
    return this.ram[address & 0xff] ?? 0;
  }

  write(address, value) {
    if (address >= 0 && address < RAM_SIZE) {
      this.ram[address] = value & 0xf;
    }
  }

  snapshot() {
    return {
      ram: this.ram,
      led: this.led,
      segments: this.segments,
      pc: this.pc,
      inst: this.inst,
      a: this.a,
      b: this.b,
      y: this.y,
      z: this.z,
      ap: this.ap,
      bp: this.bp,
      yp: this.yp,
      zp: this.zp,
      flag: this.flag,
      key: this.key,
      keyFlag: this.keyFlag,
      lastSound: this.lastSound,
    };
  }
}

export function parseHex(input) {
  return input
    .replace(/;.*/g, '')
    .replace(/[^0-9a-f]/gi, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .flatMap((token) => [...token].map((char) => parseInt(char, 16)));
}

export function assemble(input) {
  const bytes = [];
  const lines = input.split('\n');

  for (const [lineIndex, rawLine] of lines.entries()) {
    const line = rawLine.replace(/;.*/g, '').trim();
    if (!line) continue;

    const [mnemonicRaw, operandRaw] = line.split(/\s+/, 2);
    const mnemonic = mnemonicRaw.toUpperCase();
    const instruction = INSTRUCTIONS.get(mnemonic);
    if (!instruction) {
      throw new Error(`${lineIndex + 1}行目: 未対応命令 ${mnemonic}`);
    }

    bytes.push(instruction.opcode);
    if (instruction.operand === 'n') bytes.push(parseNibble(operandRaw, lineIndex));
    if (instruction.operand === 'nn') {
      const address = parseByte(operandRaw, lineIndex);
      bytes.push((address >> 4) & 0xf, address & 0xf);
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
