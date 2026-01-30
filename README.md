# ERC20 Staking Protocol

![Solidity](https://img.shields.io/badge/solidity-^0.8.20-363636?style=flat&logo=solidity)
![License](https://img.shields.io/badge/license-MIT-blue)
![Coverage](https://img.shields.io/badge/coverage-100%25-brightgreen)
---

A production-grade ERC20 staking protocol that enables users to stake tokens and earn rewards proportional to the duration of their stake, with a strong emphasis on correctness, gas efficiency, and user safety.

---

## Overview

This project implements an ERC20 staking protocol where users can stake tokens and earn rewards based on how long their tokens remain staked.

Rewards are calculated using **configurable reward tiers**, where each tier defines a minimum staking duration and an associated yield rate. Reward tiers are validated to ensure increasing staking duration and yield, preventing misconfigured or unfair reward structures.

The default configuration demonstrates a tiered reward model similar to:

- Less than 1 day: no rewards  
- 1 day or more: 1 percent reward
- 7 days or more: 10 percent reward

These values are provided as an example configuration and are not hard-coded into the protocol.  

Interest is calculated on the full staked amount and is settled atomically with principal, where applicable, to avoid partial payouts and reduce gas usage.

---

## Features

- Single active staking position per user
- Time-based reward calculation
- Automatic interest settlement on stake and redeem
- Explicit interest claiming
- Configurable reward tiers with validated duration and yield progression
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
Includes owner-controlled minting and is suitable for local testing and development.

### Staking.sol

The core staking contract is responsible for managing user stakes and reward distribution.

Key responsibilities include:

- Accepting ERC20 token stakes
- Tracking staking duration per user
- Calculating rewards using configurable reward tiers
- Enforcing strictly increasing reward tiers to prevent invalid configurations
- Supporting reward claiming and partial or full redemption
- Protecting all external entry points using reentrancy guards

Reward tiers are configurable by the contract owner and are fully validated before being applied.

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
- Reentrancy protection is applied to all external state-changing functions
- The protocol is designed to work strictly with ERC20 tokens
- Reward tiers are configurable and validated to enforce increasing duration and yield
- Full branch and line coverage is achieved through targeted negative test cases
- Malicious contracts are used strictly for security testing and coverage validation

---

## Disclaimer

It has not been audited and should not be used in production without a thorough security review.

---

## License

MIT



