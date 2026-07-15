import { expect } from "chai";
import { ethers } from "hardhat";
import { mine, time } from "@nomicfoundation/hardhat-network-helpers";

describe("MasterChef", function () {
  const REWARD_PER_SECOND = ethers.parseEther("1");

  async function deployFixture() {
    const [owner, alice, bob] = await ethers.getSigners();

    const MockERC20 = await ethers.getContractFactory("MockERC20");
    const weth = await MockERC20.deploy("Wrapped Ether", "WETH");
    await weth.waitForDeployment();

    const RewardToken = await ethers.getContractFactory("RewardToken");
    const reward = await RewardToken.deploy(owner.address);
    await reward.waitForDeployment();

    const MasterChef = await ethers.getContractFactory("MasterChef");
    // startTimestamp 0 → constructor snaps to the deploy block's timestamp.
    const chef = await MasterChef.deploy(
      await reward.getAddress(),
      REWARD_PER_SECOND,
      0,
      owner.address
    );
    await chef.waitForDeployment();

    // The farm becomes the sole minter of RWD.
    await reward.transferOwnership(await chef.getAddress());

    await weth.mint(alice.address, ethers.parseEther("100"));
    await weth.mint(bob.address, ethers.parseEther("100"));

    return { owner, alice, bob, weth, reward, chef };
  }

  async function addWethPool(chef: any, weth: any) {
    await chef.add(1000, await weth.getAddress(), false);
  }

  async function blockTimestamp(blockNumber: number): Promise<bigint> {
    const block = await ethers.provider.getBlock(blockNumber);
    return BigInt(block!.timestamp);
  }

  it("adds a pool and rejects duplicates", async function () {
    const { chef, weth } = await deployFixture();
    await addWethPool(chef, weth);
    expect(await chef.poolLength()).to.equal(1n);
    await expect(chef.add(1000, await weth.getAddress(), false)).to.be.revertedWith(
      "pool already exists"
    );
  });

  it("restricts pool management to the owner", async function () {
    const { chef, weth, alice } = await deployFixture();
    await expect(
      chef.connect(alice).add(1000, await weth.getAddress(), false)
    ).to.be.revertedWithCustomError(chef, "OwnableUnauthorizedAccount");
  });

  it("mints reward on demand and pays a single staker exactly", async function () {
    const { chef, weth, reward, alice } = await deployFixture();
    await addWethPool(chef, weth);
    const amount = ethers.parseEther("10");

    await weth.connect(alice).approve(await chef.getAddress(), amount);
    const depositReceipt = await (await chef.connect(alice).deposit(0, amount)).wait();
    const depositTime = await blockTimestamp(depositReceipt!.blockNumber);

    await time.increase(8);

    const withdrawReceipt = await (await chef.connect(alice).withdraw(0, amount)).wait();
    const withdrawTime = await blockTimestamp(withdrawReceipt!.blockNumber);

    const expectedReward = (withdrawTime - depositTime) * REWARD_PER_SECOND;

    // Principal returned in full…
    expect(await weth.balanceOf(alice.address)).to.equal(ethers.parseEther("100"));
    // …and reward equals exactly (seconds staked * rewardPerSecond).
    expect(await reward.balanceOf(alice.address)).to.equal(expectedReward);
    // "Unlimited supply": the entire RWD supply was minted on demand by the farm.
    expect(await reward.totalSupply()).to.equal(expectedReward);
    expect(expectedReward).to.be.greaterThan(0n);
  });

  it("splits rewards proportionally to stake", async function () {
    const { chef, weth, alice, bob } = await deployFixture();
    await addWethPool(chef, weth);

    await weth.connect(alice).approve(await chef.getAddress(), ethers.parseEther("10"));
    await weth.connect(bob).approve(await chef.getAddress(), ethers.parseEther("30"));

    // Land both deposits in the same block so neither gets a solo head start.
    await ethers.provider.send("evm_setAutomine", [false]);
    await chef.connect(alice).deposit(0, ethers.parseEther("10"));
    await chef.connect(bob).deposit(0, ethers.parseEther("30"));
    await mine(1);
    await ethers.provider.send("evm_setAutomine", [true]);

    // Advance 10 seconds: 10 RWD emitted, split 10:30 → 2.5 / 7.5.
    await time.increase(10);

    expect(await chef.pendingReward(0, alice.address)).to.equal(ethers.parseEther("2.5"));
    expect(await chef.pendingReward(0, bob.address)).to.equal(ethers.parseEther("7.5"));
  });

  it("emergencyWithdraw returns principal and forfeits reward", async function () {
    const { chef, weth, reward, alice } = await deployFixture();
    await addWethPool(chef, weth);
    const amount = ethers.parseEther("10");

    await weth.connect(alice).approve(await chef.getAddress(), amount);
    await chef.connect(alice).deposit(0, amount);
    await time.increase(5);

    await chef.connect(alice).emergencyWithdraw(0);

    expect(await weth.balanceOf(alice.address)).to.equal(ethers.parseEther("100"));
    expect(await reward.balanceOf(alice.address)).to.equal(0n);
    const info = await chef.userInfo(0, alice.address);
    expect(info.amount).to.equal(0n);
  });

  it("lets the owner change the emission rate", async function () {
    const { chef, weth, alice } = await deployFixture();
    await addWethPool(chef, weth);

    await expect(chef.connect(alice).updateEmissionRate(1)).to.be.revertedWithCustomError(
      chef,
      "OwnableUnauthorizedAccount"
    );

    await chef.updateEmissionRate(ethers.parseEther("2"));
    expect(await chef.rewardPerSecond()).to.equal(ethers.parseEther("2"));
  });

  it("lets the owner mint RWD directly via ownerMint, restricted to the owner", async function () {
    const { chef, reward, alice, bob } = await deployFixture();
    const amount = ethers.parseEther("5");

    await expect(chef.connect(alice).ownerMint(bob.address, amount)).to.be.revertedWithCustomError(
      chef,
      "OwnableUnauthorizedAccount"
    );

    await expect(chef.ownerMint(bob.address, amount))
      .to.emit(chef, "OwnerMint")
      .withArgs(bob.address, amount);

    expect(await reward.balanceOf(bob.address)).to.equal(amount);
    expect(await reward.totalSupply()).to.equal(amount);
  });
});
