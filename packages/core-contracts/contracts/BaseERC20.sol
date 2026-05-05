// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract BaseERC20 is ERC20 {
    uint8 private _customDecimals;

    constructor(
        string memory name_,
        string memory symbol_,
        address owner_,
        uint8 decimals_,
        uint256 initialSupply_
    ) ERC20(name_, symbol_) {
        _customDecimals = decimals_;
        _mint(owner_, initialSupply_ * 10 ** decimals());
    }

    function decimals() public view override returns (uint8) {
        return _customDecimals;
    }
}
