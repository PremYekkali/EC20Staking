// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract Staking is ReentrancyGuard {
    IERC20 public immutable token;

    struct Position {
        uint256 amount;
        uint256 startTime;
    }

    mapping(address => Position) public positions;

    event Staked(address indexed user, uint256 amount);
    event Redeemed(address indexed user, uint256 amount);
    event InterestClaimed(address indexed user, uint256 amount);

    constructor(address tokenAddress) {
        require(tokenAddress != address(0), "Invalid token");
        token = IERC20(tokenAddress);
    }

    function stake(uint256 amount) external nonReentrant {
        require(amount > 0, "Invalid amount");

        Position storage p = positions[msg.sender];

        if (p.amount > 0) {
            uint256 interest = _calculateInterest(msg.sender);
            uint256 payout = p.amount + interest;
            token.transfer(msg.sender, payout);
        }

        token.transferFrom(msg.sender, address(this), amount);

        positions[msg.sender] = Position({
            amount: amount,
            startTime: block.timestamp
        });

        emit Staked(msg.sender, amount);
    }

    function redeem(uint256 amount) external nonReentrant {
        require(amount > 0, "Invalid amount");

        Position storage p = positions[msg.sender];
        require(amount <= p.amount, "Insufficient stake");

        uint256 interest = _calculateInterest(msg.sender);
        uint256 payout = amount + interest;

        // Single transfer is intentional:
        // pays accrued interest and redeemed principal atomically
        // saves gas compared to multiple ERC20 transfers
        token.transfer(msg.sender, payout);

        p.amount -= amount;

        if (p.amount == 0) {
            delete positions[msg.sender];
        } else {
            // Reset staking timer for remaining balance
            p.startTime = block.timestamp;
        }
        emit Redeemed(msg.sender, amount);
    }

    function claimInterest() external nonReentrant {
        uint256 interest = _calculateInterest(msg.sender);
        require(interest > 0, "No interest");

        positions[msg.sender].startTime = block.timestamp;
        token.transfer(msg.sender, interest);
        emit InterestClaimed(msg.sender, interest);
    }

    function _calculateInterest(address user) internal view returns (uint256) {
        Position memory p = positions[user];
        if (p.amount == 0) return 0;

        uint256 duration = block.timestamp - p.startTime;

        if (duration < 1 days) return 0;
        if (duration >= 7 days) return (p.amount * 10) / 100;

        return (p.amount * 1) / 100;
    }
}
