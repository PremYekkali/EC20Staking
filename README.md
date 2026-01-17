# ERC20 Staking Protocol

A production ready ERC20 staking protocol that allows users to stake tokens and earn rewards based on how long their tokens remain staked. The design prioritizes correctness, gas efficiency, and user safety.

---

## Overview

Users can stake ERC20 tokens and earn interest based on the duration of their stake.

Reward tiers:

- Less than 1 day: no rewards  
- 1 day or more: 1 percent  
- 7 days or more: 10 percent  

Interest is calculated on the full staked amount and is settled atomically with principal where applicable to avoid partial payouts and reduce gas usage.

---

## Features

- Single active staking position per user
- Time based reward calculation
- Automatic interest settlement on stake and redeem
- Explicit interest claiming
- Gas optimized settlement using single ERC20 transfers
- No privileged fund withdrawal or backdoor access

---

## Project Structure

```text
staking-protocol/
├── contracts/
│   ├── ERC20Token.sol
│   ├── Staking.sol
│   └── mocks/
│       └── ReentrantERC20.sol
├── test/
│   └── Staking.test.js
├── .gitignore
├── .solcover.js
├── hardhat.config.js
├── package-lock.json
├── package.json
└── README.md
```

## Contracts

### ERC20Token.sol

A standard ERC20 token implementation used for staking.  
Includes owner controlled minting and is suitable for local testing and development.

### Staking.sol

The core staking contract responsible for:

- Accepting ERC20 token stakes
- Tracking staking duration
- Calculating time based rewards
- Handling redeem and claim operations
- Applying reentrancy protection on all external entry points

### ReentrantERC20.sol

A malicious ERC20 token used **only for testing purposes**.  
It attempts to reenter the staking contract during token transfers to validate that reentrancy protection is correctly enforced.

This contract is not part of the protocol logic and must never be deployed in production environments.

---

## Local Development

### Prerequisites

- Node.js version 18 or later
- npm
- Git

---

### Clone the Repository

```bash
git clone https://github.com/PremYekkali/EC20Staking.git
cd EC20Staking
```

### Install Dependencies

```bash
npm install
```

### Compile Contracts

Compile all Solidity contracts using Hardhat.

```bash
npm run compile
```

### Run Tests

Execute the complete test suite.
```bash
npm run test
```

### Run Coverage

Generate the Solidity coverage report.
```bash
npm run coverage
```

The coverage suite includes:

- Positive execution paths
- Revert and failure scenarios
- Reentrancy attack simulations using a malicious ERC20 token

---

## Design Notes

- Reward and principal transfers are combined where possible to reduce gas usage
- Reentrancy protection is applied to all external state changing functions
- The protocol is designed to work strictly with ERC20 tokens
- Full branch and line coverage is achieved through targeted negative test cases
- Malicious contracts are used strictly for security testing and coverage validation

---

## Disclaimer

This project is intended for educational and evaluation purposes only.  
It has not been audited and should not be used in production without a thorough security review.

---

## License

MIT



