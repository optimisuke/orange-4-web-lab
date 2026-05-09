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
