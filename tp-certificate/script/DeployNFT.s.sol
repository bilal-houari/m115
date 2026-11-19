// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {CertificateNFT} from "../contracts/CertificateNFT.sol";

interface Vm {
    function startBroadcast() external;
    function stopBroadcast() external;
}

contract DeployNFTScript {
    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
    address private constant ANVIL_DEPLOYER = 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266;
    address private constant ANVIL_ADMIN = 0x70997970C51812dc3A010C7d01b50e0d17dc79C8;
    address private constant ANVIL_ADMIN_2 = 0x90F79bf6EB2c4f870365E785982E1f101E93b906;

    function run() external returns (CertificateNFT registry) {
        vm.startBroadcast();
        registry = new CertificateNFT();
        registry.grantRole(registry.DEFAULT_ADMIN_ROLE(), ANVIL_ADMIN);
        registry.grantRole(registry.MINTER_ROLE(), ANVIL_ADMIN);
        registry.grantRole(registry.DEFAULT_ADMIN_ROLE(), ANVIL_ADMIN_2);
        registry.grantRole(registry.MINTER_ROLE(), ANVIL_ADMIN_2);
        registry.renounceRole(registry.MINTER_ROLE(), ANVIL_DEPLOYER);
        registry.renounceRole(registry.DEFAULT_ADMIN_ROLE(), ANVIL_DEPLOYER);
        vm.stopBroadcast();
    }
}
