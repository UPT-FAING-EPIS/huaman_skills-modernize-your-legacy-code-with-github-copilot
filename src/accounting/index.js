const readline = require('node:readline/promises');
const { stdin: input, stdout: output } = require('node:process');

const OP_TOTAL = 'TOTAL ';
const OP_CREDIT = 'CREDIT';
const OP_DEBIT = 'DEBIT ';

// Runtime-only shared storage, equivalent to COBOL DataProgram STORAGE-BALANCE.
let storageBalance = 1000.0;
const INITIAL_BALANCE = 1000.0;

function formatAmount(amount) {
  return Number(amount).toFixed(2);
}

function dataProgram(operationType, balance) {
  if (operationType === 'READ') {
    return storageBalance;
  }

  if (operationType === 'WRITE') {
    storageBalance = balance;
    return storageBalance;
  }

  return storageBalance;
}

function setStorageBalanceForTest(balance) {
  storageBalance = balance;
}

function resetStorageBalanceForTest() {
  storageBalance = INITIAL_BALANCE;
}

async function operations(operationType, rl) {
  if (operationType === OP_TOTAL) {
    const finalBalance = dataProgram('READ');
    console.log(`Current balance: ${formatAmount(finalBalance)}`);
    return;
  }

  if (operationType === OP_CREDIT) {
    const amountInput = await rl.question('Enter credit amount: ');
    const amount = Number(amountInput);

    if (!Number.isFinite(amount)) {
      console.log('Invalid amount. Transaction cancelled.');
      return;
    }

    let finalBalance = dataProgram('READ');
    finalBalance += amount;
    dataProgram('WRITE', finalBalance);
    console.log(`Amount credited. New balance: ${formatAmount(finalBalance)}`);
    return;
  }

  if (operationType === OP_DEBIT) {
    const amountInput = await rl.question('Enter debit amount: ');
    const amount = Number(amountInput);

    if (!Number.isFinite(amount)) {
      console.log('Invalid amount. Transaction cancelled.');
      return;
    }

    let finalBalance = dataProgram('READ');
    if (finalBalance >= amount) {
      finalBalance -= amount;
      dataProgram('WRITE', finalBalance);
      console.log(`Amount debited. New balance: ${formatAmount(finalBalance)}`);
    } else {
      console.log('Insufficient funds for this debit.');
    }
  }
}

async function main() {
  const rl = readline.createInterface({ input, output });
  let continueFlag = 'YES';

  try {
    while (continueFlag !== 'NO') {
      console.log('--------------------------------');
      console.log('Account Management System');
      console.log('1. View Balance');
      console.log('2. Credit Account');
      console.log('3. Debit Account');
      console.log('4. Exit');
      console.log('--------------------------------');

      const choiceInput = await rl.question('Enter your choice (1-4): ');
      const userChoice = Number.parseInt(choiceInput, 10);

      switch (userChoice) {
        case 1:
          await operations(OP_TOTAL, rl);
          break;
        case 2:
          await operations(OP_CREDIT, rl);
          break;
        case 3:
          await operations(OP_DEBIT, rl);
          break;
        case 4:
          continueFlag = 'NO';
          break;
        default:
          console.log('Invalid choice, please select 1-4.');
          break;
      }
    }

    console.log('Exiting the program. Goodbye!');
  } finally {
    rl.close();
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error('Unexpected application error:', error);
    process.exitCode = 1;
  });
}

module.exports = {
  OP_TOTAL,
  OP_CREDIT,
  OP_DEBIT,
  formatAmount,
  dataProgram,
  operations,
  main,
  setStorageBalanceForTest,
  resetStorageBalanceForTest,
};