// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {CertificateRegistry} from "../contracts/CertificateRegistry.sol";

interface Vm {
    function startBroadcast() external;
    function stopBroadcast() external;
}

/// @notice Forge script without an external library dependency.
contract DeployScript {
    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
    address private constant ANVIL_ADMIN = 0x70997970C51812dc3A010C7d01b50e0d17dc79C8;

    function run() external returns (CertificateRegistry registry) {
        vm.startBroadcast();
        registry = new CertificateRegistry();
        registry.transferOwnership(ANVIL_ADMIN);
        vm.stopBroadcast();
    }
}
