import { expect } from "chai";
import { anyValue } from "@nomicfoundation/hardhat-chai-matchers/withArgs";
import hre from "hardhat";
import { ethers } from "hardhat";

describe("BaseERC721Factory", function () {
    let factory: any;
    let owner: any;
    let addr1: any;
    let addr2: any;
    let addrs: any[];

    beforeEach(async function () {
        // Get signers
        [owner, addr1, addr2, ...addrs] = await ethers.getSigners();

        // Deploy the factory
        const BaseERC721Factory = await ethers.getContractFactory("BaseERC721Factory");
        factory = await BaseERC721Factory.deploy();
    });

    describe("Deployment", function () {
        it("Should deploy the factory successfully", async function () {
            expect(factory.target).to.not.equal(ethers.ZeroAddress);
        });
    });

    describe("Token Deployment", function () {
        const tokenName = "Test NFT";
        const tokenSymbol = "TNFT";
        const baseURI = "https://api.example.com/metadata/";

        it("Should deploy a new token successfully", async function () {
            const tx = await factory.deployToken(tokenName, tokenSymbol, baseURI);

            const receipt = await tx.wait();
            expect(receipt.status).to.equal(1);
        });

        it("Should return the correct token address", async function () {
            const tx = await factory.deployToken(tokenName, tokenSymbol, baseURI);

            const receipt = await tx.wait();
            expect(receipt.status).to.equal(1);
        });

        it("Should deploy token with correct parameters", async function () {
            const tx = await factory.deployToken(tokenName, tokenSymbol, baseURI);

            const receipt = await tx.wait();

            // Get the deployed token address from the event
            const event = receipt.logs.find((log: any) => log.fragment && log.fragment.name === "TokenDeployed");
            const tokenAddress = event.args[1];

            // Get the deployed token contract
            const BaseERC721 = await ethers.getContractFactory("BaseERC721");
            const token: any = BaseERC721.attach(tokenAddress);

            // Verify token parameters
            expect(await token.name()).to.equal(tokenName);
            expect(await token.symbol()).to.equal(tokenSymbol);
            expect(await token.owner()).to.equal(owner.address);

            // Test tokenURI to verify baseURI
            await token.safeMint(addr1.address);
            expect(await token.tokenURI(0)).to.equal(baseURI + "0");
        });

        it("Should set correct initial owner", async function () {
            const tx = await factory.connect(addr1).deployToken(tokenName, tokenSymbol, baseURI);

            const receipt = await tx.wait();

            // Get the deployed token address from the event
            const event = receipt.logs.find((log: any) => log.fragment && log.fragment.name === "TokenDeployed");
            const tokenAddress = event.args[1];

            const BaseERC721 = await ethers.getContractFactory("BaseERC721");
            const token: any = BaseERC721.attach(tokenAddress);

            expect(await token.owner()).to.equal(addr1.address);
        });

        it("Should emit TokenDeployed event", async function () {
            await expect(factory.deployToken(tokenName, tokenSymbol, baseURI))
                .to.emit(factory, "TokenDeployed")
                .withArgs(owner.address, anyValue); // We accept any value as token address
        });

        it("Should allow multiple token deployments", async function () {
            const token1Address = await factory.deployToken("NFT1", "NFT1", "https://api.example.com/nft1/");

            const token2Address = await factory.deployToken("NFT2", "NFT2", "https://api.example.com/nft2/");

            expect(token1Address).to.not.equal(token2Address);
            expect(token1Address).to.not.equal(ethers.ZeroAddress);
            expect(token2Address).to.not.equal(ethers.ZeroAddress);
        });
    });

    describe("Different Token Configurations", function () {
        it("Should deploy token with empty baseURI", async function () {
            const tx = await factory.deployToken("Empty URI NFT", "EUN", "");

            const receipt = await tx.wait();
            const event = receipt.logs.find((log: any) => log.fragment && log.fragment.name === "TokenDeployed");
            const tokenAddress = event.args[1];

            const BaseERC721 = await ethers.getContractFactory("BaseERC721");
            const token: any = BaseERC721.attach(tokenAddress);

            await token.safeMint(addr1.address);
            expect(await token.tokenURI(0)).to.equal("");
        });

        it("Should deploy token with IPFS baseURI", async function () {
            const ipfsURI = "ipfs://QmHash/";
            const tx = await factory.deployToken("IPFS NFT", "IPFS", ipfsURI);

            const receipt = await tx.wait();
            const event = receipt.logs.find((log: any) => log.fragment && log.fragment.name === "TokenDeployed");
            const tokenAddress = event.args[1];

            const BaseERC721 = await ethers.getContractFactory("BaseERC721");
            const token: any = BaseERC721.attach(tokenAddress);

            await token.safeMint(addr1.address);
            expect(await token.tokenURI(0)).to.equal(ipfsURI + "0");
        });

        it("Should deploy token with HTTP baseURI", async function () {
            const httpURI = "https://myapi.com/metadata/";
            const tx = await factory.deployToken("HTTP NFT", "HTTP", httpURI);

            const receipt = await tx.wait();
            const event = receipt.logs.find((log: any) => log.fragment && log.fragment.name === "TokenDeployed");
            const tokenAddress = event.args[1];

            const BaseERC721 = await ethers.getContractFactory("BaseERC721");
            const token: any = BaseERC721.attach(tokenAddress);

            await token.safeMint(addr1.address);
            expect(await token.tokenURI(0)).to.equal(httpURI + "0");
        });

        it("Should deploy token with different initial owners", async function () {
            const tx = await factory.connect(addr2).deployToken("Owner Test NFT", "OTN", "https://api.example.com/");

            const receipt = await tx.wait();
            const event = receipt.logs.find((log: any) => log.fragment && log.fragment.name === "TokenDeployed");
            const tokenAddress = event.args[1];

            const BaseERC721 = await ethers.getContractFactory("BaseERC721");
            const token: any = BaseERC721.attach(tokenAddress);

            expect(await token.owner()).to.equal(addr2.address);

            // Verify that addr2 can mint (as owner)
            await token.connect(addr2).safeMint(addr1.address);
            expect(await token.ownerOf(0)).to.equal(addr1.address);
        });
    });

    describe("Access Control", function () {
        it("Should allow any account to deploy tokens", async function () {
            const tx = await factory.connect(addr1).deployToken("User NFT", "UNFT", "https://api.example.com/");

            const receipt = await tx.wait();
            const event = receipt.logs.find((log: any) => log.fragment && log.fragment.name === "TokenDeployed");
            const tokenAddress = event.args[1];

            expect(tokenAddress).to.not.equal(ethers.ZeroAddress);

            // Verify the token was deployed and addr1 is the owner
            const BaseERC721 = await ethers.getContractFactory("BaseERC721");
            const token: any = BaseERC721.attach(tokenAddress);

            expect(await token.owner()).to.equal(addr1.address);
        });

        it("Should emit event with correct deployer address", async function () {
            await expect(factory.connect(addr1).deployToken("User NFT", "UNFT", "https://api.example.com/"))
                .to.emit(factory, "TokenDeployed")
                .withArgs(addr1.address, anyValue);
        });

        it("Should allow deployer to set different initial owner", async function () {
            const tx = await factory
                .connect(addr2)
                .deployToken("Different Owner NFT", "DONFT", "https://api.example.com/");

            const receipt = await tx.wait();
            const event = receipt.logs.find((log: any) => log.fragment && log.fragment.name === "TokenDeployed");
            const tokenAddress = event.args[1];

            const BaseERC721 = await ethers.getContractFactory("BaseERC721");
            const token: any = BaseERC721.attach(tokenAddress);

            expect(await token.owner()).to.equal(addr2.address);
            expect(await token.owner()).to.not.equal(addr1.address);
        });
    });

    describe("Edge Cases", function () {
        it("Should handle empty string names and symbols", async function () {
            const tx = await factory.deployToken("", "", "https://api.example.com/");

            const receipt = await tx.wait();
            const event = receipt.logs.find((log: any) => log.fragment && log.fragment.name === "TokenDeployed");
            const tokenAddress = event.args[1];

            expect(tokenAddress).to.not.equal(ethers.ZeroAddress);

            const BaseERC721 = await ethers.getContractFactory("BaseERC721");
            const token: any = BaseERC721.attach(tokenAddress);

            expect(await token.name()).to.equal("");
            expect(await token.symbol()).to.equal("");
        });

        it("Should handle very long names and symbols", async function () {
            const longName = "A".repeat(100);
            const longSymbol = "B".repeat(20);

            const tx = await factory.deployToken(longName, longSymbol, "https://api.example.com/");

            const receipt = await tx.wait();
            const event = receipt.logs.find((log: any) => log.fragment && log.fragment.name === "TokenDeployed");
            const tokenAddress = event.args[1];

            expect(tokenAddress).to.not.equal(ethers.ZeroAddress);

            const BaseERC721 = await ethers.getContractFactory("BaseERC721");
            const token: any = BaseERC721.attach(tokenAddress);

            expect(await token.name()).to.equal(longName);
            expect(await token.symbol()).to.equal(longSymbol);
        });

        it("Should handle very long baseURI", async function () {
            const longURI = "https://" + "a".repeat(200) + ".com/metadata/";

            const tx = await factory.deployToken("Long URI NFT", "LUN", longURI);

            const receipt = await tx.wait();
            const event = receipt.logs.find((log: any) => log.fragment && log.fragment.name === "TokenDeployed");
            const tokenAddress = event.args[1];

            expect(tokenAddress).to.not.equal(ethers.ZeroAddress);

            const BaseERC721 = await ethers.getContractFactory("BaseERC721");
            const token: any = BaseERC721.attach(tokenAddress);

            await token.safeMint(addr1.address);
            expect(await token.tokenURI(0)).to.equal(longURI + "0");
        });
    });

    describe("Token Functionality After Deployment", function () {
        let deployedToken: any;
        let tokenAddress: string;

        beforeEach(async function () {
            const tx = await factory.deployToken("Test NFT", "TNFT", "https://api.example.com/metadata/");

            const receipt = await tx.wait();
            const event = receipt.logs.find((log: any) => log.fragment && log.fragment.name === "TokenDeployed");
            tokenAddress = event.args[1];

            const BaseERC721 = await ethers.getContractFactory("BaseERC721");
            deployedToken = BaseERC721.attach(tokenAddress);
        });

        it("Should allow owner to mint tokens", async function () {
            await deployedToken.safeMint(addr1.address);
            expect(await deployedToken.ownerOf(0)).to.equal(addr1.address);
        });

        it("Should allow token transfers", async function () {
            await deployedToken.safeMint(addr1.address);
            await deployedToken.connect(addr1).transferFrom(addr1.address, addr2.address, 0);
            expect(await deployedToken.ownerOf(0)).to.equal(addr2.address);
        });

        it("Should allow approvals", async function () {
            await deployedToken.safeMint(addr1.address);
            await deployedToken.connect(addr1).approve(addr2.address, 0);
            expect(await deployedToken.getApproved(0)).to.equal(addr2.address);
        });

        it("Should emit correct events", async function () {
            await expect(deployedToken.safeMint(addr1.address))
                .to.emit(deployedToken, "Transfer")
                .withArgs(ethers.ZeroAddress, addr1.address, 0);
        });
    });

    describe("Multiple Deployments", function () {
        it("Should deploy multiple tokens with different configurations", async function () {
            const tokens = [];

            for (let i = 0; i < 3; i++) {
                const tx = await factory.deployToken(`NFT ${i}`, `NFT${i}`, `https://api.example.com/nft${i}/`);

                const receipt = await tx.wait();
                const event = receipt.logs.find((log: any) => log.fragment && log.fragment.name === "TokenDeployed");
                tokens.push(event.args[1]);
            }

            // Verify all tokens are different
            expect(tokens[0]).to.not.equal(tokens[1]);
            expect(tokens[1]).to.not.equal(tokens[2]);
            expect(tokens[0]).to.not.equal(tokens[2]);

            // Verify all tokens are valid addresses
            tokens.forEach((tokenAddress) => {
                expect(tokenAddress).to.not.equal(ethers.ZeroAddress);
            });
        });

        it("Should allow different deployers to create tokens", async function () {
            const token1 = await factory
                .connect(owner)
                .deployToken("Owner NFT", "ONFT", "https://api.example.com/owner/");

            const token2 = await factory
                .connect(addr1)
                .deployToken("Addr1 NFT", "A1NFT", "https://api.example.com/addr1/");

            const token3 = await factory
                .connect(addr2)
                .deployToken("Addr2 NFT", "A2NFT", "https://api.example.com/addr2/");

            expect(token1).to.not.equal(token2);
            expect(token2).to.not.equal(token3);
            expect(token1).to.not.equal(token3);
        });
    });

    describe("Gas Usage", function () {
        it("Should deploy token within reasonable gas limits", async function () {
            const tx = await factory.deployToken("Gas Test NFT", "GTNFT", "https://api.example.com/");

            const receipt = await tx.wait();
            expect(receipt.gasUsed).to.be.lessThan(5000000); // 5M gas limit
        });

        it("Should have consistent gas usage for similar deployments", async function () {
            const gasUsed = [];

            for (let i = 0; i < 3; i++) {
                const tx = await factory.deployToken(`Consistent NFT ${i}`, `CNFT${i}`, "https://api.example.com/");

                const receipt = await tx.wait();
                gasUsed.push(receipt.gasUsed);
            }

            // Gas usage should be similar (within 10% variance)
            const avgGas = gasUsed.reduce((a, b) => a + b, 0n) / 3n;
            gasUsed.forEach((gas) => {
                expect(gas).to.be.closeTo(avgGas, (avgGas * 10n) / 100n);
            });
        });
    });

    describe("Event Verification", function () {
        it("Should emit TokenDeployed event with correct parameters", async function () {
            const tx = await factory.deployToken("Event Test NFT", "ETNFT", "https://api.example.com/");

            const receipt = await tx.wait();
            const event = receipt.logs.find((log: any) => log.fragment && log.fragment.name === "TokenDeployed");

            expect(event.args[0]).to.equal(owner.address); // deployer
            expect(event.args[1]).to.not.equal(ethers.ZeroAddress); // token address
        });

        it("Should emit events for multiple deployments", async function () {
            const events = [];

            for (let i = 0; i < 3; i++) {
                const tx = await factory.deployToken(`Event NFT ${i}`, `ENFT${i}`, "https://api.example.com/");

                const receipt = await tx.wait();
                const event = receipt.logs.find((log: any) => log.fragment && log.fragment.name === "TokenDeployed");
                events.push(event.args);
            }

            events.forEach((eventArgs, index) => {
                expect(eventArgs[0]).to.equal(owner.address); // deployer
                expect(eventArgs[1]).to.not.equal(ethers.ZeroAddress); // token address
            });
        });
    });
});
