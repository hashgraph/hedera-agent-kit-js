import { expect } from "chai";
import { anyValue } from "@nomicfoundation/hardhat-chai-matchers/withArgs";
import hre from "hardhat";
import { ethers } from "hardhat";

describe("BaseERC721", function () {
    let baseERC721: any;
    let owner: any;
    let addr1: any;
    let addr2: any;
    let addrs: any[];

    const tokenName = "Test NFT";
    const tokenSymbol = "TNFT";
    const baseURI = "https://api.example.com/metadata/";

    beforeEach(async function () {
        // Get signers
        [owner, addr1, addr2, ...addrs] = await ethers.getSigners();

        // Deploy the contract
        const BaseERC721 = await ethers.getContractFactory("BaseERC721");
        baseERC721 = await BaseERC721.deploy(tokenName, tokenSymbol, baseURI, owner.address);
    });

    describe("Deployment", function () {
        it("Should set the right name", async function () {
            expect(await baseERC721.name()).to.equal(tokenName);
        });

        it("Should set the right symbol", async function () {
            expect(await baseERC721.symbol()).to.equal(tokenSymbol);
        });

        it("Should set the right owner", async function () {
            expect(await baseERC721.owner()).to.equal(owner.address);
        });

        it("Should set the right base URI", async function () {
            // Mint a token first to test tokenURI
            await baseERC721.safeMint(addr1.address);
            expect(await baseERC721.tokenURI(0)).to.equal(baseURI + "0");
        });

        it("Should start with zero tokens minted", async function () {
            expect(await baseERC721.balanceOf(owner.address)).to.equal(0);
        });
    });

    describe("Minting", function () {
        it("Should allow owner to mint tokens", async function () {
            const tx = await baseERC721.safeMint(addr1.address);
            const receipt = await tx.wait();

            expect(await baseERC721.ownerOf(0)).to.equal(addr1.address);
            expect(await baseERC721.balanceOf(addr1.address)).to.equal(1);
        });

        it("Should increment token IDs sequentially", async function () {
            await baseERC721.safeMint(addr1.address);
            await baseERC721.safeMint(addr2.address);

            expect(await baseERC721.ownerOf(0)).to.equal(addr1.address);
            expect(await baseERC721.ownerOf(1)).to.equal(addr2.address);
        });

        it("Should emit Transfer event when minting", async function () {
            await expect(baseERC721.safeMint(addr1.address))
                .to.emit(baseERC721, "Transfer")
                .withArgs(ethers.ZeroAddress, addr1.address, 0);
        });

        it("Should fail if non-owner tries to mint", async function () {
            await expect(baseERC721.connect(addr1).safeMint(addr2.address)).to.be.revertedWithCustomError(
                baseERC721,
                "OwnableUnauthorizedAccount",
            );
        });

        it("Should fail when minting to zero address", async function () {
            await expect(baseERC721.safeMint(ethers.ZeroAddress)).to.be.revertedWithCustomError(
                baseERC721,
                "ERC721InvalidReceiver",
            );
        });

        it("Should handle multiple mints to same address", async function () {
            await baseERC721.safeMint(addr1.address);
            await baseERC721.safeMint(addr1.address);

            expect(await baseERC721.ownerOf(0)).to.equal(addr1.address);
            expect(await baseERC721.ownerOf(1)).to.equal(addr1.address);
            expect(await baseERC721.balanceOf(addr1.address)).to.equal(2);
        });
    });

    describe("Transfers", function () {
        beforeEach(async function () {
            // Mint a token to addr1 for transfer tests
            await baseERC721.safeMint(addr1.address);
        });

        it("Should allow token owner to transfer tokens", async function () {
            await baseERC721.connect(addr1).transferFrom(addr1.address, addr2.address, 0);

            expect(await baseERC721.ownerOf(0)).to.equal(addr2.address);
            expect(await baseERC721.balanceOf(addr1.address)).to.equal(0);
            expect(await baseERC721.balanceOf(addr2.address)).to.equal(1);
        });

        it("Should allow approved address to transfer tokens", async function () {
            await baseERC721.connect(addr1).approve(addr2.address, 0);
            await baseERC721.connect(addr2).transferFrom(addr1.address, owner.address, 0);

            expect(await baseERC721.ownerOf(0)).to.equal(owner.address);
        });

        it("Should allow operator to transfer tokens", async function () {
            await baseERC721.connect(addr1).setApprovalForAll(addr2.address, true);
            await baseERC721.connect(addr2).transferFrom(addr1.address, owner.address, 0);

            expect(await baseERC721.ownerOf(0)).to.equal(owner.address);
        });

        it("Should emit Transfer event when transferring", async function () {
            await expect(baseERC721.connect(addr1).transferFrom(addr1.address, addr2.address, 0))
                .to.emit(baseERC721, "Transfer")
                .withArgs(addr1.address, addr2.address, 0);
        });

        it("Should fail if non-owner tries to transfer", async function () {
            await expect(
                baseERC721.connect(addr2).transferFrom(addr1.address, addr2.address, 0),
            ).to.be.revertedWithCustomError(baseERC721, "ERC721InsufficientApproval");
        });

        it("Should fail when transferring to zero address", async function () {
            await expect(
                baseERC721.connect(addr1).transferFrom(addr1.address, ethers.ZeroAddress, 0),
            ).to.be.revertedWithCustomError(baseERC721, "ERC721InvalidReceiver");
        });

        it("Should fail when transferring non-existent token", async function () {
            await expect(
                baseERC721.connect(addr1).transferFrom(addr1.address, addr2.address, 999),
            ).to.be.revertedWithCustomError(baseERC721, "ERC721NonexistentToken");
        });
    });

    describe("Approvals", function () {
        beforeEach(async function () {
            await baseERC721.safeMint(addr1.address);
        });

        it("Should allow owner to approve specific token", async function () {
            await baseERC721.connect(addr1).approve(addr2.address, 0);

            expect(await baseERC721.getApproved(0)).to.equal(addr2.address);
        });

        it("Should emit Approval event when approving", async function () {
            await expect(baseERC721.connect(addr1).approve(addr2.address, 0))
                .to.emit(baseERC721, "Approval")
                .withArgs(addr1.address, addr2.address, 0);
        });

        it("Should allow owner to set approval for all", async function () {
            await baseERC721.connect(addr1).setApprovalForAll(addr2.address, true);

            expect(await baseERC721.isApprovedForAll(addr1.address, addr2.address)).to.be.true;
        });

        it("Should emit ApprovalForAll event when setting approval for all", async function () {
            await expect(baseERC721.connect(addr1).setApprovalForAll(addr2.address, true))
                .to.emit(baseERC721, "ApprovalForAll")
                .withArgs(addr1.address, addr2.address, true);
        });

        it("Should fail if non-owner tries to approve", async function () {
            await expect(baseERC721.connect(addr2).approve(addr2.address, 0)).to.be.revertedWithCustomError(
                baseERC721,
                "ERC721InvalidApprover",
            );
        });

        it("Should clear approval when token is transferred", async function () {
            await baseERC721.connect(addr1).approve(addr2.address, 0);
            await baseERC721.connect(addr1).transferFrom(addr1.address, addr2.address, 0);

            expect(await baseERC721.getApproved(0)).to.equal(ethers.ZeroAddress);
        });
    });

    describe("Token URI", function () {
        it("Should return correct token URI", async function () {
            await baseERC721.safeMint(addr1.address);
            await baseERC721.safeMint(addr2.address);

            expect(await baseERC721.tokenURI(0)).to.equal(baseURI + "0");
            expect(await baseERC721.tokenURI(1)).to.equal(baseURI + "1");
        });

        it("Should fail for non-existent token", async function () {
            await expect(baseERC721.tokenURI(999)).to.be.revertedWithCustomError(baseERC721, "ERC721NonexistentToken");
        });
    });

    describe("Balance and Ownership", function () {
        it("Should track balance correctly", async function () {
            expect(await baseERC721.balanceOf(addr1.address)).to.equal(0);

            await baseERC721.safeMint(addr1.address);
            expect(await baseERC721.balanceOf(addr1.address)).to.equal(1);

            await baseERC721.safeMint(addr1.address);
            expect(await baseERC721.balanceOf(addr1.address)).to.equal(2);
        });

        it("Should track ownership correctly", async function () {
            await baseERC721.safeMint(addr1.address);

            expect(await baseERC721.ownerOf(0)).to.equal(addr1.address);
        });

        it("Should fail balanceOf for zero address", async function () {
            await expect(baseERC721.balanceOf(ethers.ZeroAddress)).to.be.revertedWithCustomError(
                baseERC721,
                "ERC721InvalidOwner",
            );
        });
    });

    describe("Edge Cases", function () {
        it("Should handle multiple consecutive mints", async function () {
            for (let i = 0; i < 5; i++) {
                await baseERC721.safeMint(addr1.address);
                expect(await baseERC721.ownerOf(i)).to.equal(addr1.address);
            }

            expect(await baseERC721.balanceOf(addr1.address)).to.equal(5);
        });

        it("Should handle transfer to self", async function () {
            await baseERC721.safeMint(addr1.address);
            await baseERC721.connect(addr1).transferFrom(addr1.address, addr1.address, 0);

            expect(await baseERC721.ownerOf(0)).to.equal(addr1.address);
            expect(await baseERC721.balanceOf(addr1.address)).to.equal(1);
        });

        it("Should handle approval to self", async function () {
            await baseERC721.safeMint(addr1.address);
            await baseERC721.connect(addr1).approve(addr1.address, 0);

            expect(await baseERC721.getApproved(0)).to.equal(addr1.address);
        });

        it("Should handle approval for all to self", async function () {
            await baseERC721.connect(addr1).setApprovalForAll(addr1.address, true);

            expect(await baseERC721.isApprovedForAll(addr1.address, addr1.address)).to.be.true;
        });
    });

    describe("Ownership Management", function () {
        it("Should allow owner to transfer ownership", async function () {
            await baseERC721.transferOwnership(addr1.address);

            expect(await baseERC721.owner()).to.equal(addr1.address);
        });

        it("Should emit OwnershipTransferred event", async function () {
            await expect(baseERC721.transferOwnership(addr1.address))
                .to.emit(baseERC721, "OwnershipTransferred")
                .withArgs(owner.address, addr1.address);
        });

        it("Should fail if non-owner tries to transfer ownership", async function () {
            await expect(baseERC721.connect(addr1).transferOwnership(addr2.address)).to.be.revertedWithCustomError(
                baseERC721,
                "OwnableUnauthorizedAccount",
            );
        });

        it("Should allow new owner to mint after ownership transfer", async function () {
            await baseERC721.transferOwnership(addr1.address);

            await baseERC721.connect(addr1).safeMint(addr2.address);
            expect(await baseERC721.ownerOf(0)).to.equal(addr2.address);
        });

        it("Should fail if old owner tries to mint after ownership transfer", async function () {
            await baseERC721.transferOwnership(addr1.address);

            await expect(baseERC721.safeMint(addr2.address)).to.be.revertedWithCustomError(
                baseERC721,
                "OwnableUnauthorizedAccount",
            );
        });
    });

    describe("Safe Transfer", function () {
        beforeEach(async function () {
            await baseERC721.safeMint(addr1.address);
        });

        it("Should allow safe transfer to EOA", async function () {
            await baseERC721.connect(addr1).safeTransferFrom(addr1.address, addr2.address, 0);

            expect(await baseERC721.ownerOf(0)).to.equal(addr2.address);
        });

        it("Should emit Transfer event on safe transfer", async function () {
            await expect(baseERC721.connect(addr1).safeTransferFrom(addr1.address, addr2.address, 0))
                .to.emit(baseERC721, "Transfer")
                .withArgs(addr1.address, addr2.address, 0);
        });

        it("Should fail safe transfer if not approved", async function () {
            await expect(
                baseERC721.connect(addr2).safeTransferFrom(addr1.address, addr2.address, 0),
            ).to.be.revertedWithCustomError(baseERC721, "ERC721InsufficientApproval");
        });
    });
});
