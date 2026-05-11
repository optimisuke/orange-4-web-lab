import test from 'node:test';
import assert from 'node:assert/strict';

import { Gmc4System, SEGMENT_FIGURES, assemble, parseHex } from '../src/gmc4.js';

function runProgram(source, steps) {
  const system = new Gmc4System();
  system.loadProgram(assemble(source));
  for (let i = 0; i < steps; i += 1) system.step();
  return system;
}

test('assemble converts basic mnemonics to nibbles', () => {
  assert.deepEqual(assemble('TIA 9\nAO\nJUMP 00'), [0x8, 0x9, 0x1, 0xf, 0x0, 0x0]);
});

test('assemble ignores comments and accepts lower case hex operands', () => {
  assert.deepEqual(assemble('  tiy a ; set Y\ncal 1\njump 0f'), [0xa, 0xa, 0xe, 0x1, 0xf, 0x0, 0xf]);
});

test('assemble rejects unknown mnemonics and malformed operands', () => {
  assert.throws(() => assemble('BAD'), /未対応命令/);
  assert.throws(() => assemble('TIA 10'), /4bit値/);
  assert.throws(() => assemble('JUMP 100'), /8bitアドレス/);
});

test('parseHex reads plain hex and comments', () => {
  assert.deepEqual(parseHex('8 9 1 F 0 0 ; loop'), [0x8, 0x9, 0x1, 0xf, 0x0, 0x0]);
  assert.deepEqual(parseHex('891F00'), [0x8, 0x9, 0x1, 0xf, 0x0, 0x0]);
});

test('TIA and AO update A, 7-segment display, PC, and flag', () => {
  const system = runProgram('TIA 9\nAO', 2);

  assert.equal(system.a, 0x9);
  assert.deepEqual([...system.segments], SEGMENT_FIGURES[0x9]);
  assert.equal(system.pc, 0x3);
  assert.equal(system.flag, 1);
});

test('AM, MA, M+, M- use M(50+Y)', () => {
  const system = runProgram(
    `TIY 2
     TIA 5
     AM
     TIA 3
     M+
     TIA 4
     M-
     MA`,
    8,
  );

  assert.equal(system.read(0x52), 0x5);
  assert.equal(system.a, 0x5);
  assert.equal(system.flag, 1);
});

test('AIY and CIY drive conditional JUMP through flag', () => {
  const system = runProgram(
    `TIY 0
     AIY 1
     CIY 1
     JUMP 01
     TIA A`,
    5,
  );

  assert.equal(system.y, 0x1);
  assert.equal(system.a, 0xa);
});

test('KA transfers pressed key and clears key flag', () => {
  const system = new Gmc4System();
  system.loadProgram(assemble('KA'));
  system.pressKey(0xb);
  system.step();

  assert.equal(system.a, 0xb);
  assert.equal(system.keyFlag, 0);
  assert.equal(system.flag, 0);
});

test('CAL SETR/RSTR controls LED indexed by Y when flag is set', () => {
  const system = runProgram(
    `TIY 3
     CAL 1
     CAL 2`,
    3,
  );

  assert.deepEqual([...system.led], [0, 0, 0, 0, 0, 0, 0]);
});

test('CAL CHNG swaps primary and alternate registers', () => {
  const system = runProgram(
    `TIA 4
     TIY 7
     CAL 5
     TIA A
     TIY B
     CAL 5`,
    6,
  );

  assert.equal(system.a, 0x4);
  assert.equal(system.y, 0x7);
  assert.equal(system.ap, 0xa);
  assert.equal(system.yp, 0xb);
});

test('CAL DSPR maps M5E and M5F to seven LEDs', () => {
  const system = new Gmc4System();
  system.write(0x5e, 0b1010);
  system.write(0x5f, 0b0101);
  system.loadProgram([0xe, 0xd]);
  system.write(0x5e, 0b1010);
  system.write(0x5f, 0b0101);
  system.step();

  assert.deepEqual([...system.led], [0, 1, 0, 1, 1, 0, 1]);
});

// ── 追加テスト ──────────────────────────────────────────

test('TIY sets Y and flag=1', () => {
  const system = runProgram('TIY 7', 1);
  assert.equal(system.y, 0x7);
  assert.equal(system.flag, 1);
});

test('CH exchanges A/B and Y/Z', () => {
  const system = runProgram('TIA 3\nTIY 5\nCH', 3);
  assert.equal(system.b, 0x3);
  assert.equal(system.z, 0x5);
  assert.equal(system.a, 0x0);
  assert.equal(system.y, 0x0);
  assert.equal(system.flag, 1);
});

test('CY exchanges A and Y', () => {
  const system = runProgram('TIA 7\nTIY 2\nCY', 3);
  assert.equal(system.a, 0x2);
  assert.equal(system.y, 0x7);
  assert.equal(system.flag, 1);
});

test('CIA sets flag=0 when equal, flag=1 when not equal', () => {
  const eq = runProgram('TIA 5\nCIA 5', 2);
  assert.equal(eq.flag, 0);

  const ne = runProgram('TIA 5\nCIA 3', 2);
  assert.equal(ne.flag, 1);
});

test('AIA sets carry flag on 4-bit overflow', () => {
  const overflow = runProgram('TIA F\nAIA 1', 2);
  assert.equal(overflow.a, 0x0);
  assert.equal(overflow.flag, 1);

  const normal = runProgram('TIA 3\nAIA 4', 2);
  assert.equal(normal.a, 0x7);
  assert.equal(normal.flag, 0);
});

test('AIY sets carry flag on 4-bit overflow', () => {
  const overflow = runProgram('TIY F\nAIY 1', 2);
  assert.equal(overflow.y, 0x0);
  assert.equal(overflow.flag, 1);

  const normal = runProgram('TIY 3\nAIY 2', 2);
  assert.equal(normal.y, 0x5);
  assert.equal(normal.flag, 0);
});

test('M+ stores result in A with carry flag on overflow', () => {
  const system = new Gmc4System();
  system.loadProgram(assemble('TIY 2\nTIA 5\nM+'));
  system.write(0x52, 0xc);
  for (let i = 0; i < 3; i++) system.step();
  assert.equal(system.a, 0x1);
  assert.equal(system.flag, 1);
});

test('M- stores result in A with borrow flag when negative', () => {
  const system = new Gmc4System();
  system.loadProgram(assemble('TIY 2\nTIA 5\nM-'));
  system.write(0x52, 0x3);
  for (let i = 0; i < 3; i++) system.step();
  assert.equal(system.a, 0xe);
  assert.equal(system.flag, 1);

  const noborrow = new Gmc4System();
  noborrow.loadProgram(assemble('TIY 2\nTIA 3\nM-'));
  noborrow.write(0x52, 0x7);
  for (let i = 0; i < 3; i++) noborrow.step();
  assert.equal(noborrow.a, 0x4);
  assert.equal(noborrow.flag, 0);
});

test('JUMP skips two bytes and sets flag=1 when flag is 0', () => {
  // CIA 9 with A=9 → flag=0 → JUMP skips → TIA A executes
  const system = runProgram('TIA 9\nCIA 9\nJUMP 00\nTIA A', 4);
  assert.equal(system.a, 0xa);
  assert.equal(system.flag, 1);
});

test('CAL does not execute when flag is 0', () => {
  // TIY 0, TIA 9, CIA 9 (flag→0), CAL 1 (skips)
  const system = runProgram('TIY 0\nTIA 9\nCIA 9\nCAL 1', 4);
  assert.deepEqual([...system.led], [0, 0, 0, 0, 0, 0, 0]);
});

test('CAL 0 clears all segment bits', () => {
  const system = runProgram('TIA F\nAO\nCAL 0', 3);
  assert.deepEqual([...system.segments], [0, 0, 0, 0, 0, 0, 0, 0]);
  assert.equal(system.flag, 1);
});

test('CAL 4 inverts all 4 bits of A', () => {
  const system = runProgram('TIA 5\nCAL 4', 2);
  assert.equal(system.a, 0xa);
  assert.equal(system.flag, 1);
});

test('CAL 6 right-shifts A and stores LSB in flag', () => {
  const even = runProgram('TIA 6\nCAL 6', 2);
  assert.equal(even.a, 0x3);
  assert.equal(even.flag, 0);

  const odd = runProgram('TIA 7\nCAL 6', 2);
  assert.equal(odd.a, 0x3);
  assert.equal(odd.flag, 1);
});

test('KA leaves A unchanged and sets flag=1 when no key is pressed', () => {
  const system = new Gmc4System();
  system.loadProgram(assemble('TIA 5\nKA'));
  system.step();
  system.step();
  assert.equal(system.a, 0x5);
  assert.equal(system.flag, 1);
});

test('CAL 9 dispatches short sound event', () => {
  const system = new Gmc4System();
  let received = null;
  system.addEventListener('sound', (e) => { received = e.detail; });
  system.loadProgram([0xe, 0x9]);
  system.step();
  assert.equal(received, 'short');
  assert.equal(system.flag, 1);
});

test('CAL B dispatches note sound event with hex digit', () => {
  const system = new Gmc4System();
  let received = null;
  system.addEventListener('sound', (e) => { received = e.detail; });
  system.loadProgram(assemble('TIA 3\nCAL B'));
  system.step();
  system.step();
  assert.equal(received, 'note 3');
});

test('CAL E performs BCD subtraction and decrements Y', () => {
  const system = new Gmc4System();
  system.loadProgram(assemble('TIY 2\nTIA 5\nCAL E'));
  system.write(0x52, 0x3);
  for (let i = 0; i < 3; i++) system.step();
  assert.equal(system.read(0x52), 0x8);
  assert.equal(system.y, 0x1);
  assert.equal(system.flag, 1);
});

test('CAL F performs BCD addition and carries at result >= 10', () => {
  // 5 + 7 = 12 → store 2, carry 1 to M[51]
  const system = new Gmc4System();
  system.loadProgram(assemble('TIY 2\nTIA 7\nCAL F'));
  system.write(0x52, 0x5);
  system.write(0x51, 0x0);
  for (let i = 0; i < 3; i++) system.step();
  assert.equal(system.read(0x52), 0x2);
  assert.equal(system.read(0x51), 0x1);
  assert.equal(system.y, 0x1);
});

test('CAL F does not carry when result is exactly 9', () => {
  const system = new Gmc4System();
  system.loadProgram(assemble('TIY 2\nTIA 5\nCAL F'));
  system.write(0x52, 0x4);
  system.write(0x51, 0x0);
  for (let i = 0; i < 3; i++) system.step();
  assert.equal(system.read(0x52), 0x9);
  assert.equal(system.read(0x51), 0x0);
});

test('reset with clearRam=false preserves RAM but resets registers', () => {
  const system = new Gmc4System();
  system.loadProgram(assemble('TIA F'));
  system.write(0x50, 0xa);
  system.step();
  system.reset({ clearRam: false });
  assert.equal(system.a, 0x0);
  assert.equal(system.pc, 0x0);
  assert.equal(system.flag, 1);
  assert.equal(system.read(0x50), 0xa);
});

test('loadProgram masks each nibble to 4 bits', () => {
  const system = new Gmc4System();
  system.loadProgram([0x1f, 0xab]);
  assert.equal(system.read(0x00), 0xf);
  assert.equal(system.read(0x01), 0xb);
});
