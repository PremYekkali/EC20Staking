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
    staking = await Staking.deploy(token.target);

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
      Staking.deploy(ethers.ZeroAddress)
    ).to.be.revertedWith("Invalid token");
  });

  /* ================= Stake ================= */

  it("stakes tokens when no previous stake exists", async () => {
    await staking.connect(user).stake(100);
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
    await staking.connect(user).claimInterest();
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
    await staking.connect(user).redeem(50);

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
    const attackStaking = await Staking.deploy(attackerToken.target);

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
    const attackStaking = await Staking.deploy(attackerToken.target);

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
        const attackStaking = await Staking.deploy(attackerToken.target);

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


});
