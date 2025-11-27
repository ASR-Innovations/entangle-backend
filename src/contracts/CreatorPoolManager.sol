// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract CreatorPoolManager is Ownable {
    struct Pool {
        bool exists;
        address token;
        uint256 reserveToken;
        uint256 reserveNative;
    }

    // token -> pool
    mapping(address => Pool) public pools;

    // MeetingAuction authorized to initialize pools
    address public auctionContract;

    event PoolInitialized(address indexed token, uint256 tokenAmount, uint256 nativeAmount);
    event LiquidityAdded(address indexed provider, address indexed token, uint256 tokenAmount, uint256 nativeAmount);
    event SwapNativeForToken(address indexed user, address indexed token, uint256 nativeIn, uint256 tokenOut);
    event SwapTokenForNative(address indexed user, address indexed token, uint256 tokenIn, uint256 nativeOut);

    modifier onlyAuction() {
        require(msg.sender == auctionContract, "Not auction");
        _;
    }

    function setAuctionContract(address _auction) external onlyOwner {
        require(_auction != address(0), "Invalid auction");
        auctionContract = _auction;
    }

    function poolExists(address token) external view returns (bool) {
        return pools[token].exists;
    }

    // Initialize a pool with initial reserves. Must be called by MeetingAuction, and tokens should be transferred to this contract BEFORE calling.
    function initPool(address token, uint256 tokenAmount) external payable onlyAuction {
        require(token != address(0), "Invalid token");
        require(!pools[token].exists, "Pool exists");
        require(tokenAmount > 0 && msg.value > 0, "Zero reserves");
        pools[token] = Pool({ exists: true, token: token, reserveToken: tokenAmount, reserveNative: msg.value });
        emit PoolInitialized(token, tokenAmount, msg.value);
    }

    // Anyone can add liquidity by providing tokens (approved) plus native
    function addLiquidity(address token, uint256 tokenAmount) external payable {
        Pool storage p = pools[token];
        require(p.exists, "No pool");
        require(tokenAmount > 0 && msg.value > 0, "Zero amounts");
        IERC20(token).transferFrom(msg.sender, address(this), tokenAmount);
        p.reserveToken += tokenAmount;
        p.reserveNative += msg.value;
        emit LiquidityAdded(msg.sender, token, tokenAmount, msg.value);
    }

    // Swap exact native for token using x*y=k
    function swapExactNativeForToken(address token) external payable returns (uint256 amountOut) {
        Pool storage p = pools[token];
        require(p.exists, "No pool");
        require(msg.value > 0, "Zero input");
        // Constant product formula: out = (reserveToken * dx) / (reserveNative + dx)
        amountOut = (p.reserveToken * msg.value) / (p.reserveNative + msg.value);
        require(amountOut > 0 && amountOut < p.reserveToken, "Insufficient liquidity");
        p.reserveNative += msg.value;
        p.reserveToken -= amountOut;
        IERC20(token).transfer(msg.sender, amountOut);
        emit SwapNativeForToken(msg.sender, token, msg.value, amountOut);
    }

    // Swap exact token for native using x*y=k
    function swapExactTokenForNative(address token, uint256 amountIn) external returns (uint256 amountOut) {
        Pool storage p = pools[token];
        require(p.exists, "No pool");
        require(amountIn > 0, "Zero input");
        // out = (reserveNative * dx) / (reserveToken + dx)
        amountOut = (p.reserveNative * amountIn) / (p.reserveToken + amountIn);
        require(amountOut > 0 && amountOut < p.reserveNative, "Insufficient liquidity");
        IERC20(token).transferFrom(msg.sender, address(this), amountIn);
        p.reserveToken += amountIn;
        p.reserveNative -= amountOut;
        (bool ok, ) = payable(msg.sender).call{ value: amountOut }("");
        require(ok, "Native transfer failed");
        emit SwapTokenForNative(msg.sender, token, amountIn, amountOut);
    }
} 