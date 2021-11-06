// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity ^0.8.6;

import "ds-test/test.sol";

import "./MingingdaoMiners.sol";

contract MingingdaoMinersTest is DSTest {
    MingingdaoMiners miners;

    function setUp() public {
        miners = new MingingdaoMiners();
    }

    function testFail_basic_sanity() public {
        assertTrue(false);
    }

    function test_basic_sanity() public {
        assertTrue(true);
    }
}
