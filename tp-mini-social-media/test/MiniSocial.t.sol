// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {MiniSocial} from "../src/MiniSocial.sol";

contract MiniSocialTest is Test {
    MiniSocial private social;

    address private alice = address(0xA11CE);
    address private bob = address(0xB0B);

    function setUp() public {
        social = new MiniSocial();
    }

    function testStartsEmpty() public view {
        assertEq(social.getTotalPosts(), 0);
    }

    function testPublishAndReadOnePost() public {
        vm.prank(alice);
        social.publishPost("Hello from Alice");

        assertEq(social.getTotalPosts(), 1);

        (string memory message, address author) = social.getPost(0);
        assertEq(message, "Hello from Alice");
        assertEq(author, alice);
    }

    function testTwoDifferentAuthors() public {
        vm.prank(alice);
        social.publishPost("First post");

        vm.prank(bob);
        social.publishPost("Second post");

        assertEq(social.getTotalPosts(), 2);

        (string memory first, address firstAuthor) = social.getPost(0);
        (string memory second, address secondAuthor) = social.getPost(1);

        assertEq(first, "First post");
        assertEq(firstAuthor, alice);
        assertEq(second, "Second post");
        assertEq(secondAuthor, bob);
    }

    function testUnknownPostReverts() public {
        vm.expectRevert("Post does not exist");
        social.getPost(0);
    }
}
