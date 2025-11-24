#!/bin/bash

# Clear old environment variables that might interfere
unset RPC_URL
unset CONTRACT_ADDRESS
unset AUCTION_CONTRACT_ADDRESS
unset WS_RPC_URL
unset AVALANCHE_URL

# Start the server with fresh environment from .env file
npm start
