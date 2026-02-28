// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {PayrollRegistry} from "../src/PayrollRegistry.sol";

contract Deploy is Script {
    function run() external returns (PayrollRegistry registry) {
        uint256 deployerKey = vm.envUint("PRIVATE_KEY");

        vm.startBroadcast(deployerKey);

        registry = new PayrollRegistry();

        console2.log("=== PayrollRegistry Deployed ===");
        console2.log("Address    :", address(registry));
        console2.log("Chain ID   :", block.chainid);
        console2.log("Deployer   :", vm.addr(deployerKey));

        vm.stopBroadcast();
    }
}
