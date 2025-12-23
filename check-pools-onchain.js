#!/usr/bin/env node

const { ethers } = require('ethers');
require('dotenv').config();

const provider = new ethers.JsonRpcProvider(process.env.ETH_HTTP_ENDPOINT);
const poolManagerAddress = process.env.CREATOR_POOL_MANAGER_ADDRESS;

// CreatorPoolManager ABI
const poolManagerABI = [
  'function poolExists(address token) view returns (bool)',
  'function pools(address) view returns (bool exists, address token, uint256 reserveToken, uint256 reserveNative)'
];

const tokenAddresses = [
  '0x1856168f689523a4f8884331c86e227c07188948', // PRO
  '0x3489d49e1d83318072689706515bc0dba037e5d3', // ABHI
  '0x2be65e914317bb2f78d1d922a82dee870bb464ab', // DEVAL
  '0x7d450acc7850d36cc75e81b7523e0b84312b4124', // SACHIN
  '0x3c3c9d9fc4b09a03ba8596cc35129a4bf1783dbf', // CAP10
  '0x72631fdcd7ebff9af8cfa59400c7e17f65925711', // FUNDFLOW
  '0x39533970751d6c5ec38198ecb7f58f0222f27dc1', // ABHISHEK 1
  '0xcfece8f9d14e657be3f2834ab17c57d8e79c1c1c', // ABHISHEK 2
  '0x1234567890123456789012345678901234567890'  // ELON (test)
];

(async () => {
  try {
    console.log('🔍 Checking pools on-chain...');
    console.log(`Pool Manager: ${poolManagerAddress}`);
    console.log(`RPC: ${process.env.ETH_HTTP_ENDPOINT}\n`);
    console.log('='.repeat(80));

    const poolManager = new ethers.Contract(
      poolManagerAddress,
      poolManagerABI,
      provider
    );

    for (const tokenAddress of tokenAddresses) {
      try {
        console.log(`\nChecking token: ${tokenAddress}`);

        const exists = await poolManager.poolExists(tokenAddress);
        console.log(`  Pool exists: ${exists ? '✅ YES' : '❌ NO'}`);

        if (exists) {
          const pool = await poolManager.pools(tokenAddress);
          console.log(`  Token Reserve: ${pool.reserveToken.toString()}`);
          console.log(`  Native Reserve: ${pool.reserveNative.toString()}`);

          // Calculate price
          if (pool.reserveToken > 0n) {
            const nativeAmount = Number(pool.reserveNative) / 1e18;
            const tokenAmount = Number(pool.reserveToken) / 1e18;
            const price = nativeAmount / tokenAmount;
            console.log(`  Price: ${price.toFixed(9)} ETH per token`);
          }
        }
      } catch (error) {
        console.log(`  ❌ Error: ${error.message}`);
      }
    }

    console.log('\n' + '='.repeat(80));
    console.log('✅ Done checking on-chain pools');

  } catch (error) {
    console.error('❌ Fatal error:', error.message);
    console.error(error.stack);
  }
})();
