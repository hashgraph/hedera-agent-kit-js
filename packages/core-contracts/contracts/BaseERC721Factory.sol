// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "./BaseERC721.sol";

contract BaseERC721Factory {
    event TokenDeployed(address indexed creator, address tokenAddress);

    function deployToken(
        string memory name_,
        string memory symbol_,
        string memory baseURI_
    ) external returns (address) {
        BaseERC721 token = new BaseERC721(name_, symbol_, baseURI_, msg.sender);

        emit TokenDeployed(msg.sender, address(token));
        return address(token);
    }
}
