// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "./BaseERC20.sol";

contract BaseERC20Factory {
    event TokenDeployed(address indexed creator, address tokenAddress);

    function deployToken(
        string memory name_,
        string memory symbol_,
        uint8 decimals_,
        uint256 initialSupply_
    ) external returns (address) {
        BaseERC20 token = new BaseERC20(name_, symbol_, msg.sender, decimals_, initialSupply_);

        emit TokenDeployed(msg.sender, address(token));
        return address(token);
    }
}
