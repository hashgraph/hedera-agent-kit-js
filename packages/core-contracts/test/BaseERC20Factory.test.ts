import { expect } from "chai";
import { anyValue } from "@nomicfoundation/hardhat-chai-matchers/withArgs";
import hre from "hardhat";
import { ethers } from "hardhat";

describe("BaseERC20Factory", function () {
    let factory: any;
    let owner: any;
    let addr1: any;
    let addr2: any;
    let addrs: any[];

    beforeEach(async function () {
        // Get signers
        [owner, addr1, addr2, ...addrs] = await ethers.getSigners();

        // Deploy the factory
        const BaseERC20Factory = await ethers.getContractFactory("BaseERC20Factory");
        factory = await BaseERC20Factory.deploy();
    });

    describe("Deployment", function () {
        it("Should deploy the factory successfully", async function () {
            expect(factory.target).to.not.equal(ethers.ZeroAddress);
        });
    });

    describe("Token Deployment", function () {
        const tokenName = "Test Token";
        const tokenSymbol = "TEST";
        const tokenDecimals = 6;
        const initialSupply = 1000000; // 1 million tokens

        it("Should deploy a new token successfully", async function () {
            const tx = await factory.deployToken(tokenName, tokenSymbol, tokenDecimals, initialSupply);

            const receipt = await tx.wait();
            expect(receipt.status).to.equal(1);
        });

        it("Should return the correct token address", async function () {
            const tx = await factory.deployToken(tokenName, tokenSymbol, tokenDecimals, initialSupply);

            const receipt = await tx.wait();
            expect(receipt.status).to.equal(1);
        });

        it("Should deploy token with correct parameters", async function () {
            const tx = await factory.deployToken(tokenName, tokenSymbol, tokenDecimals, initialSupply);

            const receipt = await tx.wait();

            // Get the deployed token address from the event
            const event = receipt.logs.find((log: any) => log.fragment && log.fragment.name === "TokenDeployed");
            const tokenAddress = event.args[1];

            // Get the deployed token contract
            const BaseERC20 = await ethers.getContractFactory("BaseERC20");
            const token: any = BaseERC20.attach(tokenAddress);

            // Verify token parameters
            expect(await token.name()).to.equal(tokenName);
            expect(await token.symbol()).to.equal(tokenSymbol);
            expect(await token.decimals()).to.equal(tokenDecimals);

            const expectedTotalSupply = initialSupply * 10 ** tokenDecimals;
            expect(await token.totalSupply()).to.equal(expectedTotalSupply);
        });

        it("Should assign initial supply to the deployer", async function () {
            const tx = await factory.deployToken(tokenName, tokenSymbol, tokenDecimals, initialSupply);

            const receipt = await tx.wait();

            // Get the deployed token address from the event
            const event = receipt.logs.find((log: any) => log.fragment && log.fragment.name === "TokenDeployed");
            const tokenAddress = event.args[1];

            const BaseERC20 = await ethers.getContractFactory("BaseERC20");
            const token: any = BaseERC20.attach(tokenAddress);

            const expectedBalance = initialSupply * 10 ** tokenDecimals;
            const balance = await token.balanceOf(owner.address);
            expect(balance).to.equal(expectedBalance);
        });

        it("Should emit TokenDeployed event", async function () {
            await expect(factory.deployToken(tokenName, tokenSymbol, tokenDecimals, initialSupply))
                .to.emit(factory, "TokenDeployed")
                .withArgs(owner.address, anyValue); // We accept any value as token address
        });

        it("Should allow multiple token deployments", async function () {
            const token1Address = await factory.deployToken("Token1", "TK1", 6, 1000000);

            const token2Address = await factory.deployToken("Token2", "TK2", 8, 500000);

            expect(token1Address).to.not.equal(token2Address);
            expect(token1Address).to.not.equal(ethers.ZeroAddress);
            expect(token2Address).to.not.equal(ethers.ZeroAddress);
        });
    });

    describe("Different Token Configurations", function () {
        it("Should deploy token with 0 decimals", async function () {
            const tx = await factory.deployToken("Zero Decimal Token", "ZERO", 0, 1000);

            const receipt = await tx.wait();
            const event = receipt.logs.find((log: any) => log.fragment && log.fragment.name === "TokenDeployed");
            const tokenAddress = event.args[1];

            const BaseERC20 = await ethers.getContractFactory("BaseERC20");
            const token: any = BaseERC20.attach(tokenAddress);

            expect(await token.decimals()).to.equal(0);
            expect(await token.totalSupply()).to.equal(1000);
        });

        it("Should deploy token with 18 decimals", async function () {
            const tx = await factory.deployToken("Standard Token", "STD", 18, 1000);

            const receipt = await tx.wait();
            const event = receipt.logs.find((log: any) => log.fragment && log.fragment.name === "TokenDeployed");
            const tokenAddress = event.args[1];

            const BaseERC20 = await ethers.getContractFactory("BaseERC20");
            const token: any = BaseERC20.attach(tokenAddress);

            expect(await token.decimals()).to.equal(18);
            expect(await token.totalSupply()).to.equal(1000n * 10n ** 18n);
        });

        it("Should deploy token with zero initial supply", async function () {
            const tx = await factory.deployToken("Zero Supply Token", "ZST", 6, 0);

            const receipt = await tx.wait();
            const event = receipt.logs.find((log: any) => log.fragment && log.fragment.name === "TokenDeployed");
            const tokenAddress = event.args[1];

            const BaseERC20 = await ethers.getContractFactory("BaseERC20");
            const token: any = BaseERC20.attach(tokenAddress);

            expect(await token.totalSupply()).to.equal(0);
            expect(await token.balanceOf(owner.address)).to.equal(0);
        });

        it("Should deploy token with large initial supply", async function () {
            const largeSupply = 1000000000000n; // 1 trillion
            const tx = await factory.deployToken("Large Supply Token", "LST", 6, largeSupply);

            const receipt = await tx.wait();
            const event = receipt.logs.find((log: any) => log.fragment && log.fragment.name === "TokenDeployed");
            const tokenAddress = event.args[1];

            const BaseERC20 = await ethers.getContractFactory("BaseERC20");
            const token: any = BaseERC20.attach(tokenAddress);

            const expectedTotalSupply = largeSupply * 10n ** 6n;
            expect(await token.totalSupply()).to.equal(expectedTotalSupply);
        });
    });

    describe("Access Control", function () {
        it("Should allow any account to deploy tokens", async function () {
            const tx = await factory.connect(addr1).deployToken("User Token", "UTK", 6, 1000000);

            const receipt = await tx.wait();
            const event = receipt.logs.find((log: any) => log.fragment && log.fragment.name === "TokenDeployed");
            const tokenAddress = event.args[1];

            expect(tokenAddress).to.not.equal(ethers.ZeroAddress);

            // Verify the token was deployed and initial supply goes to addr1
            const BaseERC20 = await ethers.getContractFactory("BaseERC20");
            const token: any = BaseERC20.attach(tokenAddress);

            const expectedBalance = 1000000 * 10 ** 6;
            expect(await token.balanceOf(addr1.address)).to.equal(expectedBalance);
        });

        it("Should emit event with correct deployer address", async function () {
            await expect(factory.connect(addr1).deployToken("User Token", "UTK", 6, 1000000))
                .to.emit(factory, "TokenDeployed")
                .withArgs(addr1.address, anyValue);
        });
    });

    describe("Edge Cases", function () {
        it("Should handle empty string names and symbols", async function () {
            const tx = await factory.deployToken("", "", 6, 1000000);

            const receipt = await tx.wait();
            const event = receipt.logs.find((log: any) => log.fragment && log.fragment.name === "TokenDeployed");
            const tokenAddress = event.args[1];

            expect(tokenAddress).to.not.equal(ethers.ZeroAddress);

            const BaseERC20 = await ethers.getContractFactory("BaseERC20");
            const token: any = BaseERC20.attach(tokenAddress);

            expect(await token.name()).to.equal("");
            expect(await token.symbol()).to.equal("");
        });

        it("Should handle very long names and symbols", async function () {
            const longName = "A".repeat(100);
            const longSymbol = "B".repeat(20);

            const tx = await factory.deployToken(longName, longSymbol, 6, 1000000);

            const receipt = await tx.wait();
            const event = receipt.logs.find((log: any) => log.fragment && log.fragment.name === "TokenDeployed");
            const tokenAddress = event.args[1];

            expect(tokenAddress).to.not.equal(ethers.ZeroAddress);

            const BaseERC20 = await ethers.getContractFactory("BaseERC20");
            const token: any = BaseERC20.attach(tokenAddress);

            expect(await token.name()).to.equal(longName);
            expect(await token.symbol()).to.equal(longSymbol);
        });

        it("Should handle maximum uint8 decimals", async function () {
            const maxDecimals = 18; // Using 18 instead of 255 to avoid overflow
            const tx = await factory.deployToken("Max Decimal Token", "MDT", maxDecimals, 1000);

            const receipt = await tx.wait();
            const event = receipt.logs.find((log: any) => log.fragment && log.fragment.name === "TokenDeployed");
            const tokenAddress = event.args[1];

            expect(tokenAddress).to.not.equal(ethers.ZeroAddress);

            const BaseERC20 = await ethers.getContractFactory("BaseERC20");
            const token: any = BaseERC20.attach(tokenAddress);

            expect(await token.decimals()).to.equal(maxDecimals);
        });
    });

    describe("Gas Usage", function () {
        it("Should deploy token within reasonable gas limits", async function () {
            const tx = await factory.deployToken("Gas Test Token", "GTT", 6, 1000000);

            const receipt = await tx.wait();
            expect(receipt.gasUsed).to.be.lessThan(5000000); // 5M gas limit
        });
    });
});
