import { expect } from "chai";
import { ethers } from "hardhat";

describe("RewardToken (FLEX / FLX) — capped + burnable", function () {
  const CAP = ethers.parseEther("10000000"); // 10,000,000 FLX

  async function deployFixture() {
    const [owner, alice] = await ethers.getSigners();
    const RewardToken = await ethers.getContractFactory("RewardToken");
    const token = await RewardToken.deploy(owner.address);
    await token.waitForDeployment();
    return { token, owner, alice };
  }

  it("has FLEX / FLX metadata and a 10M cap", async function () {
    const { token } = await deployFixture();
    expect(await token.name()).to.equal("FLEX");
    expect(await token.symbol()).to.equal("FLX");
    expect(await token.cap()).to.equal(CAP);
    expect(await token.totalSupply()).to.equal(0n);
  });

  it("mints up to the cap and reverts past it", async function () {
    const { token, owner, alice } = await deployFixture();

    // Mint right up to the cap.
    await token.mint(alice.address, CAP);
    expect(await token.totalSupply()).to.equal(CAP);
    expect(await token.balanceOf(alice.address)).to.equal(CAP);

    // One more wei must revert — the cap is a hard ceiling.
    await expect(token.mint(alice.address, 1n)).to.be.revertedWithCustomError(token, "ERC20ExceededCap");
  });

  it("only the owner can mint", async function () {
    const { token, alice } = await deployFixture();
    await expect(token.connect(alice).mint(alice.address, ethers.parseEther("1")))
      .to.be.revertedWithCustomError(token, "OwnableUnauthorizedAccount");
  });

  it("burns from the holder's balance and lowers totalSupply", async function () {
    const { token, alice } = await deployFixture();
    await token.mint(alice.address, ethers.parseEther("1000"));

    await token.connect(alice).burn(ethers.parseEther("400"));
    expect(await token.balanceOf(alice.address)).to.equal(ethers.parseEther("600"));
    expect(await token.totalSupply()).to.equal(ethers.parseEther("600"));
  });

  it("frees cap room after a burn (ceiling on current supply, not lifetime mint)", async function () {
    const { token, owner, alice } = await deployFixture();

    await token.mint(alice.address, CAP); // at the ceiling
    await expect(token.mint(owner.address, ethers.parseEther("100"))).to.be.revertedWithCustomError(
      token,
      "ERC20ExceededCap"
    );

    // Burn 100, which drops supply below the cap...
    await token.connect(alice).burn(ethers.parseEther("100"));
    // ...so the farm can mint 100 back into the freed room, but still never above 10M.
    await token.mint(owner.address, ethers.parseEther("100"));
    expect(await token.totalSupply()).to.equal(CAP);
    await expect(token.mint(owner.address, 1n)).to.be.revertedWithCustomError(token, "ERC20ExceededCap");
  });
});
