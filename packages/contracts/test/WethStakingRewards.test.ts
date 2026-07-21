import { expect } from "chai";
import { ethers } from "hardhat";
import { time } from "@nomicfoundation/hardhat-network-helpers";

const DAY = 24 * 60 * 60;
const WEEK = 7 * DAY;

describe("WethStakingRewards", function () {
  async function deployFixture() {
    const [owner, alice, bob] = await ethers.getSigners();

    const MockERC20 = await ethers.getContractFactory("MockERC20");
    const weth = await MockERC20.deploy("Wrapped Ether", "WETH");
    const rewardToken = await MockERC20.deploy("FLEX", "FLX");

    const Staking = await ethers.getContractFactory("WethStakingRewards");
    const staking = await Staking.deploy(
      await weth.getAddress(),
      await rewardToken.getAddress(),
      owner.address
    );

    await weth.mint(alice.address, ethers.parseEther("100"));
    await weth.mint(bob.address, ethers.parseEther("100"));

    return { owner, alice, bob, weth, rewardToken, staking };
  }

  it("allows staking and withdrawing", async function () {
    const { alice, weth, staking } = await deployFixture();
    const amount = ethers.parseEther("10");

    await weth.connect(alice).approve(await staking.getAddress(), amount);
    await staking.connect(alice).stake(amount);

    expect(await staking.balanceOf(alice.address)).to.equal(amount);
    expect(await staking.totalSupply()).to.equal(amount);

    await staking.connect(alice).withdraw(amount);
    expect(await staking.balanceOf(alice.address)).to.equal(0);
    expect(await weth.balanceOf(alice.address)).to.equal(ethers.parseEther("100"));
  });

  it("reverts staking 0 and withdrawing more than staked", async function () {
    const { alice, staking } = await deployFixture();
    await expect(staking.connect(alice).stake(0)).to.be.revertedWith("Cannot stake 0");
    await expect(staking.connect(alice).withdraw(1)).to.be.revertedWith(
      "Insufficient staked balance"
    );
  });

  it("distributes rewards proportionally over the reward period", async function () {
    const { owner, alice, rewardToken, staking, weth } = await deployFixture();
    const stakeAmount = ethers.parseEther("10");
    const rewardAmount = ethers.parseEther("700"); // 100/day over 7 days

    await weth.connect(alice).approve(await staking.getAddress(), stakeAmount);
    await staking.connect(alice).stake(stakeAmount);

    await rewardToken.connect(owner).approve(await staking.getAddress(), rewardAmount);
    await staking.connect(owner).notifyRewardAmount(rewardAmount);

    await time.increase(WEEK);

    const earned = await staking.earned(alice.address);
    expect(earned).to.be.closeTo(rewardAmount, ethers.parseEther("1"));

    await staking.connect(alice).claimReward();
    expect(await rewardToken.balanceOf(alice.address)).to.be.closeTo(
      rewardAmount,
      ethers.parseEther("1")
    );
  });

  it("splits rewards between two stakers proportional to their stake", async function () {
    const { owner, alice, bob, rewardToken, staking, weth } = await deployFixture();
    const rewardAmount = ethers.parseEther("700");

    await weth.connect(alice).approve(await staking.getAddress(), ethers.parseEther("30"));
    await staking.connect(alice).stake(ethers.parseEther("30")); // 75% of pool

    await weth.connect(bob).approve(await staking.getAddress(), ethers.parseEther("10"));
    await staking.connect(bob).stake(ethers.parseEther("10")); // 25% of pool

    await rewardToken.connect(owner).approve(await staking.getAddress(), rewardAmount);
    await staking.connect(owner).notifyRewardAmount(rewardAmount);

    await time.increase(WEEK);

    const aliceEarned = await staking.earned(alice.address);
    const bobEarned = await staking.earned(bob.address);

    expect(aliceEarned).to.be.closeTo((rewardAmount * 3n) / 4n, ethers.parseEther("1"));
    expect(bobEarned).to.be.closeTo(rewardAmount / 4n, ethers.parseEther("1"));
  });

  it("exit() withdraws stake and claims reward in one call", async function () {
    const { owner, alice, rewardToken, staking, weth } = await deployFixture();
    const stakeAmount = ethers.parseEther("5");
    const rewardAmount = ethers.parseEther("70");

    await weth.connect(alice).approve(await staking.getAddress(), stakeAmount);
    await staking.connect(alice).stake(stakeAmount);

    await rewardToken.connect(owner).approve(await staking.getAddress(), rewardAmount);
    await staking.connect(owner).notifyRewardAmount(rewardAmount);

    await time.increase(WEEK);

    await staking.connect(alice).exit();

    expect(await staking.balanceOf(alice.address)).to.equal(0);
    expect(await weth.balanceOf(alice.address)).to.equal(ethers.parseEther("100"));
    expect(await rewardToken.balanceOf(alice.address)).to.be.gt(0);
  });

  it("reverts notifyRewardAmount for non-owner", async function () {
    const { alice, rewardToken, staking } = await deployFixture();
    await rewardToken.connect(alice).approve(await staking.getAddress(), ethers.parseEther("1"));
    await expect(staking.connect(alice).notifyRewardAmount(ethers.parseEther("1")))
      .to.be.revertedWithCustomError(staking, "OwnableUnauthorizedAccount")
      .withArgs(alice.address);
  });

  it("blocks recovering the staking or reward token via recoverERC20", async function () {
    const { staking, weth, rewardToken } = await deployFixture();
    await expect(staking.recoverERC20(await weth.getAddress(), 1)).to.be.revertedWith(
      "Cannot withdraw staking token"
    );
    await expect(staking.recoverERC20(await rewardToken.getAddress(), 1)).to.be.revertedWith(
      "Cannot withdraw reward token"
    );
  });

  it("pause() blocks new stakes but withdraw/claim/exit stay open", async function () {
    const { owner, alice, staking, weth } = await deployFixture();
    const amount = ethers.parseEther("5");

    await weth.connect(alice).approve(await staking.getAddress(), amount * 2n);
    await staking.connect(alice).stake(amount);

    await staking.connect(owner).pause();
    await expect(staking.connect(alice).stake(amount)).to.be.revertedWithCustomError(
      staking,
      "EnforcedPause"
    );

    // still able to exit while paused
    await expect(staking.connect(alice).withdraw(amount)).to.not.be.reverted;
  });

  it("rejects setRewardsDuration while a reward period is still active", async function () {
    const { owner, rewardToken, staking } = await deployFixture();
    const rewardAmount = ethers.parseEther("70");
    await rewardToken.connect(owner).approve(await staking.getAddress(), rewardAmount);
    await staking.connect(owner).notifyRewardAmount(rewardAmount);

    await expect(staking.connect(owner).setRewardsDuration(DAY)).to.be.revertedWith(
      "Previous rewards period must be complete"
    );
  });
});
