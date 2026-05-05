import { expect } from "chai";
import { anyValue } from "@nomicfoundation/hardhat-chai-matchers/withArgs";
import hre from "hardhat";
import { ethers } from "hardhat";

describe("BaseERC20", function () {
    let baseERC20: any;
    let owner: any;
    let addr1: any;
    let addr2: any;
    let addrs: any[];

    const tokenName = "Test Token";
    const tokenSymbol = "TEST";
    const tokenDecimals = 6;
    const initialSupply = 1000000; // 1 million tokens

    beforeEach(async function () {
        // Get signers
        [owner, addr1, addr2, ...addrs] = await ethers.getSigners();

        // Deploy the contract
        const BaseERC20 = await ethers.getContractFactory("BaseERC20");
        baseERC20 = await BaseERC20.deploy(tokenName, tokenSymbol, owner.address, tokenDecimals, initialSupply);
    });

    describe("Deployment", function () {
        it("Should set the right name", async function () {
            expect(await baseERC20.name()).to.equal(tokenName);
        });

        it("Should set the right symbol", async function () {
            expect(await baseERC20.symbol()).to.equal(tokenSymbol);
        });

        it("Should set the right decimals", async function () {
            expect(await baseERC20.decimals()).to.equal(tokenDecimals);
        });

        it("Should set the right total supply", async function () {
            const expectedTotalSupply = initialSupply * 10 ** tokenDecimals;
            expect(await baseERC20.totalSupply()).to.equal(expectedTotalSupply);
        });

        it("Should assign the total supply to the owner", async function () {
            const expectedBalance = initialSupply * 10 ** tokenDecimals;
            expect(await baseERC20.balanceOf(owner.address)).to.equal(expectedBalance);
        });
    });

    describe("Transfers", function () {
        it("Should transfer tokens between accounts", async function () {
            const transferAmount = 100 * 10 ** tokenDecimals;

            // Transfer 100 tokens from owner to addr1
            await baseERC20.transfer(addr1.address, transferAmount);

            expect(await baseERC20.balanceOf(addr1.address)).to.equal(transferAmount);

            // Check owner balance is reduced
            const expectedOwnerBalance = (initialSupply - 100) * 10 ** tokenDecimals;
            expect(await baseERC20.balanceOf(owner.address)).to.equal(expectedOwnerBalance);
        });

        it("Should fail if sender doesn't have enough tokens", async function () {
            const initialOwnerBalance = await baseERC20.balanceOf(owner.address);

            // Try to send more tokens than owner has
            await expect(baseERC20.connect(addr1).transfer(owner.address, 1)).to.be.revertedWithCustomError(
                baseERC20,
                "ERC20InsufficientBalance",
            );

            // Owner balance shouldn't have changed
            expect(await baseERC20.balanceOf(owner.address)).to.equal(initialOwnerBalance);
        });

        it("Should emit Transfer events", async function () {
            const transferAmount = 100 * 10 ** tokenDecimals;

            await expect(baseERC20.transfer(addr1.address, transferAmount))
                .to.emit(baseERC20, "Transfer")
                .withArgs(owner.address, addr1.address, transferAmount);
        });

        it("Should fail when transferring to zero address", async function () {
            const transferAmount = 100 * 10 ** tokenDecimals;

            await expect(baseERC20.transfer(ethers.ZeroAddress, transferAmount)).to.be.revertedWithCustomError(
                baseERC20,
                "ERC20InvalidReceiver",
            );
        });
    });

    describe("Allowances", function () {
        it("Should approve tokens for delegated transfer", async function () {
            const approveAmount = 100 * 10 ** tokenDecimals;

            await baseERC20.approve(addr1.address, approveAmount);

            expect(await baseERC20.allowance(owner.address, addr1.address)).to.equal(approveAmount);
        });

        it("Should emit Approval events", async function () {
            const approveAmount = 100 * 10 ** tokenDecimals;

            await expect(baseERC20.approve(addr1.address, approveAmount))
                .to.emit(baseERC20, "Approval")
                .withArgs(owner.address, addr1.address, approveAmount);
        });

        it("Should transfer tokens using transferFrom", async function () {
            const approveAmount = 100 * 10 ** tokenDecimals;
            const transferAmount = 50 * 10 ** tokenDecimals;

            // Owner approves addr1 to spend tokens
            await baseERC20.approve(addr1.address, approveAmount);

            // addr1 transfers tokens from owner to addr2
            await baseERC20.connect(addr1).transferFrom(owner.address, addr2.address, transferAmount);

            // Check balances
            expect(await baseERC20.balanceOf(addr2.address)).to.equal(transferAmount);

            // Check allowance is reduced
            expect(await baseERC20.allowance(owner.address, addr1.address)).to.equal(approveAmount - transferAmount);
        });

        it("Should fail transferFrom if not enough allowance", async function () {
            const approveAmount = 100 * 10 ** tokenDecimals;
            const transferAmount = 150 * 10 ** tokenDecimals;

            await baseERC20.approve(addr1.address, approveAmount);

            await expect(
                baseERC20.connect(addr1).transferFrom(owner.address, addr2.address, transferAmount),
            ).to.be.revertedWithCustomError(baseERC20, "ERC20InsufficientAllowance");
        });

        it("Should fail transferFrom if not enough balance", async function () {
            const approveAmount = 1000 * 10 ** tokenDecimals;

            // Give addr1 some tokens
            await baseERC20.transfer(addr1.address, 50 * 10 ** tokenDecimals);

            // Owner approves addr1 to spend more than addr1 has
            await baseERC20.approve(addr1.address, approveAmount);

            // Try to transfer more than addr1 has
            await expect(
                baseERC20.connect(addr1).transferFrom(addr1.address, addr2.address, approveAmount),
            ).to.be.revertedWithCustomError(baseERC20, "ERC20InsufficientAllowance");
        });
    });

    describe("Edge Cases", function () {
        it("Should handle zero transfers", async function () {
            const initialBalance = await baseERC20.balanceOf(owner.address);

            await baseERC20.transfer(addr1.address, 0);

            expect(await baseERC20.balanceOf(owner.address)).to.equal(initialBalance);
            expect(await baseERC20.balanceOf(addr1.address)).to.equal(0);
        });

        it("Should handle zero approvals", async function () {
            await baseERC20.approve(addr1.address, 0);

            expect(await baseERC20.allowance(owner.address, addr1.address)).to.equal(0);
        });

        it("Should handle maximum uint256 approval", async function () {
            const maxUint256 = ethers.MaxUint256;

            await baseERC20.approve(addr1.address, maxUint256);

            expect(await baseERC20.allowance(owner.address, addr1.address)).to.equal(maxUint256);
        });

        it("Should fail when approving zero address", async function () {
            await expect(baseERC20.approve(ethers.ZeroAddress, 100)).to.be.revertedWithCustomError(
                baseERC20,
                "ERC20InvalidSpender",
            );
        });
    });

    describe("Decimals Handling", function () {
        it("Should handle different decimal values correctly", async function () {
            // Deploy with 0 decimals
            const BaseERC20 = await ethers.getContractFactory("BaseERC20");
            const token0Decimals = await BaseERC20.deploy("Token0", "TK0", owner.address, 0, 1000);

            expect(await token0Decimals.decimals()).to.equal(0);
            expect(await token0Decimals.totalSupply()).to.equal(1000);

            // Deploy with 18 decimals
            const token18Decimals = await BaseERC20.deploy("Token18", "TK18", owner.address, 18, 1000);

            expect(await token18Decimals.decimals()).to.equal(18);
            expect(await token18Decimals.totalSupply()).to.equal(1000n * 10n ** 18n);
        });
    });
});
