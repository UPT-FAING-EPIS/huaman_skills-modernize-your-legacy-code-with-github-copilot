const path = require('node:path');
const { spawnSync } = require('node:child_process');

const {
  OP_TOTAL,
  OP_CREDIT,
  OP_DEBIT,
  dataProgram,
  operations,
  setStorageBalanceForTest,
  resetStorageBalanceForTest,
} = require('./index');

function createMockRl(answers = []) {
  let answerIndex = 0;

  return {
    question: jest.fn().mockImplementation(async () => {
      const next = answers[answerIndex];
      answerIndex += 1;
      return next;
    }),
    close: jest.fn(),
  };
}

function runAppWithInput(input) {
  return spawnSync(process.execPath, [path.join(__dirname, 'index.js')], {
    cwd: __dirname,
    input,
    encoding: 'utf8',
  });
}

describe('Legacy COBOL test plan parity', () => {
  beforeEach(() => {
    resetStorageBalanceForTest();
    jest.restoreAllMocks();
  });

  test('TC-001: muestra menu principal al iniciar', () => {
    const result = runAppWithInput('4\n');

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('1. View Balance');
    expect(result.stdout).toContain('2. Credit Account');
    expect(result.stdout).toContain('3. Debit Account');
    expect(result.stdout).toContain('4. Exit');
    expect(result.stdout).toContain('Enter your choice (1-4):');
  });

  test('TC-002: consultar saldo inicial con opcion 1', async () => {
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

    await operations(OP_TOTAL, createMockRl());

    expect(logSpy).toHaveBeenCalledWith('Current balance: 1000.00');
  });

  test('TC-003: acreditar monto valido', async () => {
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

    await operations(OP_CREDIT, createMockRl(['200.50']));

    expect(dataProgram('READ')).toBeCloseTo(1200.5, 2);
    expect(logSpy).toHaveBeenCalledWith('Amount credited. New balance: 1200.50');
  });

  test('TC-004: debitar monto valido con fondos suficientes', async () => {
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

    await operations(OP_DEBIT, createMockRl(['250.25']));

    expect(dataProgram('READ')).toBeCloseTo(749.75, 2);
    expect(logSpy).toHaveBeenCalledWith('Amount debited. New balance: 749.75');
  });

  test('TC-005: debito con fondos insuficientes no cambia saldo', async () => {
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

    await operations(OP_DEBIT, createMockRl(['1500.00']));

    expect(dataProgram('READ')).toBeCloseTo(1000.0, 2);
    expect(logSpy).toHaveBeenCalledWith('Insufficient funds for this debit.');
  });

  test('TC-006: opcion de menu invalida muestra mensaje y continua', () => {
    const result = runAppWithInput('9\n4\n');
    const menuCount = (result.stdout.match(/Account Management System/g) || []).length;

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('Invalid choice, please select 1-4.');
    expect(menuCount).toBeGreaterThanOrEqual(2);
  });

  test('TC-007: salir con opcion 4 termina aplicacion', () => {
    const result = runAppWithInput('4\n');

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('Exiting the program. Goodbye!');
  });

  test('TC-008: persistencia en memoria credito seguido de consulta', async () => {
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

    await operations(OP_CREDIT, createMockRl(['100.00']));
    await operations(OP_TOTAL, createMockRl());

    expect(dataProgram('READ')).toBeCloseTo(1100.0, 2);
    expect(logSpy).toHaveBeenCalledWith('Current balance: 1100.00');
  });

  test('TC-009: persistencia en memoria debito seguido de consulta', async () => {
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

    await operations(OP_DEBIT, createMockRl(['100.00']));
    await operations(OP_TOTAL, createMockRl());

    expect(dataProgram('READ')).toBeCloseTo(900.0, 2);
    expect(logSpy).toHaveBeenCalledWith('Current balance: 900.00');
  });

  test('TC-010: acumulacion de multiples transacciones', async () => {
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

    await operations(OP_CREDIT, createMockRl(['50.00']));
    await operations(OP_CREDIT, createMockRl(['25.00']));
    await operations(OP_DEBIT, createMockRl(['10.00']));
    await operations(OP_TOTAL, createMockRl());

    expect(dataProgram('READ')).toBeCloseTo(1065.0, 2);
    expect(logSpy).toHaveBeenCalledWith('Current balance: 1065.00');
  });

  test('TC-011: credito por monto cero mantiene saldo', async () => {
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

    await operations(OP_CREDIT, createMockRl(['0.00']));

    expect(dataProgram('READ')).toBeCloseTo(1000.0, 2);
    expect(logSpy).toHaveBeenCalledWith('Amount credited. New balance: 1000.00');
  });

  test('TC-012: debito por monto cero mantiene saldo', async () => {
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

    await operations(OP_DEBIT, createMockRl(['0.00']));

    expect(dataProgram('READ')).toBeCloseTo(1000.0, 2);
    expect(logSpy).toHaveBeenCalledWith('Amount debited. New balance: 1000.00');
  });

  test('TC-013: limite superior permitido por formato numerico', async () => {
    await operations(OP_CREDIT, createMockRl(['998999.99']));

    expect(dataProgram('READ')).toBeCloseTo(999999.99, 2);
  });

  test('TC-014: operacion desconocida en modulo operations no modifica saldo', async () => {
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

    await operations('UNKNOWN', createMockRl(['123.00']));

    expect(dataProgram('READ')).toBeCloseTo(1000.0, 2);
    expect(logSpy).not.toHaveBeenCalled();
  });

  test('TC-015: dataProgram READ devuelve saldo almacenado', () => {
    setStorageBalanceForTest(4321.98);

    expect(dataProgram('READ')).toBeCloseTo(4321.98, 2);
  });

  test('TC-016: dataProgram WRITE actualiza saldo almacenado', () => {
    dataProgram('WRITE', 1234.56);

    expect(dataProgram('READ')).toBeCloseTo(1234.56, 2);
  });
});
