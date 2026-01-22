// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/// @title ERC20 Staking Contract
/// @author Prem
/// @notice Allows users to stake ERC20 tokens and earn time based rewards
/// @dev Rewards are calculated based on staking duration
contract Staking is ReentrancyGuard, Ownable {
    IERC20 public immutable token;

    struct Position {
        uint256 amount;
        uint256 startTime;
    }

    /// @notice Defines a reward tier based on minimum staking duration
    /// @dev rewardBps is expressed in basis points (1% = 100)
    struct RewardTier {
        uint256 minDuration;
        uint256 rewardBps;
    }

    mapping(address => Position) public positions;

    /// @notice Array of reward tiers sorted by increasing duration
    RewardTier[] public rewardTiers;

    /// @notice Emitted when corresponding action is triggered
    event Staked(address indexed user, uint256 amount);
    event Redeemed(address indexed user, uint256 amount);
    event InterestClaimed(address indexed user, uint256 amount);

    /// @notice Initializes the staking contract with the ERC20 token
    /// @param tokenAddress Address of the ERC20 token to be staked
    /// @param _tiers Initial reward tiers sorted by increasing duration
    /// @dev Reward tiers must have strictly increasing duration and reward
    constructor(address tokenAddress, RewardTier[] memory _tiers) Ownable(msg.sender) {
        require(tokenAddress != address(0), "Invalid token");
        token = IERC20(tokenAddress);
        _setRewardTiers(_tiers);
    }

    /// @notice Stake ERC20 tokens to earn rewards
    /// @param amount Amount of tokens to stake
    /// @dev If the user already has an active stake, the existing stake and any
    /// accrued rewards are fully settled and a new staking position is created
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

    /// @notice Redeem staked tokens and receive any accrued rewards
    /// @param amount Amount of staked tokens to redeem
    /// @dev Redeeming resets the staking timer for the remaining balance
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

    /// @notice Claim accrued staking rewards
    /// @dev Reverts if no rewards are available to claim
    function claimInterest() external nonReentrant {
        uint256 interest = _calculateInterest(msg.sender);
        require(interest > 0, "No interest");

        positions[msg.sender].startTime = block.timestamp;
        token.transfer(msg.sender, interest);
        emit InterestClaimed(msg.sender, interest);
    }

    /// @notice Calculates accrued interest for a staker
    /// @param user Address of the staker
    /// @return interest Amount of reward tokens earned
    /// @dev Iterates reward tiers in reverse order to find the highest
    /// applicable tier and short circuit early for gas efficiency
    function _calculateInterest(address user)
        internal
        view
        returns (uint256)
    {
        Position memory p = positions[user];
        if (p.amount == 0) return 0;

        uint256 duration = block.timestamp - p.startTime;
        uint256 applicableBps = 0;

        for (uint256 i = rewardTiers.length; i > 0; i--) {
            RewardTier memory tier = rewardTiers[i - 1];

            if (duration >= tier.minDuration) {
                applicableBps = tier.rewardBps;
                break;
            }
        }

        if (applicableBps == 0) return 0;

        // 10_000 = 100% (basis points)
        return (p.amount * applicableBps) / 10_000;
    }


    /// @notice Updates reward tiers used for interest calculation
    /// @param _tiers New reward tiers sorted by increasing duration and reward
    /// @dev Fully replaces existing tiers
    function updateRewardTiers(RewardTier[] calldata _tiers)
        external
        onlyOwner
    {
        _setRewardTiers(_tiers);
    }

    /// @notice Validates and sets reward tiers
    /// @param _tiers Reward tiers sorted by increasing duration
    /// @dev Enforces strictly increasing duration and reward
    function _setRewardTiers(RewardTier[] memory _tiers) internal {
        require(_tiers.length > 0, "No reward tiers");

        delete rewardTiers;

        uint256 lastDuration = 0;
        uint256 lastReward = 0;

        for (uint256 i = 0; i < _tiers.length; i++) {
            require(
                _tiers[i].minDuration > lastDuration,
                "Invalid tier duration"
            );
            require(
                _tiers[i].rewardBps > lastReward,
                "Invalid tier reward"
            );

            rewardTiers.push(_tiers[i]);

            lastDuration = _tiers[i].minDuration;
            lastReward = _tiers[i].rewardBps;
        }
    }
}
