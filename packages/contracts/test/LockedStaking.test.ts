import { expect } from "chai";
import { ethers } from "hardhat";
import { time } from "@nomicfoundation/hardhat-network-helpers";

describe("LockedStaking", function () {
  const MIN = ethers.parseEther("3000");
  const STAKE = ethers.parseEther("10000");
  const MONTH = 30 * 24 * 60 * 60;
  const YEAR = 365 * 24 * 60 * 60;

  async function deployFixture() {
    const [owner, alice] = await ethers.getSigners();

    const RewardToken = await ethers.getContractFactory("RewardToken");
    const flx = await RewardToken.deploy(owner.address); // owner is minter here
    await flx.waitForDeployment();

    const LockedStaking = await ethers.getContractFactory("LockedStaking");
    const locked = await LockedStaking.deploy(await flx.getAddress(), owner.address);
    await locked.waitForDeployment();

    // Give alice FLX to stake, and fund the reward budget generously.
    await flx.mint(alice.address, ethers.parseEther("100000"));
    await flx.mint(owner.address, ethers.parseEther("100000"));
    await flx.approve(await locked.getAddress(), ethers.parseEther("100000"));
    await locked.fundRewards(ethers.parseEther("100000"));

    await flx.connect(alice).approve(await locked.getAddress(), ethers.MaxUint256);

    return { flx, locked, owner, alice };
  }

  it("rejects a stake below the minimum", async function () {
    const { locked, alice } = await deployFixture();
    await expect(locked.connect(alice).stake(ethers.parseEther("2999"), 0)).to.be.revertedWith("below min stake");
  });

  it("rejects a bad tier", async function () {
    const { locked, alice } = await deployFixture();
    await expect(locked.connect(alice).stake(STAKE, 3)).to.be.revertedWith("bad tier");
  });

  it("pulls the stake and records the position with the tier's APR + unlock time", async function () {
    const { flx, locked, alice } = await deployFixture();
    await locked.connect(alice).stake(STAKE, 2); // 3-month, 50% APR
    expect(await locked.totalStaked()).to.equal(STAKE);

    const positions = await locked.getPositions(alice.address);
    expect(positions.length).to.equal(1);
    expect(positions[0].amount).to.equal(STAKE);
    expect(positions[0].aprBps).to.equal(5000n);
    expect(positions[0].unlockTime - positions[0].startTime).to.equal(BigInt(90 * 24 * 60 * 60));
  });

  it("accrues reward at the tier APR and caps it at the unlock time", async function () {
    const { locked, alice } = await deployFixture();
    await locked.connect(alice).stake(STAKE, 2); // 50% APR, 90 days

    await time.increase(90 * 24 * 60 * 60); // exactly the full term
    // 10000 * 50% * (90/365) = ~1232.9 FLX
    const expected = (STAKE * 5000n * BigInt(90 * 24 * 60 * 60)) / (10_000n * BigInt(YEAR));
    const pending = await locked.pendingReward(alice.address, 0);
    expect(pending).to.equal(expected);

    // Past the term it does NOT keep growing.
    await time.increase(30 * 24 * 60 * 60);
    expect(await locked.pendingReward(alice.address, 0)).to.equal(expected);
  });

  it("blocks a normal withdraw before unlock", async function () {
    const { locked, alice } = await deployFixture();
    await locked.connect(alice).stake(STAKE, 0);
    await expect(locked.connect(alice).withdraw(0)).to.be.revertedWith("still locked");
  });

  it("pays principal + full reward after unlock", async function () {
    const { flx, locked, alice } = await deployFixture();
    await locked.connect(alice).stake(STAKE, 0); // 1-month, 10% APR
    const before = await flx.balanceOf(alice.address);

    await time.increase(MONTH);
    const owed = await locked.pendingReward(alice.address, 0);
    await locked.connect(alice).withdraw(0);

    const after = await flx.balanceOf(alice.address);
    expect(after - before).to.equal(STAKE + owed);
    expect(await locked.totalStaked()).to.equal(0n);
  });

  it("early exit burns exactly 5% (supply drops), returns 95%, forfeits reward", async function () {
    const { flx, locked, alice } = await deployFixture();
    await locked.connect(alice).stake(STAKE, 2);
    await time.increase(10 * 24 * 60 * 60); // some reward accrued, but leaving early

    const supplyBefore = await flx.totalSupply();
    const aliceBefore = await flx.balanceOf(alice.address);

    await locked.connect(alice).withdrawEarly(0);

    const penalty = (STAKE * 500n) / 10_000n; // 5%
    expect(await flx.balanceOf(alice.address)).to.equal(aliceBefore + (STAKE - penalty));
    expect(await flx.totalSupply()).to.equal(supplyBefore - penalty); // truly burned
    expect(await locked.totalStaked()).to.equal(0n);
    // Reward was forfeited — position is closed with no reward paid.
    expect(await locked.pendingReward(alice.address, 0)).to.equal(0n);
  });

  it("never traps principal when the reward budget is short", async function () {
    const { flx, locked, owner, alice } = await deployFixture();
    // Drain the reward budget so there's nothing to pay rewards from.
    await locked.withdrawRewardBudget(await locked.rewardBudget());
    expect(await locked.rewardBudget()).to.equal(0n);

    await locked.connect(alice).stake(STAKE, 0);
    await time.increase(MONTH);

    const before = await flx.balanceOf(alice.address);
    await locked.connect(alice).withdraw(0); // must not revert
    // Principal comes back in full; reward is 0 because the budget was empty.
    expect(await flx.balanceOf(alice.address)).to.equal(before + STAKE);
  });

  it("only the owner can tune APR and min stake", async function () {
    const { locked, alice } = await deployFixture();
    await expect(locked.connect(alice).setApr(0, 2000)).to.be.revertedWithCustomError(
      locked,
      "OwnableUnauthorizedAccount"
    );
    await expect(locked.connect(alice).setMinStake(1)).to.be.revertedWithCustomError(
      locked,
      "OwnableUnauthorizedAccount"
    );
    await locked.setApr(0, 2000);
    expect(await locked.aprBps(0)).to.equal(2000n);
  });

  it("APR changes only affect new stakes, not live positions", async function () {
    const { locked, alice } = await deployFixture();
    await locked.connect(alice).stake(STAKE, 0); // locks in 10%
    await locked.setApr(0, 9999); // change tier APR after the fact
    const positions = await locked.getPositions(alice.address);
    expect(positions[0].aprBps).to.equal(1000n); // still the original 10%
  });
});
