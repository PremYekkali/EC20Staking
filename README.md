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

staking-protocol/
├contracts/
├── ERC20Token.sol
├── Staking.sol
└── mocks/
    └── ReentrantERC20.sol
├── test/
│ └── Staking.test.js
├── hardhat.config.js
├── package.json
└── README.md