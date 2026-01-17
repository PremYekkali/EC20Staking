// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/*
 * Malicious ERC20 token used ONLY for testing.
 * It attempts to reenter the staking contract during transfer
 * in order to trigger the nonReentrant modifier revert path.
 */

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "../Staking.sol";

contract ReentrantERC20 is ERC20 {
    Staking public staking;
    bool internal attacking;

    enum AttackType {
        NONE,
        STAKE,
        REDEEM,
        CLAIM
    }

    AttackType public attackType;

    constructor() ERC20("Reentrant Token", "RAT") {}

    function setStaking(address stakingAddress) external {
        staking = Staking(stakingAddress);
    }

    function setAttackType(AttackType _type) external {
        attackType = _type;
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }

    function transfer(address to, uint256 amount)
        public
        override
        returns (bool)
    {
        if (!attacking && address(staking) != address(0)) {
            attacking = true;

            if (attackType == AttackType.STAKE) {
                try staking.stake(1) {} catch {}
            } else if (attackType == AttackType.REDEEM) {
                try staking.redeem(1) {} catch {}
            } else if (attackType == AttackType.CLAIM) {
                try staking.claimInterest() {} catch {}
            }

            attacking = false;
        }

        return super.transfer(to, amount);
    }
}
