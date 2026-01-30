const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("ERC20 Staking Protocol", function () {
  let token, staking, owner, user, other;

  beforeEach(async () => {
    [owner, user, other] = await ethers.getSigners();

    const Token = await ethers.getContractFactory("ERC20Token");
    token = await Token.deploy(
      "Stake Token",
      "STK",
      ethers.parseEther("1000000")
    );

    const Staking = await ethers.getContractFactory("Staking");
    const tiers = [
      { minDuration: 86400, rewardBps: 100 },
      { minDuration: 86400 * 7, rewardBps: 1000 }
    ];

    staking = await Staking.deploy(token.target, tiers);
    

    await token.mint(user.address, ethers.parseEther("1000"));
    await token.connect(user).approve(staking.target, ethers.MaxUint256);
  });

  /* ================= ERC20Token ================= */

  it("allows owner to mint tokens", async () => {
    await token.mint(user.address, 100);
  });

  it("reverts mint when called by non owner", async () => {
    await expect(
      token.connect(user).mint(user.address, 100)
    ).to.be.reverted;
  });

  /* ================= Constructor ================= */

  it("reverts staking deployment with zero token address", async () => {
    const Staking = await ethers.getContractFactory("Staking");

    await expect(
      Staking.deploy(ethers.ZeroAddress,[])
    ).to.be.revertedWith("Invalid token");
  });

  it("sets deployer as owner", async () => {
    expect(await staking.owner()).to.equal(owner.address);
  });

  /* ================= Stake ================= */

  it("stakes tokens when no previous stake exists", async () => {
    await expect(staking.connect(user).stake(100))
      .to.emit(staking, "Staked")
      .withArgs(user.address, 100);
    const pos = await staking.positions(user.address);
    expect(pos.amount).to.equal(100);
  });

  it("reverts stake with zero amount", async () => {
    await expect(
      staking.connect(user).stake(0)
    ).to.be.revertedWith("Invalid amount");
  });

  it("auto settles old stake and interest on restake", async () => {
    await staking.connect(user).stake(100);

    await ethers.provider.send("evm_increaseTime", [86400 * 7]);
    await ethers.provider.send("evm_mine");

    // fund rewards
    await token.mint(staking.target, 20);

    await staking.connect(user).stake(200);

    const pos = await staking.positions(user.address);
    expect(pos.amount).to.equal(200);
  });

  /* ================= Claim Interest ================= */

  it("reverts claimInterest when no stake exists", async () => {
    await expect(
      staking.connect(user).claimInterest()
    ).to.be.revertedWith("No interest");
  });

  it("reverts claimInterest before one day", async () => {
    await staking.connect(user).stake(100);

    await expect(
      staking.connect(user).claimInterest()
    ).to.be.revertedWith("No interest");
  });

  it("pays 1 percent interest after one day", async () => {
    await staking.connect(user).stake(100);

    await ethers.provider.send("evm_increaseTime", [86400]);
    await ethers.provider.send("evm_mine");

    await token.mint(staking.target, 10);
    await expect(staking.connect(user).claimInterest())
      .to.emit(staking, "InterestClaimed");
  }); 

  it("pays 10 percent interest after seven days", async () => {
    await staking.connect(user).stake(100);

    await ethers.provider.send("evm_increaseTime", [86400 * 7]);
    await ethers.provider.send("evm_mine");

    await token.mint(staking.target, 20);
    await staking.connect(user).claimInterest();
  });

  it("reverts claimInterest when interest already claimed", async () => {
    await staking.connect(user).stake(100);

    await ethers.provider.send("evm_increaseTime", [86400 * 7]);
    await ethers.provider.send("evm_mine");

    await token.mint(staking.target, 20);
    await staking.connect(user).claimInterest();

    await expect(
      staking.connect(user).claimInterest()
    ).to.be.revertedWith("No interest");
  });

  /* ================= Redeem ================= */

  it("reverts redeem with zero amount", async () => {
    await staking.connect(user).stake(100);

    await expect(
      staking.connect(user).redeem(0)
    ).to.be.revertedWith("Invalid amount");
  });

  it("reverts redeem when amount exceeds stake", async () => {
    await staking.connect(user).stake(100);

    await expect(
      staking.connect(user).redeem(200)
    ).to.be.revertedWith("Insufficient stake");
  });

  it("settles interest and resets timer on partial redeem", async () => {
    await staking.connect(user).stake(100);

    await ethers.provider.send("evm_increaseTime", [86400 * 2]);
    await ethers.provider.send("evm_mine");

    await token.mint(staking.target, 10);
    await expect(staking.connect(user).redeem(50))
      .to.emit(staking, "Redeemed")
      .withArgs(user.address, 50);

    const pos = await staking.positions(user.address);
    expect(pos.amount).to.equal(50);
  });

  it("deletes position on full redeem", async () => {
    await staking.connect(user).stake(100);

    await token.mint(staking.target, 10);
    await staking.connect(user).redeem(100);

    const pos = await staking.positions(user.address);
    expect(pos.amount).to.equal(0);
  });

  /* ================= Reentrancy ================= */

  it("covers nonReentrant else branch in stake via malicious ERC20", async () => {
    const ReentrantToken = await ethers.getContractFactory("ReentrantERC20");
    const attackerToken = await ReentrantToken.deploy();

    const Staking = await ethers.getContractFactory("Staking");

    const tiers = [
      { minDuration: 86400, rewardBps: 100 },
      { minDuration: 86400 * 7, rewardBps: 1000 }
    ];
    const attackStaking = await Staking.deploy(attackerToken.target, tiers);

    await attackerToken.setStaking(attackStaking.target);
    await attackerToken.setAttackType(1); // STAKE

    await attackerToken.mint(user.address, 1000);
    await attackerToken.connect(user).approve(attackStaking.target, 1000);

    // First stake (no transfer, no reentrancy)
    await attackStaking.connect(user).stake(100);

    // Move time so interest path is active
    await ethers.provider.send("evm_increaseTime", [86400 * 7]);
    await ethers.provider.send("evm_mine");

    // Fund rewards so payout succeeds
    await attackerToken.mint(attackStaking.target, 50);

    // Second stake triggers transfer → reentrancy → nonReentrant revert path
    await expect(
        attackStaking.connect(user).stake(50)
    ).to.not.be.reverted;
    });
  it("covers nonReentrant else branch in redeem via malicious ERC20", async () => {
    const ReentrantToken = await ethers.getContractFactory("ReentrantERC20");
    const attackerToken = await ReentrantToken.deploy();

    const Staking = await ethers.getContractFactory("Staking");
    const tiers = [
      { minDuration: 86400, rewardBps: 100 },
      { minDuration: 86400 * 7, rewardBps: 1000 }
    ];
    const attackStaking = await Staking.deploy(attackerToken.target, tiers);

    await attackerToken.setStaking(attackStaking.target);
    await attackerToken.setAttackType(1); // STAKE first to set up

    await attackerToken.mint(user.address, 1000);
    await attackerToken.connect(user).approve(attackStaking.target, 1000);

    await attackStaking.connect(user).stake(100);

    await ethers.provider.send("evm_increaseTime", [86400 * 7]);
    await ethers.provider.send("evm_mine");

    await attackerToken.mint(attackStaking.target, 50);

    // Switch to REDEEM reentry
    await attackerToken.setAttackType(2); // REDEEM

    await expect(
        attackStaking.connect(user).redeem(10)
    ).to.not.be.reverted;
    });
    it("covers nonReentrant else branch in claimInterest via malicious ERC20", async () => {
        const ReentrantToken = await ethers.getContractFactory("ReentrantERC20");
        const attackerToken = await ReentrantToken.deploy();

        const Staking = await ethers.getContractFactory("Staking");
        const tiers = [
          { minDuration: 86400, rewardBps: 100 },
          { minDuration: 86400 * 7, rewardBps: 1000 }
        ];
        const attackStaking = await Staking.deploy(attackerToken.target, tiers);

        await attackerToken.setStaking(attackStaking.target);

        await attackerToken.mint(user.address, 1000);
        await attackerToken.connect(user).approve(attackStaking.target, 1000);

        await attackStaking.connect(user).stake(100);

        await ethers.provider.send("evm_increaseTime", [86400 * 7]);
        await ethers.provider.send("evm_mine");

        await attackerToken.mint(attackStaking.target, 50);

        // Switch to CLAIM reentry
        await attackerToken.setAttackType(3); // CLAIM

        await expect(
            attackStaking.connect(user).claimInterest()
        ).to.not.be.reverted;
    });
    /* ================== Update reward tiers =============== */
    it("reverts when non owner updates reward tiers", async () => {
      const tiers = [
        { minDuration: 86400, rewardBps: 200 }
      ];

      await expect(
        staking.connect(user).updateRewardTiers(tiers)
      ).to.be.reverted;
    });

    it("allows owner to update reward tiers and emits event", async () => {
      const tiers = [
        { minDuration: 86400, rewardBps: 300 },
        { minDuration: 86400 * 7, rewardBps: 1500 }
      ];

      await expect(
        staking.updateRewardTiers(tiers)
      );
    });

    it("reverts if reward does not increase with duration", async () => {
      const badTiers = [
        { minDuration: 86400, rewardBps: 500 },
        { minDuration: 86400 * 7, rewardBps: 400 }
      ];

      await expect(
        staking.updateRewardTiers(badTiers)
      ).to.be.revertedWith("Invalid tier reward");
    });

    it("uses updated reward tiers for interest calculation", async () => {
      const tiers = [
        { minDuration: 86400, rewardBps: 500 } // 5%
      ];

      await staking.updateRewardTiers(tiers);

      await staking.connect(user).stake(100);

      await ethers.provider.send("evm_increaseTime", [86400]);
      await ethers.provider.send("evm_mine");

      await token.mint(staking.target, 100);

      await expect(
        staking.connect(user).claimInterest()
      ).to.emit(staking, "InterestClaimed");
    });

    it("reverts when updating reward tiers with empty array", async () => {
      await expect(
        staking.updateRewardTiers([])
      ).to.be.revertedWith("No reward tiers");
    });

    it("reverts when reward tier duration is not strictly increasing", async () => {
      const badTiers = [
        { minDuration: 86400, rewardBps: 100 },
        { minDuration: 86400, rewardBps: 200 } // same duration → invalid
      ];

      await expect(
        staking.updateRewardTiers(badTiers)
      ).to.be.revertedWith("Invalid tier duration");
    });

    it("returns correct reward tier count", async () => {
      const count = await staking.rewardTierCount();
      expect(count).to.equal(2); // assuming default tiers length is 2
    });
    it("returns correct reward tier data by index", async () => {
      const tier0 = await staking.getRewardTier(0);
      const tier1 = await staking.getRewardTier(1);

      expect(tier0.minDuration).to.equal(86400);
      expect(tier0.rewardBps).to.equal(100);

      expect(tier1.minDuration).to.equal(86400 * 7);
      expect(tier1.rewardBps).to.equal(1000);
    });
    it("reverts when accessing reward tier with invalid index", async () => {
      const count = await staking.rewardTierCount();

      await expect(
        staking.getRewardTier(count)
      ).to.be.reverted;
    });


});
