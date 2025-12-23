// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/presets/ERC20PresetMinterPauser.sol";

contract CreatorTokenFactory is Ownable {
    address public authorizedMinter; // MeetingAuction address

    event TokenCreated(address indexed creator, address token, string name, string symbol, address minter);
    event AuthorizedMinterUpdated(address indexed minter);

    function setAuthorizedMinter(address minter) external onlyOwner {
        require(minter != address(0), "Invalid minter");
        authorizedMinter = minter;
        emit AuthorizedMinterUpdated(minter);
    }

    function createToken(string memory name, string memory symbol, address minter) external returns (address) {
        require(msg.sender == authorizedMinter, "Not authorized");
        ERC20PresetMinterPauser token = new ERC20PresetMinterPauser(name, symbol);
        bytes32 MINTER_ROLE = token.MINTER_ROLE();
        token.grantRole(MINTER_ROLE, minter);
        token.revokeRole(MINTER_ROLE, address(this));
        emit TokenCreated(tx.origin, address(token), name, symbol, minter);
        return address(token);
    }
} 