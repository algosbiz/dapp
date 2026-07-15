import { expect } from "chai";
import { ethers } from "hardhat";

const DEAD_ADDRESS = "0x000000000000000000000000000000000000dEaD";
const BPS_DENOMINATOR = 10_000n;
const SWAP_FEE_BPS = 30n;

/** Mirrors WethRwdPool.getAmountOut exactly, used to independently verify on-chain results. */
function getAmountOut(amountIn: bigint, reserveIn: bigint, reserveOut: bigint): bigint {
  const amountInWithFee = amountIn * (BPS_DENOMINATOR - SWAP_FEE_BPS);
  return (amountInWithFee * reserveOut) / (reserveIn * BPS_DENOMINATOR + amountInWithFee);
}

describe("WethRwdPool", function () {
  async function deployFixture() {
    const [owner, alice, bob] = await ethers.getSigners();

    const MockERC20 = await ethers.getContractFactory("MockERC20");
    const weth = await MockERC20.deploy("Wrapped Ether", "WETH");
    await weth.waitForDeployment();
    const rwd = await MockERC20.deploy("Reward Token", "RWD");
    await rwd.waitForDeployment();

    const Pool = await ethers.getContractFactory("WethRwdPool");
    const pool = await Pool.deploy(await weth.getAddress(), await rwd.getAddress(), owner.address);
    await pool.waitForDeployment();

    for (const account of [owner, alice, bob]) {
      await weth.mint(account.address, ethers.parseEther("10000"));
      await rwd.mint(account.address, ethers.parseEther("10000"));
    }

    return { owner, alice, bob, weth, rwd, pool };
  }

  async function approveAndAddLiquidity(
    pool: any,
    weth: any,
    rwd: any,
    signer: any,
    amount0: bigint,
    amount1: bigint,
    amount0Min = 0n,
    amount1Min = 0n
  ) {
    await weth.connect(signer).approve(await pool.getAddress(), amount0);
    await rwd.connect(signer).approve(await pool.getAddress(), amount1);
    return pool.connect(signer).addLiquidity(amount0, amount1, amount0Min, amount1Min);
  }

  describe("constructor", function () {
    it("rejects zero addresses and token0 == token1", async function () {
      const { owner, weth, rwd } = await deployFixture();
      const Pool = await ethers.getContractFactory("WethRwdPool");

      await expect(
        Pool.deploy(ethers.ZeroAddress, await rwd.getAddress(), owner.address)
      ).to.be.revertedWith("token0 = zero address");
      await expect(
        Pool.deploy(await weth.getAddress(), ethers.ZeroAddress, owner.address)
      ).to.be.revertedWith("token1 = zero address");
      await expect(
        Pool.deploy(await weth.getAddress(), await weth.getAddress(), owner.address)
      ).to.be.revertedWith("token0 = token1");
    });

    it("sets token0/token1 and LP token name/symbol", async function () {
      const { weth, rwd, pool } = await deployFixture();
      expect(await pool.token0()).to.equal(await weth.getAddress());
      expect(await pool.token1()).to.equal(await rwd.getAddress());
      expect(await pool.name()).to.equal("WETH-RWD LP Token");
      expect(await pool.symbol()).to.equal("WETH-RWD-LP");
    });
  });

  describe("addLiquidity", function () {
    it("first deposit mints sqrt(x*y) - MINIMUM_LIQUIDITY, locks MINIMUM_LIQUIDITY to dead address", async function () {
      const { owner, weth, rwd, pool } = await deployFixture();
      const amount0 = ethers.parseEther("100");
      const amount1 = ethers.parseEther("400");

      await expect(approveAndAddLiquidity(pool, weth, rwd, owner, amount0, amount1))
        .to.emit(pool, "LiquidityAdded")
        .withArgs(owner.address, amount0, amount1, ethers.parseEther("200") - 1000n);

      expect(await pool.balanceOf(owner.address)).to.equal(ethers.parseEther("200") - 1000n);
      expect(await pool.balanceOf(DEAD_ADDRESS)).to.equal(1000n);
      expect(await pool.totalSupply()).to.equal(ethers.parseEther("200"));
      const [reserve0, reserve1] = await pool.getReserves();
      expect(reserve0).to.equal(amount0);
      expect(reserve1).to.equal(amount1);
    });

    it("reverts when the first deposit is too small to clear MINIMUM_LIQUIDITY", async function () {
      const { owner, weth, rwd, pool } = await deployFixture();
      await expect(approveAndAddLiquidity(pool, weth, rwd, owner, 1n, 1n)).to.be.revertedWith(
        "insufficient initial liquidity"
      );
    });

    it("mints proportional LP on a second, exact-ratio deposit", async function () {
      const { owner, alice, weth, rwd, pool } = await deployFixture();
      await approveAndAddLiquidity(pool, weth, rwd, owner, ethers.parseEther("100"), ethers.parseEther("400"));

      const amount0 = ethers.parseEther("10");
      const amount1 = ethers.parseEther("40"); // exact 1:4 ratio
      await expect(approveAndAddLiquidity(pool, weth, rwd, alice, amount0, amount1))
        .to.emit(pool, "LiquidityAdded")
        .withArgs(alice.address, amount0, amount1, ethers.parseEther("20"));

      expect(await pool.balanceOf(alice.address)).to.equal(ethers.parseEther("20"));
      const [reserve0, reserve1] = await pool.getReserves();
      expect(reserve0).to.equal(ethers.parseEther("110"));
      expect(reserve1).to.equal(ethers.parseEther("440"));
    });

    it("only pulls the optimal amount when the deposit is off-ratio (excess token1)", async function () {
      const { owner, alice, weth, rwd, pool } = await deployFixture();
      await approveAndAddLiquidity(pool, weth, rwd, owner, ethers.parseEther("100"), ethers.parseEther("400"));

      // Desired ratio would need 40 RWD for 10 WETH; offering 50 RWD means only 40 is pulled.
      const aliceWethBefore = await weth.balanceOf(alice.address);
      const aliceRwdBefore = await rwd.balanceOf(alice.address);
      await approveAndAddLiquidity(
        pool,
        weth,
        rwd,
        alice,
        ethers.parseEther("10"),
        ethers.parseEther("50")
      );

      expect(aliceWethBefore - (await weth.balanceOf(alice.address))).to.equal(ethers.parseEther("10"));
      expect(aliceRwdBefore - (await rwd.balanceOf(alice.address))).to.equal(ethers.parseEther("40"));
    });

    it("only pulls the optimal amount when the deposit is off-ratio (excess token0)", async function () {
      const { owner, alice, weth, rwd, pool } = await deployFixture();
      await approveAndAddLiquidity(pool, weth, rwd, owner, ethers.parseEther("100"), ethers.parseEther("400"));

      // Offering way more WETH than needed for 4 RWD (ratio 1:4 -> only 1 WETH needed).
      const aliceWethBefore = await weth.balanceOf(alice.address);
      const aliceRwdBefore = await rwd.balanceOf(alice.address);
      await approveAndAddLiquidity(
        pool,
        weth,
        rwd,
        alice,
        ethers.parseEther("1000"),
        ethers.parseEther("4")
      );

      expect(aliceWethBefore - (await weth.balanceOf(alice.address))).to.equal(ethers.parseEther("1"));
      expect(aliceRwdBefore - (await rwd.balanceOf(alice.address))).to.equal(ethers.parseEther("4"));
    });

    it("reverts when the optimal amount undershoots amountXMin", async function () {
      const { owner, alice, weth, rwd, pool } = await deployFixture();
      await approveAndAddLiquidity(pool, weth, rwd, owner, ethers.parseEther("100"), ethers.parseEther("400"));

      await weth.connect(alice).approve(await pool.getAddress(), ethers.parseEther("10"));
      await rwd.connect(alice).approve(await pool.getAddress(), ethers.parseEther("50"));
      await expect(
        pool
          .connect(alice)
          .addLiquidity(
            ethers.parseEther("10"),
            ethers.parseEther("50"),
            0,
            ethers.parseEther("45") // optimal is 40, so this must revert
          )
      ).to.be.revertedWith("insufficient token1 amount");
    });
  });

  describe("removeLiquidity", function () {
    it("burns LP and returns exactly the proportional reserves", async function () {
      const { owner, bob, weth, rwd, pool } = await deployFixture();
      await approveAndAddLiquidity(pool, weth, rwd, owner, ethers.parseEther("100"), ethers.parseEther("400"));
      await approveAndAddLiquidity(pool, weth, rwd, bob, ethers.parseEther("10"), ethers.parseEther("40"));

      const bobLp = await pool.balanceOf(bob.address);
      expect(bobLp).to.equal(ethers.parseEther("20"));

      const bobWethBefore = await weth.balanceOf(bob.address);
      const bobRwdBefore = await rwd.balanceOf(bob.address);

      await expect(pool.connect(bob).removeLiquidity(bobLp, 0, 0))
        .to.emit(pool, "LiquidityRemoved")
        .withArgs(bob.address, bobLp, ethers.parseEther("10"), ethers.parseEther("40"));

      expect(await pool.balanceOf(bob.address)).to.equal(0n);
      expect((await weth.balanceOf(bob.address)) - bobWethBefore).to.equal(ethers.parseEther("10"));
      expect((await rwd.balanceOf(bob.address)) - bobRwdBefore).to.equal(ethers.parseEther("40"));

      const [reserve0, reserve1] = await pool.getReserves();
      expect(reserve0).to.equal(ethers.parseEther("100"));
      expect(reserve1).to.equal(ethers.parseEther("400"));
    });

    it("reverts on liquidity = 0 and on unmet amountMin", async function () {
      const { owner, weth, rwd, pool } = await deployFixture();
      await approveAndAddLiquidity(pool, weth, rwd, owner, ethers.parseEther("100"), ethers.parseEther("400"));

      await expect(pool.removeLiquidity(0, 0, 0)).to.be.revertedWith("liquidity = 0");

      const ownerLp = await pool.balanceOf(owner.address);
      await expect(
        pool.removeLiquidity(ownerLp, ethers.parseEther("999"), 0)
      ).to.be.revertedWith("insufficient token0 amount");
    });

    it("stays callable while paused (exit path always open)", async function () {
      const { owner, weth, rwd, pool } = await deployFixture();
      await approveAndAddLiquidity(pool, weth, rwd, owner, ethers.parseEther("100"), ethers.parseEther("400"));
      await pool.pause();

      const ownerLp = await pool.balanceOf(owner.address);
      await expect(pool.removeLiquidity(ownerLp, 0, 0)).to.not.be.reverted;
    });
  });

  describe("swap", function () {
    it("matches the hand-computed constant-product formula, both directions", async function () {
      const { owner, alice, weth, rwd, pool } = await deployFixture();
      const reserve0 = ethers.parseEther("1000");
      const reserve1 = ethers.parseEther("1000");
      await approveAndAddLiquidity(pool, weth, rwd, owner, reserve0, reserve1);

      // token0 -> token1
      const amountIn0 = ethers.parseEther("10");
      const expectedOut0 = getAmountOut(amountIn0, reserve0, reserve1);
      await weth.connect(alice).approve(await pool.getAddress(), amountIn0);
      await expect(pool.connect(alice).swap(amountIn0, await weth.getAddress(), 0, alice.address))
        .to.emit(pool, "Swap")
        .withArgs(
          alice.address,
          await weth.getAddress(),
          amountIn0,
          await rwd.getAddress(),
          expectedOut0,
          alice.address
        );

      let [r0, r1] = await pool.getReserves();
      expect(r0).to.equal(reserve0 + amountIn0);
      expect(r1).to.equal(reserve1 - expectedOut0);
      expect(r0 * r1 >= reserve0 * reserve1).to.equal(true);

      // token1 -> token0, against the now-updated reserves
      const amountIn1 = ethers.parseEther("5");
      const expectedOut1 = getAmountOut(amountIn1, r1, r0);
      await rwd.connect(alice).approve(await pool.getAddress(), amountIn1);
      const kBefore = r0 * r1;
      await pool.connect(alice).swap(amountIn1, await rwd.getAddress(), 0, alice.address);

      [r0, r1] = await pool.getReserves();
      expect(r1).to.equal((reserve1 - expectedOut0) + amountIn1);
      expect(r0).to.equal((reserve0 + amountIn0) - expectedOut1);
      expect(r0 * r1 >= kBefore).to.equal(true);
    });

    it("reverts on slippage: amountOutMin above the actual computed amountOut", async function () {
      const { owner, alice, weth, rwd, pool } = await deployFixture();
      const reserve0 = ethers.parseEther("1000");
      const reserve1 = ethers.parseEther("1000");
      await approveAndAddLiquidity(pool, weth, rwd, owner, reserve0, reserve1);

      const amountIn = ethers.parseEther("10");
      const expectedOut = getAmountOut(amountIn, reserve0, reserve1);
      await weth.connect(alice).approve(await pool.getAddress(), amountIn);
      await expect(
        pool.connect(alice).swap(amountIn, await weth.getAddress(), expectedOut + 1n, alice.address)
      ).to.be.revertedWith("slippage: amountOut < amountOutMin");
    });

    it("rejects a zero amountIn, an invalid tokenIn, and a zero `to`", async function () {
      const { owner, alice, weth, rwd, pool } = await deployFixture();
      await approveAndAddLiquidity(pool, weth, rwd, owner, ethers.parseEther("100"), ethers.parseEther("400"));

      await expect(
        pool.connect(alice).swap(0, await weth.getAddress(), 0, alice.address)
      ).to.be.revertedWith("amountIn = 0");

      await weth.connect(alice).approve(await pool.getAddress(), ethers.parseEther("1"));
      await expect(
        pool.connect(alice).swap(ethers.parseEther("1"), await pool.getAddress(), 0, alice.address)
      ).to.be.revertedWith("invalid tokenIn");
      await expect(
        pool.connect(alice).swap(ethers.parseEther("1"), await weth.getAddress(), 0, ethers.ZeroAddress)
      ).to.be.revertedWith("to = zero address");
    });

    it("blocked while paused", async function () {
      const { owner, alice, weth, rwd, pool } = await deployFixture();
      await approveAndAddLiquidity(pool, weth, rwd, owner, ethers.parseEther("100"), ethers.parseEther("400"));
      await pool.pause();

      await weth.connect(alice).approve(await pool.getAddress(), ethers.parseEther("1"));
      await expect(
        pool.connect(alice).swap(ethers.parseEther("1"), await weth.getAddress(), 0, alice.address)
      ).to.be.revertedWithCustomError(pool, "EnforcedPause");
    });
  });

  describe("owner functions", function () {
    it("restricts pause/unpause/recoverERC20 to the owner", async function () {
      const { alice, pool } = await deployFixture();
      await expect(pool.connect(alice).pause()).to.be.revertedWithCustomError(
        pool,
        "OwnableUnauthorizedAccount"
      );
      await expect(pool.connect(alice).unpause()).to.be.revertedWithCustomError(
        pool,
        "OwnableUnauthorizedAccount"
      );
      await expect(
        pool.connect(alice).recoverERC20(ethers.ZeroAddress, 0)
      ).to.be.revertedWithCustomError(pool, "OwnableUnauthorizedAccount");
    });

    it("ownership transfer requires the new owner to accept (Ownable2Step)", async function () {
      const { owner, alice, pool } = await deployFixture();
      await pool.transferOwnership(alice.address);
      expect(await pool.owner()).to.equal(owner.address);

      await pool.connect(alice).acceptOwnership();
      expect(await pool.owner()).to.equal(alice.address);
    });

    it("recoverERC20 blocks token0/token1 but rescues an unrelated token", async function () {
      const { owner, weth, rwd, pool } = await deployFixture();
      await expect(pool.recoverERC20(await weth.getAddress(), 0)).to.be.revertedWith(
        "Cannot withdraw token0"
      );
      await expect(pool.recoverERC20(await rwd.getAddress(), 0)).to.be.revertedWith(
        "Cannot withdraw token1"
      );

      const MockERC20 = await ethers.getContractFactory("MockERC20");
      const stray = await MockERC20.deploy("Stray Token", "STRAY");
      await stray.waitForDeployment();
      await stray.mint(await pool.getAddress(), ethers.parseEther("5"));
      const ownerStrayBefore = await stray.balanceOf(owner.address);

      await expect(pool.recoverERC20(await stray.getAddress(), ethers.parseEther("5")))
        .to.emit(pool, "Recovered")
        .withArgs(await stray.getAddress(), ethers.parseEther("5"));
      expect((await stray.balanceOf(owner.address)) - ownerStrayBefore).to.equal(ethers.parseEther("5"));
    });
  });

  describe("founding-liquidity lock", function () {
    it("burn() permanently forfeits the founder's share while the pool keeps working", async function () {
      const { owner, alice, weth, rwd, pool } = await deployFixture();
      await approveAndAddLiquidity(pool, weth, rwd, owner, ethers.parseEther("100"), ethers.parseEther("400"));

      const ownerLp = await pool.balanceOf(owner.address);
      expect(ownerLp).to.equal(ethers.parseEther("200") - 1000n);

      await pool.burn(ownerLp);
      expect(await pool.balanceOf(owner.address)).to.equal(0n);
      expect(await pool.totalSupply()).to.equal(1000n); // only MINIMUM_LIQUIDITY remains

      // Reserves are untouched by the burn itself.
      const [reserve0, reserve1] = await pool.getReserves();
      expect(reserve0).to.equal(ethers.parseEther("100"));
      expect(reserve1).to.equal(ethers.parseEther("400"));

      // The pool remains fully functional for a third party afterward.
      await approveAndAddLiquidity(pool, weth, rwd, alice, ethers.parseEther("10"), ethers.parseEther("40"));
      expect(await pool.balanceOf(alice.address)).to.equal(100n); // 10e18 * 1000 / 100e18

      await pool.connect(alice).removeLiquidity(100n, 0, 0);
      expect(await pool.balanceOf(alice.address)).to.equal(0n);
    });
  });
});
