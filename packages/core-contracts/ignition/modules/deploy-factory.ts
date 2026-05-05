import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

export default buildModule("DeployFactories", (m) => {
    // Deploy the BaseERC20Factory contract
    const erc20Factory = m.contract("BaseERC20Factory");
    const erc721Factory = m.contract("BaseERC721Factory");
    return { erc20Factory, erc721Factory };
});
