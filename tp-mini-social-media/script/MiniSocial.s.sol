// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {MiniSocial} from "../src/MiniSocial.sol";

contract MiniSocialScript is Script {
    function run() external returns (MiniSocial social) {
        vm.startBroadcast();
        social = new MiniSocial();
        vm.stopBroadcast();

        console.log("MiniSocial deployed at:", address(social));
    }
}
