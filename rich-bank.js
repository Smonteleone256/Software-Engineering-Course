const accounts = [
  { id: 1, owner: "Alice", balance: 500 },
  { id: 2, owner: "Bob", balance: 300 },
];
//good

function getAccountById(id) {
  for (const account of accounts) {
    if (account.id === id) {
      return account;
    }
  }
  console.log("Account not found");
}

//good

function createAccount(newAccountId, newAccountOwner) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";

  if (
    typeof newAccountId !== "number" ||
    newAccountId <= 0 ||
    newAccountId % 1 !== 0
  ) {
    throw new Error("Invalid account ID: The ID must be a positive integer.");
  }

  if (accounts.some((account) => account.id === newAccountId)) {
    throw new Error("Account ID already exists");
  }

  if (newAccountOwner.length === 0 || newAccountOwner === "") {
    throw new Error(
      "Invalid account owner: The owner must be a non-empty string."
    );
  }

  for (let i = 0; i < newAccountOwner.length; i++) {
    if (!alphabet.includes(newAccountOwner[i])) {
      throw new Error("Invalid character(s) for account name");
    }
  }
  accounts.push({
    id: newAccountId,
    owner: newAccountOwner,
    balance: 0,
  });
}

//good

function depositMoney(accountId, amount) {
  const account = getAccountById(accountId);

  try {
    getAccountById(accountId);
  } catch (err) {
    throw new Error("Account not found");
  } finally {
    if (amount <= 0 || amount === NaN) {
      throw new Error(
        "Invalid deposit amount: The amount must be a positive and appropriate number."
      );
    }
  }

  account.balance += amount.toFixed(2);
  console.log(
    `Deposit Was Successful. New Balance for ${account.owner}: $${account.balance}`
  );
}
//cover cents, then good, but repeats account not found twice

function withdrawMoney(accountId, amount) {
  const account = getAccountById(accountId);

  try {
    getAccountById(accountId);
  } catch (err) {
    throw new Error("Account not found");
  } finally {
    if (amount <= 0 || amount === NaN) {
      throw new Error(
        "Invalid withdrawal amount: The amount must be a positive and appropriate number."
      );
    }
  }

  if (account.balance >= amount) {
    account.balance -= amount.toFixed(2);
    console.log(
      `Withdrawal Was Successful. New Balance for ${account.owner}: $${account.balance}`
    );
  } else {
    console.log(
      `Insufficient Balance for ${account.owner}: $${account.balance}`
    );
  }
}
//cover cents, then good, but repeats account not found twice

function transferMoney(fromAccountId, toAccountId, amount) {
  const fromAccount = getAccountById(fromAccountId);
  const toAccount = getAccountById(toAccountId);

  if (!fromAccount) {
    throw new Error("Source account not found.");
  }

  if (!Number.isFinite(amount) || amount < 0) {
    throw new Error(
      "Invalid value for transfer amount: The amount must be a positive finite number."
    );
  }

  if (amount > fromAccount.balance) {
    throw new Error("Insufficient funds in source account.");
  }

  fromAccount.balance -= amount;
  toAccount.balance += amount;
  console.log(
    `Transferred ${amount} from account ${fromAccountId} to account ${toAccountId}.`
  );
}
//good
