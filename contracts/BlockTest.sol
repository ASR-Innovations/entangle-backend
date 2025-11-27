// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/**
 * @title BlockTest
 * @dev Simple contract to get the actual L2 block number
 * This is necessary on Arbitrum because provider.getBlockNumber() 
 * returns L1 block, but block.number in Solidity returns L2 block
 */
contract BlockTest {
    uint256 public lastBlockNumber;
    
    /**
     * @dev Get the current block number (L2 on Arbitrum)
     */
    function getBlockNumber() external view returns (uint256) {
        return block.number;
    }
    
    /**
     * @dev Record the current block number
     */
    function recordBlock() external {
        lastBlockNumber = block.number;
    }
}
