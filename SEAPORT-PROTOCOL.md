


# Prerequisite: Setup

The goal of this tutorial is to use the [OpenSea SDK](https://github.com/ProjectOpenSea/opensea-js) to buy and sell NFTs programmatically. Before we get started, you'll need a few things.

## Create an OpenSea wallet

*Note:* if you already have a wallet through a different provider (ex. [Metamask](https://metamask.io/)), you can export your private key through their preferred method and move on to the next step.

In order to create offers and listings, you'll need a wallet funded with cryptocurrency. Start by going to the [OpenSea](https://opensea.io/) website and creating an account by clicking the "Login" button in the top right corner. After your account is created, you'll see your new Ethereum address.

<Image align="center" width="40% " src="https://files.readme.io/000e4ed-Screenshot_2024-01-10_at_11.08.59_AM.png" />

After your wallet has been created, add some funds to it. See this OpenSea Help Center [article](https://support.opensea.io/hc/en-us/articles/1500012903682-How-do-I-add-funds-with-a-credit-or-debit-card) for how to add funds if you aren't sure.

For the rest of this tutorial, you'll need your newly created wallet's private key. Go to "Settings" -> "Export private key", authenticate, and note the key down somewhere safe.

> 🚧 Please do not share your private key with anyone.

## Get an OpenSea API Key

You'll need an OpenSea API Key to use our SDK. Follow this [guide](https://docs.opensea.io/reference/api-keys) to get one.

## Get an Alchemy API Key

[Alchemy](https://dashboard.alchemy.com/) provides tools to interact with the Ethereum network and will be our RPC provider for the rest of this tutorial. Go to their [website](https://dashboard.alchemy.com/) and create an API key for the chain of your choosing.

***

## Download the example code

[This](https://github.com/ProjectOpenSea/buy-sell-opensea-sdk-demo/tree/main) Github repo is an example on the basics of using our SDK to buy and sell NFTs. Clone it and `cd `into the directory.

```
git clone git@github.com:ProjectOpenSea/buy-sell-opensea-sdk-demo.git
```

```
cd buy-sell-opensea-sdk-demo
```

## Set environment variables

At this point, you should have three things:

* A funded wallet
* An OpenSea API key
* An Alchemy API Key

Set these as environment variables like this:

```
export OPENSEA_API_KEY='<YOUR_OPENSEA_API_KEY>' && 
export WALLET_PRIV_KEY='<YOUR_WALLET_PRIVATE_KEY>' 
&& export ALCHEMY_API_KEY='<YOUR_ALCHEMY_API_KEY>'

```

***



# Prerequisite: Setup

The goal of this tutorial is to use the [OpenSea SDK](https://github.com/ProjectOpenSea/opensea-js) to buy and sell NFTs programmatically. Before we get started, you'll need a few things.

## Create an OpenSea wallet

*Note:* if you already have a wallet through a different provider (ex. [Metamask](https://metamask.io/)), you can export your private key through their preferred method and move on to the next step.

In order to create offers and listings, you'll need a wallet funded with cryptocurrency. Start by going to the [OpenSea](https://opensea.io/) website and creating an account by clicking the "Login" button in the top right corner. After your account is created, you'll see your new Ethereum address.

<Image align="center" width="40% " src="https://files.readme.io/000e4ed-Screenshot_2024-01-10_at_11.08.59_AM.png" />

After your wallet has been created, add some funds to it. See this OpenSea Help Center [article](https://support.opensea.io/hc/en-us/articles/1500012903682-How-do-I-add-funds-with-a-credit-or-debit-card) for how to add funds if you aren't sure.

For the rest of this tutorial, you'll need your newly created wallet's private key. Go to "Settings" -> "Export private key", authenticate, and note the key down somewhere safe.

> 🚧 Please do not share your private key with anyone.

## Get an OpenSea API Key

You'll need an OpenSea API Key to use our SDK. Follow this [guide](https://docs.opensea.io/reference/api-keys) to get one.

## Get an Alchemy API Key

[Alchemy](https://dashboard.alchemy.com/) provides tools to interact with the Ethereum network and will be our RPC provider for the rest of this tutorial. Go to their [website](https://dashboard.alchemy.com/) and create an API key for the chain of your choosing.

***

## Download the example code

[This](https://github.com/ProjectOpenSea/buy-sell-opensea-sdk-demo/tree/main) Github repo is an example on the basics of using our SDK to buy and sell NFTs. Clone it and `cd `into the directory.

```
git clone git@github.com:ProjectOpenSea/buy-sell-opensea-sdk-demo.git
```

```
cd buy-sell-opensea-sdk-demo
```

## Set environment variables

At this point, you should have three things:

* A funded wallet
* An OpenSea API key
* An Alchemy API Key

Set these as environment variables like this:

```
export OPENSEA_API_KEY='<YOUR_OPENSEA_API_KEY>' && 
export WALLET_PRIV_KEY='<YOUR_WALLET_PRIVATE_KEY>' 
&& export ALCHEMY_API_KEY='<YOUR_ALCHEMY_API_KEY>'

```

***



# Offer on an NFT

## Prerequisites

You should have already completed [Part 1: Setup](https://docs.opensea.io/docs/buy-and-sell-setup) where you created all necessary keys and cloned our sample [repo](https://github.com/ProjectOpenSea/buy-sell-opensea-sdk-demo/tree/main) that uses the OpenSea SDK.

## Find a NFT to offer on

First, you'll need to find the NFT you want to make an offer on. Go to [OpenSea](https://opensea.io/assets/ethereum/0x43fa8aeb7eaa2bb74cf1d07281ebebb76a23941c/4941) and browse around to find one you're interested in. At the time of writing this article, [PUNKBITS](https://opensea.io/collection/punkbits-nft) is the number one trending collection on OpenSea, so let's use that for the remainder of the tutorial. Specifically, let's place an offer on [PUNKBITS #6764](https://opensea.io/assets/ethereum/0x43fa8aeb7eaa2bb74cf1d07281ebebb76a23941c/6764). For this particular NFT, the `contractAddress` and `tokenId` are as follows:

* `contractAddress`: `0x43fa8aeb7eaa2bb74cf1d07281ebebb76a23941c`
* `tokenId`: `6764`

You'll need these parameters in the next few sections!

## Update the code

Open up the `[createOffer.ts](https://github.com/ProjectOpenSea/buy-sell-opensea-sdk-demo/blob/main/src/createOffer.ts)` file under the `/src` directory. Here's the code:

```typescript
import { WALLET_ADDRESS, sdk} from './utils/constants';

const createOffer = async () => {
    
    // TODO: Fill in the token address and token ID of the NFT you want to make an offer on
    let tokenAddress: string = "";
    let tokenId: string = "";
    let offerAmount: string = "";

    const offer = {
        accountAddress: WALLET_ADDRESS,
        startAmount: offerAmount,
        asset: {
            tokenAddress: tokenAddress,
            tokenId: tokenId,
        },
    };

    try {
        const response = await sdk.createOffer(offer);
        console.log("Successfully created an offer with orderHash:", response.orderHash);
    } catch (error) {
        console.error("Error in createOffer:", error);
    }
}

// Check if the module is the main entry point
if (require.main === module) {
    // If yes, run the createOffer function
    createOffer().catch((error) => {
        console.error("Error in createOffer:", error);
    });
}

export default createOffer;

```

Before running the script, you need to update Lines 6-8 (add values for `tokenAddress`, `tokenId`, and `offerAmount`) to values that represent the NFT you want to offer on, and the price.

## Create the offer

After setting the above variables, you'll need to first make sure the code compiles:

```
npm run build
```

Next, run the `createOffer` script with this command:

```Text bash
npm run createOffer
```

If the offer was successfully created, you'll see this output from the script:

```
Successfully created an offer with orderHash: 0x12345928q98249834
```

## Validate the offer

Navigate to the [open offers tab](https://opensea.io/account/offers) in your Profile page, you'll see a tab that lists all of your open offers. If you successfully created the offer, it'll show up here. Here's an example from a script run:

<Image align="center" src="https://files.readme.io/e00f380-Screenshot_2024-01-23_at_12.45.55_PM.png" />




# List an NFT

## Prerequisites

You should have already completed [Part 1: Setup](https://docs.opensea.io/docs/buy-and-sell-setup) where you created all necessary keys and cloned our sample [repo](https://github.com/ProjectOpenSea/buy-sell-opensea-sdk-demo/tree/main) that uses the OpenSea SDK.

## Choose your NFT to list

First, you'll need to actually own an NFT before you can list it. If you don't own one, go to [OpenSea](https://opensea.io/), sign in, and find one to buy. Once you've bought one, note the `contractAddress` and the `tokenId` of the NFT. If you look at this [Bored Ape Yacht Club](https://opensea.io/assets/ethereum/0xbc4ca0eda7647a8ab7c2061c2e118a18a936f13d/2413) NFT, you can find the `contractAddress` and the `tokenId` in the URL.

## Update the code

Open up the `[createListing.ts](https://github.com/ProjectOpenSea/buy-sell-opensea-sdk-demo/blob/main/src/createListing.ts)` file under the `/src` directory. Here's the code:

```typescript
import { WALLET_ADDRESS, sdk } from './utils/constants';

const createListing = async () => {

    // TODO: Fill in the token address and token ID of the NFT you want to sell, as well as the price
    let tokenAddress: string = "";
    let tokenId: string = "";
    let listingAmount: string = "";

    const listing = {
        accountAddress: WALLET_ADDRESS,
        startAmount: listingAmount,
        asset: {
            tokenAddress: tokenAddress,
            tokenId: tokenId,
        },
    };

    try {
        const response = await sdk.createListing(listing);
        console.log("Successfully created a listing with orderHash:", response.orderHash);
    } catch (error) {
        console.error("Error in createListing:", error);
    }
}

// Check if the module is the main entry point
if (require.main === module) {
    // If yes, run the createOffer function
    createListing().catch((error) => {
        console.error("Error in createListing:", error);
    });
}

export default createListing;
```

Before running the script, you need to update Lines 6-8 (add values for `tokenAddress`, `tokenId`, and `listingAmount`) to values that represent the NFT you want to list, and the price.

## Create the listing

After setting the above variables, you'll need to first make sure the code compiles:

```powershell bash
npm run build
```

Next, run the `createListing` script with this command:

```powershell bash
npm run createListing
```

If the offer was successfully created, you'll see a similar this output from the script:

```text bash
Successfully created an listing with orderHash: <order_hash>
```

## Validate the listing

Navigate back to the NFTs page on OpenSea. If you've successfully created a new listing, you'll see it there. This is the listing that was created in the test run of this tutorial:

<Image align="center" src="https://files.readme.io/9e25a2a-Screenshot_2024-01-23_at_1.02.54_PM.png" />




# Seaport

An overview of the Seaport protocol and how it powers OpenSea.

<Image align="center" src="https://files.readme.io/ff5b9c7-Screenshot_2024-01-17_at_12.59.49_PM.png" />

# Overview

Seaport is a marketplace protocol for safely and efficiently buying and selling NFTs on the blockchain. Seaport was developed by OpenSea in 2022 and is the most used protocol for NFT transactions. Seaport powers the OpenSea website -- all orders created or fulfilled on OpenSea use the Seaport protocol.

# Notable Links

* [Seaport Repo](https://github.com/ProjectOpenSea/seaport)
* [Metrics](https://dune.com/opensea_team/seaport)
* [Release Blog](https://opensea.io/blog/articles/introducing-seaport-protocol)

***

# How does it work?

Each Seaport order has many components, but we'll first discuss the: the `offer` and the `consideration`.  To oversimplify:

* `offer`: what I am willing to give up (ETH / ERC20 / ERC721 / ERC1155)
* `consideration`: what is required in return (ETH / ERC20 / ERC721 / ERC1155)

For example, if you want to place an offer on an NFT for 1 WETH, the `offer` struct would look similar to this:

**Offer Example**

```json Text
{
  itemType: ItemType.FULL_OPEN,
  address: 0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2,
  identifierOrCriteria: 0
  startAmount: 1000000000000000,
  endAmount: 1000000000000000
}
```

*Breaking it down:*

The `address` and the `identifierOrCriteria ` represent which token is being offered (in this case, [WETH](https://etherscan.io/address/0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2)), and the `startAmount` and `endAmount `  represent how much of that token you're willing to pay. Again, this is just a basic offer at a set price, which is why the amounts are the same.

If the NFT of interest is the [Cool Cats #1](https://opensea.io/assets/ethereum/0x1a92f7381b9f03921564a437210bb9396471050c/1) NFT, then the `consideration ` would look something like this:

**Consideration Example**

```json Text
{
  itemType: ItemType.FULL_OPEN,
  address: 0x1a92f7381b9f03921564a437210bb9396471050c,
  identifierOrCriteria: 1
  startAmount: 1,
  endAmount: 1,
  recipient: <your_address>
}
```

*Breaking it down:*

The `address` is the address of the Cool Cats NFT contract, the `identifierOrCriteria` is 1 because we want the NFT with tokenId 1, and the `startAmount` and `endAmount ` are also 1 because we are offering for a single NFT (with ERC1155s, the amounts are often greater than 1).

***

# How does it work with the OpenSea website?

If you place this offer through the OpenSea website (ex. offering 1 WETH for [Cool Cats #1](https://opensea.io/assets/ethereum/0x1a92f7381b9f03921564a437210bb9396471050c/1)), OpenSea generates a Seaport order with those `offer` and `consideration` structs (and a bunch more info). OpenSea asks you to sign the order, and when you do, the order is submitted to the Seaport contract directly.

OpenSea constantly listens to and stores events on the Seaport protocol. Next time the owner of that NFT logs in, they'll see that offer on their NFT. If they choose to accept, OpenSea generates a "counter-listing" that is then submitted to Seaport.

Once Seaport sees the corresponding counter order, and if the offers are still valid, Seaport makes sure both the seller and the buyer receive the items they expect, and the transaction completes. This was a very high level overview




# Models

This page enumerates the models used within Seaport.

## Basic Models <a name="basic-heading" />

***

### Order Model <a name="order" />

| Field          | Description                                     | Type                         |
| :------------- | :---------------------------------------------- | :--------------------------- |
| **parameters** | the order specifications                        | [`OrderParameters`](#params) |
| **signature**  | either standard 65-byte EDCSA, 64-byte EIP-2098 | `bytes`                      |

*Struct Representation*

```sol Solidity
struct Order {
  struct OrderParameters parameters;
  bytes signature;
}
```

***

### OrderParameters Model <a name="params" />

<HTMLBlock>
  {`
  <table style="width: 100%; border-collapse: collapse;">
  <thead>
  <tr>
    <th style="border: 1px solid #ddd; padding: 8px;">Field</th>
    <th style="border: 1px solid #ddd; padding: 8px;">Description</th>
    <th style="border: 1px solid #ddd; padding: 8px;">Type</th>
  </tr>
  </thead>
  <tbody>
  <tr>
    <td style="border: 1px solid #ddd; padding: 8px;"><p><strong>offerer</strong></p>
  </td>
    <td style="border: 1px solid #ddd; padding: 8px;"><p>The <code>offerer</code> of the order supplies all offered items and must either fulfill the order personally (i.e. <code>msg.sender == offerer</code>) or approve the order via signature (either standard 65-byte EDCSA, 64-byte EIP-2098, or an EIP-1271 <code>isValidSignature</code> check) or by listing the order on-chain (i.e. calling <code>validate</code>)</p>
  </td>
    <td style="border: 1px solid #ddd; padding: 8px;"><p><code>address</code></p>
  </td>
  </tr>
  <tr>
    <td style="border: 1px solid #ddd; padding: 8px;"><p><strong>zone</strong></p>
  </td>
    <td style="border: 1px solid #ddd; padding: 8px;"><p>The <code>zone</code> of the order is an optional secondary account attached to the order with two additional privileges:  </p>
  <ol>
  <li>The zone may cancel orders where it is named as the zone by calling <code>cancel</code>. (Note that offerers can also cancel their own orders, either individually or for all orders signed with their current counter at once by calling <code>incrementCounter</code>).</li>
  <li>&quot;Restricted&quot; orders (as specified by the order type) can be executed by anyone but must be approved by the zone indicated by a call to <code>validateOrder</code> on the zone.</li>
  </ol>
  </td>
    <td style="border: 1px solid #ddd; padding: 8px;"><p><code>address</code></p>
  </td>
  </tr>
  <tr>
    <td style="border: 1px solid #ddd; padding: 8px;"><p><strong>offer</strong></p>
  </td>
    <td style="border: 1px solid #ddd; padding: 8px;"><p>an array of items that may be transferred from the offerer&#39;s account</p>
  </td>
    <td style="border: 1px solid #ddd; padding: 8px;"><p><a href="#offer"><code>OfferItem[]</code></a></p>
  </td>
  </tr>
  <tr>
    <td style="border: 1px solid #ddd; padding: 8px;"><p><strong>consideration</strong></p>
  </td>
    <td style="border: 1px solid #ddd; padding: 8px;"><p>an array of items that must be received in order to fulfill the order</p>
  </td>
    <td style="border: 1px solid #ddd; padding: 8px;"><p><a href="#consideration"><code>ConsiderationItem[]</code></a></p>
  </td>
  </tr>
  <tr>
    <td style="border: 1px solid #ddd; padding: 8px;"><p><strong>orderType</strong></p>
  </td>
    <td style="border: 1px solid #ddd; padding: 8px;"><p>designates one of four types for the order</p>
  </td>
    <td style="border: 1px solid #ddd; padding: 8px;"><p><code>OrderType</code></p>
  </td>
  </tr>
  <tr>
    <td style="border: 1px solid #ddd; padding: 8px;"><p><strong>startTime</strong></p>
  </td>
    <td style="border: 1px solid #ddd; padding: 8px;"><p>block timestamp at which the order becomes active</p>
  </td>
    <td style="border: 1px solid #ddd; padding: 8px;"><p><code>uint256</code></p>
  </td>
  </tr>
  <tr>
    <td style="border: 1px solid #ddd; padding: 8px;"><p><strong>endTime</strong></p>
  </td>
    <td style="border: 1px solid #ddd; padding: 8px;"><p>block timestamp at which the order expires</p>
  </td>
    <td style="border: 1px solid #ddd; padding: 8px;"><p><code>uint256</code></p>
  </td>
  </tr>
  <tr>
    <td style="border: 1px solid #ddd; padding: 8px;"><p><strong>zoneHash</strong></p>
  </td>
    <td style="border: 1px solid #ddd; padding: 8px;"><p>an arbitrary 32-byte value that will be supplied to the zone when fulfilling restricted orders that the zone can utilize when making a determination on whether to authorize the order</p>
  </td>
    <td style="border: 1px solid #ddd; padding: 8px;"><p><code>bytes32</code></p>
  </td>
  </tr>
  <tr>
    <td style="border: 1px solid #ddd; padding: 8px;"><p><strong>salt</strong></p>
  </td>
    <td style="border: 1px solid #ddd; padding: 8px;"><p>an arbitrary source of entropy for the order</p>
  </td>
    <td style="border: 1px solid #ddd; padding: 8px;"><p><code>uint256</code></p>
  </td>
  </tr>
  <tr>
    <td style="border: 1px solid #ddd; padding: 8px;"><p><strong>conduitKey</strong></p>
  </td>
    <td style="border: 1px solid #ddd; padding: 8px;"><p>indicates what conduit, if any, should be utilized as a source for token approvals when performing transfers. By default (i.e. when conduitKey is set to the zero hash), the offerer will grant ERC20, ERC721, and ERC1155 token approvals to Seaport directly so that it can perform any transfers specified by the order during fulfillment</p>
  </td>
    <td style="border: 1px solid #ddd; padding: 8px;"><p><code>bytes32</code></p>
  </td>
  </tr>
  <tr>
    <td style="border: 1px solid #ddd; padding: 8px;"><p><strong>counter</strong></p>
  </td>
    <td style="border: 1px solid #ddd; padding: 8px;"><p>a value that must match the current counter for the given offerer.</p>
  </td>
    <td style="border: 1px solid #ddd; padding: 8px;"><p><code>uint256</code></p>
  </td>
  </tr>
  </tbody>
  </table>
  `}
</HTMLBlock>

*Struct Representation*

```sol Solidity
struct OrderComponents {
  address offerer;
  address zone;
  struct OfferItem[] offer;
  struct ConsiderationItem[] consideration;
  enum OrderType orderType;
  uint256 startTime;
  uint256 endTime;
  bytes32 zoneHash;
  uint256 salt;
  bytes32 conduitKey;
  uint256 counter;
}
```

***

### OfferItem Model <a name="offer" />

| Field                    | Description                                                                                                                                                                                                                                                                                                                        | Type       |
| :----------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :--------- |
| **itemType**             | the type of item, with valid types being Ether (or other native token for the given chain), ERC20, ERC721, ERC1155, ERC721 with "criteria" (explained below), and ERC1155 with criteria                                                                                                                                            | `ItemType` |
| **token**                | designates the address of the item's token contract (with the null address used for Ether or other native tokens)                                                                                                                                                                                                                  | `address`  |
| **identifierOrCriteria** | represents either the ERC721 or ERC1155 token identifier or, in the case of a criteria-based item type, a merkle root composed of the valid set of token identifiers for the item. This value will be ignored for Ether and ERC20 item types, and can optionally be zero for criteria-based item types to allow for any identifier | `uint256`  |
| **startAmount**          | the amount of the item in question that will be required should the order be fulfilled at the moment the order becomes active                                                                                                                                                                                                      | `uint256`  |
| **endAmount**            | the amount of the item in question that will be required should the order be fulfilled at the moment the order expires. If this value differs from the item's `startAmount`, the realized amount is calculated linearly based on the time elapsed since the order became active.                                                   | `uint256`  |
|                          |                                                                                                                                                                                                                                                                                                                                    |            |

*Struct Representation*

```sol Solidity
struct OfferItem {
  enum ItemType itemType;
  address token;
  uint256 identifierOrCriteria;
  uint256 startAmount;
  uint256 endAmount;
}
```

***

### ConsiderationItem Model<a name="consideration" />

| Field                    | Description                                                                                                                                                                                                                                                                                                                        | Type       |
| :----------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :--------- |
| **itemType**             | the type of item, with valid types being Ether (or other native token for the given chain), ERC20, ERC721, ERC1155, ERC721 with "criteria" (explained below), and ERC1155 with criteria                                                                                                                                            | `ItemType` |
| **token**                | designates the address of the item's token contract (with the null address used for Ether or other native tokens)                                                                                                                                                                                                                  | `address`  |
| **identifierOrCriteria** | represents either the ERC721 or ERC1155 token identifier or, in the case of a criteria-based item type, a merkle root composed of the valid set of token identifiers for the item. This value will be ignored for Ether and ERC20 item types, and can optionally be zero for criteria-based item types to allow for any identifier | `uint256`  |
| **startAmount**          | the amount of the item in question that will be required should the order be fulfilled at the moment the order becomes active                                                                                                                                                                                                      | `uint256`  |
| **endAmount**            | the amount of the item in question that will be required should the order be fulfilled at the moment the order expires. If this value differs from the item's `startAmount`, the realized amount is calculated linearly based on the time elapsed since the order became active.                                                   | `uint256`  |
| **recipient**            | the address that will receive the consideration item upon fulfillment                                                                                                                                                                                                                                                              | `address`  |

*Struct Representation*

```sol Solidity
struct ConsiderationItem {
  enum ItemType itemType;
  address token;
  uint256 identifierOrCriteria;
  uint256 startAmount;
  uint256 endAmount;
  address payable recipient;
}
```

***

### AdvancedOrder Model <a name="advanced" />

| Field           | Description                                                                                                   | Type              |
| :-------------- | :------------------------------------------------------------------------------------------------------------ | :---------------- |
| **parameters**  | the order specifications                                                                                      | `OrderParameters` |
| **numerator**   | supply for partial fills                                                                                      | `uint120`         |
| **denominator** | supply for partial fills                                                                                      | `uint120`         |
| **signature**   | either standard 65-byte EDCSA, 64-byte EIP-2098                                                               | `bytes`           |
| **extraData**   | supplied as part of a call to the `validateOrder` function on the zone when fulfilling restricted order types | `bytes`           |

*Struct Representation*

```sol Solidity
struct AdvancedOrder {
  struct OrderParameters parameters;
  uint120 numerator;
  uint120 denominator;
  bytes signature;
  bytes extraData;
}
```

***

## Fulfillment <a name="fulfillment-heading" />

***

### Spent Item Model <a name="spent" />

| Field          | Description                                                                                                                                                                                                                                                                                                                        | Type       |
| :------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :--------- |
| **itemType**   | the type of item, with valid types being Ether (or other native token for the given chain), ERC20, ERC721, ERC1155, ERC721 with "criteria" (explained below), and ERC1155 with criteria                                                                                                                                            | `ItemType` |
| **token**      | designates the address of the item's token contract (with the null address used for Ether or other native tokens)                                                                                                                                                                                                                  | `address`  |
| **identifier** | represents either the ERC721 or ERC1155 token identifier or, in the case of a criteria-based item type, a merkle root composed of the valid set of token identifiers for the item. This value will be ignored for Ether and ERC20 item types, and can optionally be zero for criteria-based item types to allow for any identifier | `uint256`  |
| **amount**     | the amount of the item in question that will be required should the order be fulfilled at the moment the order becomes active                                                                                                                                                                                                      | `uint256`  |

*Struct Representation*

```sol Solidity
struct SpentItem {
  enum ItemType itemType;
  address token;
  uint256 identifier;
  uint256 amount;
}
```

***

### Received Item Model <a name="received" />

| Field          | Description                                                                                                                                                                                                                                                                                                                        | Type       |
| :------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :--------- |
| **itemType**   | the type of item, with valid types being Ether (or other native token for the given chain), ERC20, ERC721, ERC1155, ERC721 with "criteria" (explained below), and ERC1155 with criteria                                                                                                                                            | `ItemType` |
| **token**      | designates the address of the item's token contract (with the null address used for Ether or other native tokens)                                                                                                                                                                                                                  | `address`  |
| **identifier** | represents either the ERC721 or ERC1155 token identifier or, in the case of a criteria-based item type, a merkle root composed of the valid set of token identifiers for the item. This value will be ignored for Ether and ERC20 item types, and can optionally be zero for criteria-based item types to allow for any identifier | `uint256`  |
| **amount**     | the amount of the item in question that will be required should the order be fulfilled at the moment the order becomes active                                                                                                                                                                                                      | `uint256`  |

*Struct Representation*

```sol Solidity
struct ReceivedItem {
  enum ItemType itemType;
  address token;
  uint256 identifier;
  uint256 amount;
  address payable recipient;
}
```

***

### BasicOrderParameters Model <a name="basic" />

<HTMLBlock>
  {`
  <table style="width: 100%; border-collapse: collapse;">
  <thead>
  <tr>
    <th style="border: 1px solid #ddd; padding: 8px;">Field</th>
    <th style="border: 1px solid #ddd; padding: 8px;">Description</th>
    <th style="border: 1px solid #ddd; padding: 8px;">Type</th>
  </tr>
  </thead>
  <tbody>
  <tr>
    <td style="border: 1px solid #ddd; padding: 8px;"><p><strong>considerationToken</strong></p>
  </td>
    <td style="border: 1px solid #ddd; padding: 8px;"><p>designates the address of the consideration item</p>
  </td>
    <td style="border: 1px solid #ddd; padding: 8px;"><p><code>address</code></p>
  </td>
  </tr>
  <tr>
    <td style="border: 1px solid #ddd; padding: 8px;"><p><strong>considerationIdentifier</strong></p>
  </td>
    <td style="border: 1px solid #ddd; padding: 8px;"><p>represents either the ERC721 or ERC1155 token identifier or, in the case of a criteria-based item type, a merkle root composed of the valid set of token identifiers for the item. This value will be ignored for Ether and ERC20 item types, and can optionally be zero for criteria-based item types to allow for any identifier</p>
  </td>
    <td style="border: 1px solid #ddd; padding: 8px;"><p><code>uint256</code></p>
  </td>
  </tr>
  <tr>
    <td style="border: 1px solid #ddd; padding: 8px;"><p><strong>considerationAmount</strong></p>
  </td>
    <td style="border: 1px solid #ddd; padding: 8px;"><p>the amount of the item in question that will be required should the order be fulfilled at the moment the order becomes active</p>
  </td>
    <td style="border: 1px solid #ddd; padding: 8px;"><p><code>uint256</code></p>
  </td>
  </tr>
  <tr>
    <td style="border: 1px solid #ddd; padding: 8px;"><p><strong>offerer</strong></p>
  </td>
    <td style="border: 1px solid #ddd; padding: 8px;"><p>The <code>offerer</code> of the order supplies all offered items and must either fulfill the order personally (i.e. <code>msg.sender == offerer</code>) or approve the order via signature (either standard 65-byte EDCSA, 64-byte EIP-2098, or an EIP-1271 <code>isValidSignature</code> check) or by listing the order on-chain (i.e. calling <code>validate</code>)</p>
  </td>
    <td style="border: 1px solid #ddd; padding: 8px;"><p><code>uint256</code></p>
  </td>
  </tr>
  <tr>
    <td style="border: 1px solid #ddd; padding: 8px;"><p><strong>zone</strong></p>
  </td>
    <td style="border: 1px solid #ddd; padding: 8px;"><p>The <code>zone</code> of the order is an optional secondary account attached to the order with two additional privileges:  </p>
  <ol>
  <li>The zone may cancel orders where it is named as the zone by calling <code>cancel</code>. (Note that offerers can also cancel their own orders, either individually or for all orders signed with their current counter at once by calling <code>incrementCounter</code>).</li>
  <li>&quot;Restricted&quot; orders (as specified by the order type) can be executed by anyone but must be approved by the zone indicated by a call to <code>validateOrder</code> on the zone.</li>
  </ol>
  </td>
    <td style="border: 1px solid #ddd; padding: 8px;"><p><code>address</code></p>
  </td>
  </tr>
  <tr>
    <td style="border: 1px solid #ddd; padding: 8px;"><p><strong>offerToken</strong></p>
  </td>
    <td style="border: 1px solid #ddd; padding: 8px;"><p>address of the token in the orders <code>offer</code></p>
  </td>
    <td style="border: 1px solid #ddd; padding: 8px;"><p><code>address</code></p>
  </td>
  </tr>
  <tr>
    <td style="border: 1px solid #ddd; padding: 8px;"><p><strong>offerIdentifier</strong></p>
  </td>
    <td style="border: 1px solid #ddd; padding: 8px;"><p>the amount of the item in question that will be required should the order be fulfilled at the moment the order becomes active</p>
  </td>
    <td style="border: 1px solid #ddd; padding: 8px;"><p><code>uint256</code></p>
  </td>
  </tr>
  <tr>
    <td style="border: 1px solid #ddd; padding: 8px;"><p><strong>basicOrderType</strong></p>
  </td>
    <td style="border: 1px solid #ddd; padding: 8px;"><p>the amount of the item in question that will be required should the order be fulfilled at the moment the order becomes active</p>
  </td>
    <td style="border: 1px solid #ddd; padding: 8px;"><p><code>BasicOrderType</code></p>
  </td>
  </tr>
  <tr>
    <td style="border: 1px solid #ddd; padding: 8px;"><p><strong>startTime</strong></p>
  </td>
    <td style="border: 1px solid #ddd; padding: 8px;"><p>the amount of the item in question that will be required should the order be fulfilled at the moment the order becomes active</p>
  </td>
    <td style="border: 1px solid #ddd; padding: 8px;"><p><code>uint256</code></p>
  </td>
  </tr>
  <tr>
    <td style="border: 1px solid #ddd; padding: 8px;"><p><strong>endTime</strong></p>
  </td>
    <td style="border: 1px solid #ddd; padding: 8px;"><p>the amount of the item in question that will be required should the order be fulfilled at the moment the order becomes active</p>
  </td>
    <td style="border: 1px solid #ddd; padding: 8px;"><p><code>uint256</code></p>
  </td>
  </tr>
  <tr>
    <td style="border: 1px solid #ddd; padding: 8px;"><p><strong>zoneHash</strong></p>
  </td>
    <td style="border: 1px solid #ddd; padding: 8px;"><p>the amount of the item in question that will be required should the order be fulfilled at the moment the order becomes active</p>
  </td>
    <td style="border: 1px solid #ddd; padding: 8px;"><p><code>bytes32</code></p>
  </td>
  </tr>
  <tr>
    <td style="border: 1px solid #ddd; padding: 8px;"><p><strong>offererConduitKey</strong></p>
  </td>
    <td style="border: 1px solid #ddd; padding: 8px;"><p>the amount of the item in question that will be required should the order be fulfilled at the moment the order becomes active</p>
  </td>
    <td style="border: 1px solid #ddd; padding: 8px;"><p><code>bytes32</code></p>
  </td>
  </tr>
  <tr>
    <td style="border: 1px solid #ddd; padding: 8px;"><p><strong>fulfillerConduitKey</strong></p>
  </td>
    <td style="border: 1px solid #ddd; padding: 8px;"><p>the amount of the item in question that will be required should the order be fulfilled at the moment the order becomes active</p>
  </td>
    <td style="border: 1px solid #ddd; padding: 8px;"><p><code>bytes32</code></p>
  </td>
  </tr>
  <tr>
    <td style="border: 1px solid #ddd; padding: 8px;"><p><strong>totalOriginalAdditionalRecipients</strong></p>
  </td>
    <td style="border: 1px solid #ddd; padding: 8px;"><p>the amount of the item in question that will be required should the order be fulfilled at the moment the order becomes active</p>
  </td>
    <td style="border: 1px solid #ddd; padding: 8px;"><p><code>uint256</code></p>
  </td>
  </tr>
  <tr>
    <td style="border: 1px solid #ddd; padding: 8px;"><p><strong>totalOriginalAdditionalRecipients</strong></p>
  </td>
    <td style="border: 1px solid #ddd; padding: 8px;"><p>total number of additional recipients</p>
  </td>
    <td style="border: 1px solid #ddd; padding: 8px;"><p><code>uint256</code></p>
  </td>
  </tr>
  <tr>
    <td style="border: 1px solid #ddd; padding: 8px;"><p><strong>additionalRecipients</strong></p>
  </td>
    <td style="border: 1px solid #ddd; padding: 8px;"><p>additional recipients of the conisderation items</p>
  </td>
    <td style="border: 1px solid #ddd; padding: 8px;"><p><code>AdditionalRecipient[]</code></p>
  </td>
  </tr>
  <tr>
    <td style="border: 1px solid #ddd; padding: 8px;"><p><strong>signature</strong></p>
  </td>
    <td style="border: 1px solid #ddd; padding: 8px;"><p>client signature</p>
  </td>
    <td style="border: 1px solid #ddd; padding: 8px;"><p><code>bytes32</code></p>
  </td>
  </tr>
  </tbody>
  </table>
  `}
</HTMLBlock>

*Struct Representation*

```solidity
struct BasicOrderParameters {
  address considerationToken;
  uint256 considerationIdentifier;
  uint256 considerationAmount;
  address payable offerer;
  address zone;
  address offerToken;
  uint256 offerIdentifier;
  uint256 offerAmount;
  enum BasicOrderType basicOrderType;
  uint256 startTime;
  uint256 endTime;
  bytes32 zoneHash;
  uint256 salt;
  bytes32 offererConduitKey;
  bytes32 fulfillerConduitKey;
  uint256 totalOriginalAdditionalRecipients;
  struct AdditionalRecipient[] additionalRecipients;
  bytes signature;
}
```

***

### AdditionalRecipient Model <a name="additional" />

| Field         | Description                                                           | Type      |
| :------------ | :-------------------------------------------------------------------- | :-------- |
| **amount**    | the amount of the item that will be sent to this additional recipient | `uint256` |
| **recipient** | designates the address of this additional recipient                   | `address` |

*Struct Representation*

```sol Solidity
struct AdditionalRecipient {
  uint256 amount;
  address payable recipient;
}
```

***

### OrderStatus Model <a name="status" />

| Field           | Description | Type      |
| :-------------- | :---------- | :-------- |
| **isValidated** | --         | `bool`    |
| **isCancelled** | --         | `bool`    |
| **numerator**   | --         | `uint120` |
| **denominator** | --         | `uint120` |

*Struct Representation*

```sol Solidity
struct OrderStatus {
  bool isValidated;
  bool isCancelled;
  uint120 numerator;
  uint120 denominator;
}
```

***

### CriteriaResolver Model <a name="resolver" />

| Field             | Description | Type        |
| :---------------- | :---------- | :---------- |
| **orderIndex**    | --         | `uint256`   |
| **side**          | --         | `Side`      |
| **index**         | --         | `uint256`   |
| **identifier**    | --         | `uint256`   |
| **criteriaProof** | --         | `bytes32[]` |

*Struct Representation*

```sol Solidity
struct CriteriaResolver {
  uint256 orderIndex;
  enum Side side;
  uint256 index;
  uint256 identifier;
  bytes32[] criteriaProof;
}
```

***

### Fulfillment Model <a name="fulfillment" />

| Field         | Description                                                           | Type      |
| :------------ | :-------------------------------------------------------------------- | :-------- |
| **amount**    | the amount of the item that will be sent to this additional recipient | `uint256` |
| **recipient** | designates the address of this additional recipient                   | `address` |

*Struct Representation*

```sol Solidity
struct Fulfillment {
  struct FulfillmentComponent[] offerComponents;
  struct FulfillmentComponent[] considerationComponents;
}
```

***

### FulfillmentComponent Model<a name="component" />

| Field         | Description                                                           | Type      |
| :------------ | :-------------------------------------------------------------------- | :-------- |
| **amount**    | the amount of the item that will be sent to this additional recipient | `uint256` |
| **recipient** | designates the address of this additional recipient                   | `address` |

*Struct Representation*

```sol Solidity
struct FulfillmentComponent {
  uint256 orderIndex;
  uint256 itemIndex;
}
```

***

### Execution Model <a name="component" />

| Field         | Description                                                           | Type      |
| :------------ | :-------------------------------------------------------------------- | :-------- |
| **amount**    | the amount of the item that will be sent to this additional recipient | `uint256` |
| **recipient** | designates the address of this additional recipient                   | `address` |

*Struct Representation*

```sol Solidity
struct Execution {
  struct ReceivedItem item;
  address offerer;
  bytes32 conduitKey;
}
```

***

### ZoneParameters Model<a name="zone" />

```sol Solidity
struct ZoneParameters {
    bytes32 orderHash;
    address fulfiller;
    address offerer;
    SpentItem[] offer;
    ReceivedItem[] consideration;
    bytes extraData;
    bytes32[] orderHashes;
    uint256 startTime;
    uint256 endTime;
    bytes32 zoneHash;
}
```


# Interface

Method definitions for the Seaport contract

### fulfillBasicOrder <a name="fulfill-basic" />

Fulfill an order that offers ether (the native token for the given chain) or ERC20 to ERC721/ERC1155 or ERC721/ERC1155 to ERC20. An arbitrary number of "additional recipients" may also be         supplied which will each receive native tokens from the fulfiller  as consideration.

```solidity
function fulfillBasicOrder(struct BasicOrderParameters parameters) 
  external payable returns (bool fulfilled)
```

| Name           | Type                   | Description                                                                                                                                                                                                                                                                        |
| -------------- | ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **parameters** | `BasicOrderParameters` | Additional information on the fulfilled order. Note                   that the offerer must first approve this contract (or                   their preferred conduit if indicated by the order) for                   their offered ERC20/ERC721/ERC1155 token to be transferred. |

| Name          | Type   | Description                                                             |
| ------------- | ------ | ----------------------------------------------------------------------- |
| **fulfilled** | `bool` | A boolean indicating whether the order has been successfully fulfilled. |

***

### fulfillOrder <a name="fulfill" />

Fulfill an order with an arbitrary number of items for offer and         consideration. Note that this function does not support         criteria-based orders or partial filling of orders (though         filling the remainder of a partially-filled order is supported).

```sol Solidity
function fulfillOrder(struct Order order, bytes32 fulfillerConduitKey) 
  external payable returns (bool fulfilled)
```

| Name                    | Type      | Description                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| ----------------------- | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **order**               | `Order`   | The order to fulfill. Note that both the                            offerer and the fulfiller must first approve                            this contract (or the corresponding conduit if                            indicated) to transfer any relevant tokens on                            their behalf and that contracts must implement                            `onERC1155Received` to receive ERC1155 tokens                            as consideration. |
| **fulfillerConduitKey** | `bytes32` | A bytes32 value indicating what conduit, if                            any, to source the fulfiller's token approvals                            from. The zero hash signifies that no conduit                            should be used, with direct approvals set on                            Seaport.                                                                                                                                                          |

| Name          | Type   | Description                                                                               |
| ------------- | ------ | ----------------------------------------------------------------------------------------- |
| **fulfilled** | `bool` | A boolean indicating whether the order has been                   successfully fulfilled. |

***

### fulfillAdvancedOrder <a name="fulfill-advanced" />

Fill an order, fully or partially, with an arbitrary number of         items for offer and consideration alongside criteria resolvers         containing specific token identifiers and associated proofs.

```sol Solidity
function fulfillAdvancedOrder(
  struct AdvancedOrder advancedOrder, 
  struct CriteriaResolver[] criteriaResolvers, 
  bytes32 fulfillerConduitKey, 
  address recipient) 
external payable returns (bool fulfilled)
```

| Name                    | Type                 | Description                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| ----------------------- | -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **advancedOrder**       | `AdvancedOrder`      | The order to fulfill along with the fraction                            of the order to attempt to fill. Note that                            both the offerer and the fulfiller must first                            approve this contract (or their preferred                            conduit if indicated by the order) to transfer                            any relevant tokens on their behalf and that                            contracts must implement `onERC1155Received`                            to receive ERC1155 tokens as consideration.                            Also note that all offer and consideration                            components must have no remainder after                            multiplication of the respective amount with                            the supplied fraction for the partial fill to                            be considered valid. |
| **criteriaResolvers**   | `CriteriaResolver[]` | An array where each element contains a                            reference to a specific offer or                            consideration, a token identifier, and a proof                            that the supplied token identifier is                            contained in the merkle root held by the item                            in question's criteria element. Note that an                            empty criteria indicates that any                            (transferable) token identifier on the token                            in question is valid and that no associated                            proof needs to be supplied.                                                                                                                                                                                                                                           |
| **fulfillerConduitKey** | `bytes32`            | A bytes32 value indicating what conduit, if                            any, to source the fulfiller's token approvals                            from. The zero hash signifies that no conduit                            should be used, with direct approvals set on                            Seaport.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| **recipient**           | `address`            | The intended recipient for all received items,                            with `address(0)` indicating that the caller                            should receive the items.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |

| Name          | Type   | Description                                                                               |
| ------------- | ------ | ----------------------------------------------------------------------------------------- |
| **fulfilled** | `bool` | A boolean indicating whether the order has been                   successfully fulfilled. |

***

### fulfillAvailableOrders <a name="fulfill-available" />

Attempt to fill a group of orders, each with an arbitrary number         of items for offer and consideration. Any order that is not         currently active, has already been fully filled, or has been         cancelled will be omitted. Remaining offer and consideration         items will then be aggregated where possible as indicated by the         supplied offer and consideration component arrays and aggregated         items will be transferred to the fulfiller or to each intended         recipient, respectively. Note that a failing item transfer or an         issue with order formatting will cause the entire batch to fail.         Note that this function does not support criteria-based orders or         partial filling of orders (though filling the remainder of a         partially-filled order is supported).

```sol Solidity
function fulfillAvailableOrders(struct Order[] orders, struct FulfillmentComponent[][] offerFulfillments, struct FulfillmentComponent[][] considerationFulfillments, bytes32 fulfillerConduitKey, uint256 maximumFulfilled) external payable returns (bool[] availableOrders, struct Execution[] executions)
```

| Name                          | Type                              | Description                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| ----------------------------- | --------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **orders**                    | `Order[]`                         | The orders to fulfill. Note that both                                  the offerer and the fulfiller must first                                  approve this contract (or the                                  corresponding conduit if indicated) to                                  transfer any relevant tokens on their                                  behalf and that contracts must implement                                  `onERC1155Received` to receive ERC1155                                  tokens as consideration. |
| **offerFulfillments**         | `FulfillmentComponent[][]`        | An array of FulfillmentComponent arrays                                  indicating which offer items to attempt                                  to aggregate when preparing executions.                                                                                                                                                                                                                                                                                                                                                 |
| **considerationFulfillments** | `struct FulfillmentComponent[][]` | An array of FulfillmentComponent arrays                                  indicating which consideration items to                                  attempt to aggregate when preparing                                  executions.                                                                                                                                                                                                                                                                                                        |
| **fulfillerConduitKey**       | `bytes32`                         | A bytes32 value indicating what conduit,                                  if any, to source the fulfiller's token                                  approvals from. The zero hash signifies                                  that no conduit should be used, with                                  direct approvals set on this contract.                                                                                                                                                                                                  |
| **maximumFulfilled**          | `uint256`                         | The maximum number of orders to fulfill.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |

| Name                | Type          | Description                                                                                                                                                                            |
| ------------------- | ------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **availableOrders** | `bool[]`      | An array of booleans indicating if each order                         with an index corresponding to the index of the                         returned boolean was fulfillable or not. |
| **executions**      | `Execution[]` | An array of elements indicating the sequence of                         transfers performed as part of matching the given                         orders.                              |

***

### fulfillAvailableAdvancedOrders <a name="fulfill-available-advanced" />

Attempt to fill a group of orders, fully or partially, with an         arbitrary number of items for offer and consideration per order         alongside criteria resolvers containing specific token         identifiers and associated proofs. Any order that is not         currently active, has already been fully filled, or has been         cancelled will be omitted. Remaining offer and consideration         items will then be aggregated where possible as indicated by the         supplied offer and consideration component arrays and aggregated         items will be transferred to the fulfiller or to each intended         recipient, respectively. Note that a failing item transfer or an         issue with order formatting will cause the entire batch to fail.

```sol Solidity
function fulfillAvailableAdvancedOrders(
  struct AdvancedOrder[] advancedOrders, 
  struct CriteriaResolver[] criteriaResolvers, 
  struct FulfillmentComponent[][] offerFulfillments, 
  struct FulfillmentComponent[][] considerationFulfillments, 
  bytes32 fulfillerConduitKey, 
  address recipient, 
  uint256 maximumFulfilled) 
  external payable returns (bool[] availableOrders, struct Execution[] executions)
```

| Name                          | Type                       | Description                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| ----------------------------- | -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **advancedOrders**            | `AdvancedOrder[]`          | The orders to fulfill along with the                                  fraction of those orders to attempt to                                  fill. Note that both the offerer and the                                  fulfiller must first approve this                                  contract (or their preferred conduit if                                  indicated by the order) to transfer any                                  relevant tokens on their behalf and that                                  contracts must implement                                  `onERC1155Received` to enable receipt of                                  ERC1155 tokens as consideration. Also                                  note that all offer and consideration                                  components must have no remainder after                                  multiplication of the respective amount                                  with the supplied fraction for an                                  order's partial fill amount to be                                  considered valid. |
| **criteriaResolvers**         | `CriteriaResolver[]`       | An array where each element contains a                                  reference to a specific offer or                                  consideration, a token identifier, and a                                  proof that the supplied token identifier                                  is contained in the merkle root held by                                  the item in question's criteria element.                                  Note that an empty criteria indicates                                  that any (transferable) token                                  identifier on the token in question is                                  valid and that no associated proof needs                                  to be supplied.                                                                                                                                                                                                                                                                                                                                                           |
| **offerFulfillments**         | `FulfillmentComponent[][]` | An array of FulfillmentComponent arrays                                  indicating which offer items to attempt                                  to aggregate when preparing executions.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| **considerationFulfillments** | `FulfillmentComponent[][]` | An array of FulfillmentComponent arrays                                  indicating which consideration items to                                  attempt to aggregate when preparing                                  executions.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| **fulfillerConduitKey**       | `bytes32`                  | A bytes32 value indicating what conduit,                                  if any, to source the fulfiller's token                                  approvals from. The zero hash signifies                                  that no conduit should be used, with                                  direct approvals set on this contract.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| **recipient**                 | `address`                  | The intended recipient for all received                                  items, with `address(0)` indicating that                                  the caller should receive the items.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| **maximumFulfilled**          | `uint256`                  | The maximum number of orders to fulfill.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |

| Name                | Type          | Description                                                                                                                                                                            |
| ------------------- | ------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **availableOrders** | `bool[]`      | An array of booleans indicating if each order                         with an index corresponding to the index of the                         returned boolean was fulfillable or not. |
| **executions**      | `Execution[]` | An array of elements indicating the sequence of                         transfers performed as part of matching the given                         orders.                              |

***

### matchOrders <a name="match" />

Match an arbitrary number of orders, each with an arbitrary         number of items for offer and consideration along with a set of         fulfillments allocating offer components to consideration         components. Note that this function does not support         criteria-based or partial filling of orders (though filling the         remainder of a partially-filled order is supported).

```sol Solidity
function matchOrders(
  struct Order[] orders, 
  struct Fulfillment[] fulfillments) 
 external payable returns (struct Execution[] executions)
```

| Name             | Type            | Description                                                                                                                                                                                                                                                                                                                                                                                                        |
| ---------------- | --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **orders**       | `Order[]`       | The orders to match. Note that both the offerer and                     fulfiller on each order must first approve this                     contract (or their conduit if indicated by the order)                     to transfer any relevant tokens on their behalf and                     each consideration recipient must implement                     `onERC1155Received` to enable ERC1155 token receipt. |
| **fulfillments** | `Fulfillment[]` | An array of elements allocating offer components to                     consideration components. Note that each                     consideration component must be fully met for the                     match operation to be valid.                                                                                                                                                                            |

| Name           | Type          | Description                                                                                                                                     |
| -------------- | ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| **executions** | `Execution[]` | An array of elements indicating the sequence of                    transfers performed as part of matching the given                    orders. |

***

### matchAdvancedOrders <a name="match-advanced" />

Match an arbitrary number of full or partial orders, each with an         arbitrary number of items for offer and consideration, supplying         criteria resolvers containing specific token identifiers and         associated proofs as well as fulfillments allocating offer         components to consideration components.

```sol Solidity
function matchAdvancedOrders(
  struct AdvancedOrder[] orders, 
  struct CriteriaResolver[] criteriaResolvers, 
  struct Fulfillment[] fulfillments, 
  address recipient) 
 external payable returns (struct Execution[] executions)
```

| Name                  | Type                 | Description                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| --------------------- | -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **orders**            | `AdvancedOrder[]`    | The advanced orders to match. Note that both the                          offerer and fulfiller on each order must first                          approve this contract (or a preferred conduit if                          indicated by the order) to transfer any relevant                          tokens on their behalf and each consideration                          recipient must implement `onERC1155Received` in                          order to receive ERC1155 tokens. Also note that                          the offer and consideration components for each                          order must have no remainder after multiplying                          the respective amount with the supplied fraction                          in order for the group of partial fills to be                          considered valid. |
| **criteriaResolvers** | `CriteriaResolver[]` | An array where each element contains a reference                          to a specific order as well as that order's                          offer or consideration, a token identifier, and                          a proof that the supplied token identifier is                          contained in the order's merkle root. Note that                          an empty root indicates that any (transferable)                          token identifier is valid and that no associated                          proof needs to be supplied.                                                                                                                                                                                                                                                                                             |
| **fulfillments**      | `Fulfillment[]`      | An array of elements allocating offer components                          to consideration components. Note that each                          consideration component must be fully met in                          order for the match operation to be valid.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| **recipient**         | `address`            | The intended recipient for all unspent offer item amounts, or the caller if the null addressis supplied.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |

| Name           | Type          | Description                                                                                                                                     |
| -------------- | ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| **executions** | `Execution[]` | An array of elements indicating the sequence of                    transfers performed as part of matching the given                    orders. |

### cancel <a name="cancel" />

Cancel an arbitrary number of orders. Note that only the offerer         or the zone of a given order may cancel it. Callers should ensure         that the intended order was cancelled by calling `getOrderStatus`         and confirming that `isCancelled` returns `true`.

```sol Solidity
function cancel(struct OrderComponents[] orders) external returns (bool cancelled)
```

| Name       | Type              | Description           |
| ---------- | ----------------- | --------------------- |
| **orders** | `OrderComponents` | The orders to cancel. |

| Name          | Type   | Description                                                                                          |
| ------------- | ------ | ---------------------------------------------------------------------------------------------------- |
| **cancelled** | `bool` | A boolean indicating whether the supplied orders have                   been successfully cancelled. |

***

### validate <a name="validate" />

Validate an arbitrary number of orders, thereby registering their         signatures as valid and allowing the fulfiller to skip signature         verification on fulfillment. Note that validated orders may still         be unfulfillable due to invalid item amounts or other factors;         callers should determine whether validated orders are fulfillable         by simulating the fulfillment call prior to execution. Also note         that anyone can validate a signed order, but only the offerer can         validate an order without supplying a signature.

```sol Solidity
function validate(struct Order[] orders) external returns (bool validated)
```

| Name       | Type      | Description             |
| ---------- | --------- | ----------------------- |
| **orders** | `Order[]` | The orders to validate. |

| Name          | Type   | Description                                                                                          |
| ------------- | ------ | ---------------------------------------------------------------------------------------------------- |
| **validated** | `bool` | A boolean indicating whether the supplied orders have                   been successfully validated. |

***

### incrementCounter <a name="increment" />

Cancel all orders from a given offerer with a given zone in bulk         by incrementing a counter. Note that only the offerer may         increment the counter.

```sol Solidity
function incrementCounter() external returns (uint256 newCounter)
```

| Name           | Type      | Description      |
| -------------- | --------- | ---------------- |
| **newCounter** | `uint256` | The new counter. |

***

### getOrderHash <a name="order-hash" />

Retrieve the order hash for a given order.

```sol Solidity
function getOrderHash(struct OrderComponents order) external view returns (bytes32 orderHash)
```

| Name      | Type              | Description                  |
| --------- | ----------------- | ---------------------------- |
| **order** | `OrderComponents` | The components of the order. |

| Name          | Type    | Description     |
| ------------- | ------- | --------------- |
| **orderHash** | bytes32 | The order hash. |

***

### getOrderStatus <a name="order-status" />

Retrieve the status of a given order by hash, including whether         the order has been cancelled or validated and the fraction of the         order that has been filled.

```sol Solidity
function getOrderStatus(bytes32 orderHash) external view returns (bool isValidated, bool isCancelled, uint256 totalFilled, uint256 totalSize)
```

| Name          | Type      | Description                 |
| ------------- | --------- | --------------------------- |
| **orderHash** | `bytes32` | The order hash in question. |

| Name            | Type      | Description                                                                                                                                                   |
| --------------- | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **isValidated** | `bool`    | A boolean indicating whether the order in question                     has been validated (i.e. previously approved or                     partially filled). |
| **isCancelled** | `bool`    | A boolean indicating whether the order in question                     has been cancelled.                                                                    |
| **totalFilled** | `uint256` | The total portion of the order that has been filled                     (i.e. the "numerator").                                                               |
| **totalSize**   | `uint256` | The total size of the order that is either filled or                     unfilled (i.e. the "denominator").                                                   |

***

### getCounter <a name="counter" />

Retrieve the current counter for a given offerer.

```sol Solidity
function getCounter(address offerer) external view returns (uint256 counter)
```

| Name        | Type      | Description              |
| ----------- | --------- | ------------------------ |
| **offerer** | `address` | The offerer in question. |

| Name        | Type      | Description          |
| ----------- | --------- | -------------------- |
| **counter** | `uint256` | The current counter. |

***

### information <a name="information" />

Retrieve configuration information for this contract.

```sol Solidity
function information() external view returns (string version, bytes32 domainSeparator, address conduitController)
```

| Name                  | Type      | Description                                   |
| --------------------- | --------- | --------------------------------------------- |
| **version**           | `string`  | The contract version.                         |
| **domainSeparator**   | `bytes32` | The domain separator for this contract.       |
| **conduitController** | `address` | The conduit Controller set for this contract. |

***

### name <a name="name" />

```sol Solidity
function name() external view returns (string contractName)
```

Retrieve the name of this contract.

| Name             | Type     | Description                |
| ---------------- | -------- | -------------------------- |
| **contractName** | `string` | The name of this contract. |





# Enums

## OrderType

```sol Solidity
enum OrderType {
  FULL_OPEN,
  PARTIAL_OPEN,
  FULL_RESTRICTED,
  PARTIAL_RESTRICTED,
  CONTRACT
}
```

## BasicOrderType

```sol Solidity
enum BasicOrderType {
  ETH_TO_ERC721_FULL_OPEN,
  ETH_TO_ERC721_PARTIAL_OPEN,
  ETH_TO_ERC721_FULL_RESTRICTED,
  ETH_TO_ERC721_PARTIAL_RESTRICTED,
  ETH_TO_ERC1155_FULL_OPEN,
  ETH_TO_ERC1155_PARTIAL_OPEN,
  ETH_TO_ERC1155_FULL_RESTRICTED,
  ETH_TO_ERC1155_PARTIAL_RESTRICTED,
  ERC20_TO_ERC721_FULL_OPEN,
  ERC20_TO_ERC721_PARTIAL_OPEN,
  ERC20_TO_ERC721_FULL_RESTRICTED,
  ERC20_TO_ERC721_PARTIAL_RESTRICTED,
  ERC20_TO_ERC1155_FULL_OPEN,
  ERC20_TO_ERC1155_PARTIAL_OPEN,
  ERC20_TO_ERC1155_FULL_RESTRICTED,
  ERC20_TO_ERC1155_PARTIAL_RESTRICTED,
  ERC721_TO_ERC20_FULL_OPEN,
  ERC721_TO_ERC20_PARTIAL_OPEN,
  ERC721_TO_ERC20_FULL_RESTRICTED,
  ERC721_TO_ERC20_PARTIAL_RESTRICTED,
  ERC1155_TO_ERC20_FULL_OPEN,
  ERC1155_TO_ERC20_PARTIAL_OPEN,
  ERC1155_TO_ERC20_FULL_RESTRICTED,
  ERC1155_TO_ERC20_PARTIAL_RESTRICTED
}
```

## BasicOrderRouteType

```sol Solidity
enum BasicOrderRouteType {
  ETH_TO_ERC721,
  ETH_TO_ERC1155,
  ERC20_TO_ERC721,
  ERC20_TO_ERC1155,
  ERC721_TO_ERC20,
  ERC1155_TO_ERC20
}
```

## ItemType

```sol Solidity
enum ItemType {
  NATIVE,
  ERC20,
  ERC721,
  ERC1155,
  ERC721_WITH_CRITERIA,
  ERC1155_WITH_CRITERIA
}
```

## Side

```sol Solidity
enum Side {
  OFFER,
  CONSIDERATION
}
```




# Events and Errors

### OrderFulfilled

```sol Solidity
event OrderFulfilled(bytes32 orderHash, address offerer, address zone, address recipient, struct SpentItem[] offer, struct ReceivedItem[] consideration)
```

*Emit an event whenever an order is successfully fulfilled.*

| Name          | Type                   | Description                                                                                                                                                                                                                                                                                                                      |
| ------------- | ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| orderHash     | bytes32                | The hash of the fulfilled order.                                                                                                                                                                                                                                                                                                 |
| offerer       | address                | The offerer of the fulfilled order.                                                                                                                                                                                                                                                                                              |
| zone          | address                | The zone of the fulfilled order.                                                                                                                                                                                                                                                                                                 |
| recipient     | address                | The recipient of each spent item on the fulfilled                      order, or the null address if there is no specific                      fulfiller (i.e. the order is part of a group of                      orders). Defaults to the caller unless explicitly                      specified otherwise by the fulfiller. |
| offer         | struct SpentItem\[]    | The offer items spent as part of the order.                                                                                                                                                                                                                                                                                      |
| consideration | struct ReceivedItem\[] | The consideration items received as part of the                      order along with the recipients of each item.                                                                                                                                                                                                               |

### OrderCancelled

```sol Solidity
event OrderCancelled(bytes32 orderHash, address offerer, address zone)
```

*Emit an event whenever an order is successfully cancelled.*

| Name      | Type    | Description                         |
| --------- | ------- | ----------------------------------- |
| orderHash | bytes32 | The hash of the cancelled order.    |
| offerer   | address | The offerer of the cancelled order. |
| zone      | address | The zone of the cancelled order.    |

### OrderValidated

```sol Solidity
event OrderValidated(bytes32 orderHash, address offerer, address zone)
```

*Emit an event whenever an order is explicitly validated. Note that      this event will not be emitted on partial fills even though they do      validate the order as part of partial fulfillment.*

| Name      | Type    | Description                         |
| --------- | ------- | ----------------------------------- |
| orderHash | bytes32 | The hash of the validated order.    |
| offerer   | address | The offerer of the validated order. |
| zone      | address | The zone of the validated order.    |

### CounterIncremented

```sol Solidity
event CounterIncremented(uint256 newCounter, address offerer)
```

*Emit an event whenever a counter for a given offerer is incremented.*

| Name       | Type    | Description                      |
| ---------- | ------- | -------------------------------- |
| newCounter | uint256 | The new counter for the offerer. |
| offerer    | address | The offerer in question.         |

### OrdersMatched

```sol Solidity
event OrdersMatched(bytes32[] orderHashes)
```

*Emit an event whenever one or more orders are matched using either matchOrders or matchAdvancedOrders.*

| Name        | Type       | Description                             |
| ----------- | ---------- | --------------------------------------- |
| orderHashes | bytes32\[] | The order hashes of the matched orders. |

### OrderAlreadyFilled

```sol Solidity
error OrderAlreadyFilled(bytes32 orderHash)
```

*Revert with an error when attempting to fill an order that has      already been fully filled.*

| Name      | Type    | Description                                   |
| --------- | ------- | --------------------------------------------- |
| orderHash | bytes32 | The order hash on which a fill was attempted. |

### InvalidTime

```sol Solidity
error InvalidTime()
```

*Revert with an error when attempting to fill an order outside the      specified start time and end time.*

### InvalidConduit

```sol Solidity
error InvalidConduit(bytes32 conduitKey, address conduit)
```

*Revert with an error when attempting to fill an order referencing an      invalid conduit (i.e. one that has not been deployed).*

### MissingOriginalConsiderationItems

```sol Solidity
error MissingOriginalConsiderationItems()
```

*Revert with an error when an order is supplied for fulfillment with      a consideration array that is shorter than the original array.*

### InvalidCallToConduit

```sol Solidity
error InvalidCallToConduit(address conduit)
```

*Revert with an error when a call to a conduit fails with revert data      that is too expensive to return.*

### ConsiderationNotMet

```sol Solidity
error ConsiderationNotMet(uint256 orderIndex, uint256 considerationIndex, uint256 shortfallAmount)
```

*Revert with an error if a consideration amount has not been fully      zeroed out after applying all fulfillments.*

| Name               | Type    | Description                                                                                    |
| ------------------ | ------- | ---------------------------------------------------------------------------------------------- |
| orderIndex         | uint256 | The index of the order with the consideration                           item with a shortfall. |
| considerationIndex | uint256 | The index of the consideration item on the                           order.                    |
| shortfallAmount    | uint256 | The unfulfilled consideration amount.                                                          |

### InsufficientEtherSupplied

```sol Solidity
error InsufficientEtherSupplied()
```

*Revert with an error when insufficient ether is supplied as part of      msg.value when fulfilling orders.*

### EtherTransferGenericFailure

```sol Solidity
error EtherTransferGenericFailure(address account, uint256 amount)
```

*Revert with an error when an ether transfer reverts.*

### PartialFillsNotEnabledForOrder

```sol Solidity
error PartialFillsNotEnabledForOrder()
```

*Revert with an error when a partial fill is attempted on an order      that does not specify partial fill support in its order type.*

### OrderIsCancelled

```sol Solidity
error OrderIsCancelled(bytes32 orderHash)
```

*Revert with an error when attempting to fill an order that has been      cancelled.*

| Name      | Type    | Description                      |
| --------- | ------- | -------------------------------- |
| orderHash | bytes32 | The hash of the cancelled order. |

### OrderPartiallyFilled

```sol Solidity
error OrderPartiallyFilled(bytes32 orderHash)
```

*Revert with an error when attempting to fill a basic order that has      been partially filled.*

| Name      | Type    | Description                           |
| --------- | ------- | ------------------------------------- |
| orderHash | bytes32 | The hash of the partially used order. |

### InvalidCanceller

```sol Solidity
error InvalidCanceller()
```

*Revert with an error when attempting to cancel an order as a caller      other than the indicated offerer or zone.*

### BadFraction

```sol Solidity
error BadFraction()
```

*Revert with an error when supplying a fraction with a value of zero      for the numerator or denominator, or one where the numerator exceeds      the denominator.*

### InvalidMsgValue

```sol Solidity
error InvalidMsgValue(uint256 value)
```

*Revert with an error when a caller attempts to supply callvalue to a      non-payable basic order route or does not supply any callvalue to a      payable basic order route.*

### InvalidBasicOrderParameterEncoding

```sol Solidity
error InvalidBasicOrderParameterEncoding()
```

*Revert with an error when attempting to fill a basic order using      calldata not produced by default ABI encoding.*

### NoSpecifiedOrdersAvailable

```sol Solidity
error NoSpecifiedOrdersAvailable()
```

*Revert with an error when attempting to fulfill any number of      available orders when none are fulfillable.*

### InvalidNativeOfferItem

```sol Solidity
error InvalidNativeOfferItem()
```

*Revert with an error when attempting to fulfill an order with an      offer for ETH outside of matching orders.*




# Conduit Controller

ConduitController enables deploying and managing new conduits, or         contracts that allow registered callers (or open "channels") to         transfer approved ERC20/721/1155 tokens on their behalf.

### \_conduits

```sol Solidity
mapping(address => struct ConduitControllerInterface.ConduitProperties) _conduits
```

### \_CONDUIT\_CREATION\_CODE\_HASH

```sol Solidity
bytes32 _CONDUIT_CREATION_CODE_HASH
```

### \_CONDUIT\_RUNTIME\_CODE\_HASH

```sol Solidity
bytes32 _CONDUIT_RUNTIME_CODE_HASH
```

### constructor

```sol Solidity
constructor() public
```

*Initialize contract by deploying a conduit and setting the creation      code and runtime code hashes as immutable arguments.*

### createConduit

```sol Solidity
function createConduit(bytes32 conduitKey, address initialOwner) external returns (address conduit)
```

Deploy a new conduit using a supplied conduit key and assigning         an initial owner for the deployed conduit. Note that the first         twenty bytes of the supplied conduit key must match the caller         and that a new conduit cannot be created if one has already been         deployed using the same conduit key.

| Name         | Type    | Description                                                                                                                                                                     |
| ------------ | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| conduitKey   | bytes32 | The conduit key used to deploy the conduit. Note that                     the first twenty bytes of the conduit key must match                     the caller of this contract. |
| initialOwner | address | The initial owner to set for the new conduit.                                                                                                                                   |

| Name    | Type    | Description                                |
| ------- | ------- | ------------------------------------------ |
| conduit | address | The address of the newly deployed conduit. |

### updateChannel

```sol Solidity
function updateChannel(address conduit, address channel, bool isOpen) external
```

Open or close a channel on a given conduit, thereby allowing the         specified account to execute transfers against that conduit.         Extreme care must be taken when updating channels, as malicious         or vulnerable channels can transfer any ERC20, ERC721 and ERC1155         tokens where the token holder has granted the conduit approval.         Only the owner of the conduit in question may call this function.

| Name    | Type    | Description                                                |
| ------- | ------- | ---------------------------------------------------------- |
| conduit | address | The conduit for which to open or close the channel.        |
| channel | address | The channel to open or close on the conduit.               |
| isOpen  | bool    | A boolean indicating whether to open or close the channel. |

### transferOwnership

```sol Solidity
function transferOwnership(address conduit, address newPotentialOwner) external
```

Initiate conduit ownership transfer by assigning a new potential         owner for the given conduit. Once set, the new potential owner         may call `acceptOwnership` to claim ownership of the conduit.         Only the owner of the conduit in question may call this function.

| Name              | Type    | Description                                           |
| ----------------- | ------- | ----------------------------------------------------- |
| conduit           | address | The conduit for which to initiate ownership transfer. |
| newPotentialOwner | address | The new potential owner of the conduit.               |

### cancelOwnershipTransfer

```sol Solidity
function cancelOwnershipTransfer(address conduit) external
```

Clear the currently set potential owner, if any, from a conduit.         Only the owner of the conduit in question may call this function.

| Name    | Type    | Description                                         |
| ------- | ------- | --------------------------------------------------- |
| conduit | address | The conduit for which to cancel ownership transfer. |

### acceptOwnership

```sol Solidity
function acceptOwnership(address conduit) external
```

Accept ownership of a supplied conduit. Only accounts that the         current owner has set as the new potential owner may call this         function.

| Name    | Type    | Description                                |
| ------- | ------- | ------------------------------------------ |
| conduit | address | The conduit for which to accept ownership. |

### ownerOf

```sol Solidity
function ownerOf(address conduit) external view returns (address owner)
```

Retrieve the current owner of a deployed conduit.

| Name    | Type    | Description                                             |
| ------- | ------- | ------------------------------------------------------- |
| conduit | address | The conduit for which to retrieve the associated owner. |

| Name  | Type    | Description                        |
| ----- | ------- | ---------------------------------- |
| owner | address | The owner of the supplied conduit. |

### getKey

```sol Solidity
function getKey(address conduit) external view returns (bytes32 conduitKey)
```

Retrieve the conduit key for a deployed conduit via reverse         lookup.

| Name    | Type    | Description                                                                  |
| ------- | ------- | ---------------------------------------------------------------------------- |
| conduit | address | The conduit for which to retrieve the associated conduit                key. |

| Name       | Type    | Description                                          |
| ---------- | ------- | ---------------------------------------------------- |
| conduitKey | bytes32 | The conduit key used to deploy the supplied conduit. |

### getConduit

```sol Solidity
function getConduit(bytes32 conduitKey) external view returns (address conduit, bool exists)
```

Derive the conduit associated with a given conduit key and         determine whether that conduit exists (i.e. whether it has been         deployed).

| Name       | Type    | Description                                 |
| ---------- | ------- | ------------------------------------------- |
| conduitKey | bytes32 | The conduit key used to derive the conduit. |

| Name    | Type    | Description                                                                                |
| ------- | ------- | ------------------------------------------------------------------------------------------ |
| conduit | address | The derived address of the conduit.                                                        |
| exists  | bool    | A boolean indicating whether the derived conduit has been                 deployed or not. |

### getPotentialOwner

```sol Solidity
function getPotentialOwner(address conduit) external view returns (address potentialOwner)
```

Retrieve the potential owner, if any, for a given conduit. The         current owner may set a new potential owner via         `transferOwnership` and that owner may then accept ownership of         the conduit in question via `acceptOwnership`.

| Name    | Type    | Description                                            |
| ------- | ------- | ------------------------------------------------------ |
| conduit | address | The conduit for which to retrieve the potential owner. |

| Name           | Type    | Description                                   |
| -------------- | ------- | --------------------------------------------- |
| potentialOwner | address | The potential owner, if any, for the conduit. |

### getChannelStatus

```sol Solidity
function getChannelStatus(address conduit, address channel) external view returns (bool isOpen)
```

Retrieve the status (either open or closed) of a given channel on         a conduit.

| Name    | Type    | Description                                           |
| ------- | ------- | ----------------------------------------------------- |
| conduit | address | The conduit for which to retrieve the channel status. |
| channel | address | The channel for which to retrieve the status.         |

| Name   | Type | Description                                     |
| ------ | ---- | ----------------------------------------------- |
| isOpen | bool | The status of the channel on the given conduit. |

### getTotalChannels

```sol Solidity
function getTotalChannels(address conduit) external view returns (uint256 totalChannels)
```

Retrieve the total number of open channels for a given conduit.

| Name    | Type    | Description                                                |
| ------- | ------- | ---------------------------------------------------------- |
| conduit | address | The conduit for which to retrieve the total channel count. |

| Name          | Type    | Description                                        |
| ------------- | ------- | -------------------------------------------------- |
| totalChannels | uint256 | The total number of open channels for the conduit. |

### getChannel

```sol Solidity
function getChannel(address conduit, uint256 channelIndex) external view returns (address channel)
```

Retrieve an open channel at a specific index for a given conduit.         Note that the index of a channel can change as a result of other         channels being closed on the conduit.

| Name         | Type    | Description                                         |
| ------------ | ------- | --------------------------------------------------- |
| conduit      | address | The conduit for which to retrieve the open channel. |
| channelIndex | uint256 | The index of the channel in question.               |

| Name    | Type    | Description                                               |
| ------- | ------- | --------------------------------------------------------- |
| channel | address | The open channel, if any, at the specified channel index. |

### getChannels

```sol Solidity
function getChannels(address conduit) external view returns (address[] channels)
```

Retrieve all open channels for a given conduit. Note that calling         this function for a conduit with many channels will revert with         an out-of-gas error.

| Name    | Type    | Description                                      |
| ------- | ------- | ------------------------------------------------ |
| conduit | address | The conduit for which to retrieve open channels. |

| Name     | Type       | Description                                     |
| -------- | ---------- | ----------------------------------------------- |
| channels | address\[] | An array of open channels on the given conduit. |

### getConduitCodeHashes

```sol Solidity
function getConduitCodeHashes() external view returns (bytes32 creationCodeHash, bytes32 runtimeCodeHash)
```

*Retrieve the conduit creation code and runtime code hashes.*

### \_assertCallerIsConduitOwner

```sol Solidity
function _assertCallerIsConduitOwner(address conduit) private view
```

*Private view function to revert if the caller is not the owner of a      given conduit.*

| Name    | Type    | Description                                |
| ------- | ------- | ------------------------------------------ |
| conduit | address | The conduit for which to assert ownership. |

### \_assertConduitExists

```sol Solidity
function _assertConduitExists(address conduit) private view
```

*Private view function to revert if a given conduit does not exist.*

| Name    | Type    | Description                                |
| ------- | ------- | ------------------------------------------ |
| conduit | address | The conduit for which to assert existence. |




# Seaport Hooks

Introduced in Seaport 1.6, **Seaport Hooks** are a powerful set of primitives that can be used to extend the native functionality of the protocol by allowing developer-defined, stateful contracts to "react" to Seaport order fulfillments.  Those smart contracts can be NFTs involved in the fulfillment, but can also be external protocols.

**Seaport Hooks** can be used to build a variety of novel experiences that expand the utility and liquidity of NFTs.  Hooks are still an emergent and experimental feature, but, if you are working on Seaport Hooks and have an idea you're excited about having integrated into the OpenSea application, please reach out to [hooks@opensea.io](mailto:hooks@opensea.io).

***

There are three key flavors of hooks: **zone hooks**, **contract hooks**, and **item hooks**.  All three modalities are called by Seaport during the order fulfillment process, but they are each called at different times in the order flow and with different information supplied.

## Zone Hooks

Zone hooks are a mechanic for extending the native functionality of a Seaport order. By using a restricted order and specifying a zone, the order will call out to that zone both before and after transferring tokens, delegating control flow to the zone. In particular, zone hooks are an efficient way for collection owners to enforce how their tokens are bought and sold on Seaport.

### authorizeOrder & validateOrder

When processing restricted orders (`OrderType` with `FULL_RESTRICTED` or `PARTIAL_RESTRICTED`), Seaport will call the zone specified by the order (unless the zone is the caller) twice: once before executing any token transfers ( `authorizeOrder`) and again after executing the token transfers (`validateOrder`).

While handling these calls, the zone can perform custom validation logic (modifying state, performing additional calls of its own, etc.) and determine whether or not the order in question should be allowed or rejected.

The fulfillment will revert if the call to the zone reverts, or if the magic value (function selector in question) is not returned. In cases where the call to `authorizeOrder` reverts and the fulfillment method is `fulfillAvailableOrders` or `fulfillAvailableAdvancedOrders`, the order will be skipped.

Both `authorizeOrder` and `validateOrder` will receive the same `ZoneParameters` struct with one key difference: the `orderHashes` array will only contain orders that were supplied and processed prior to the current order. Example: when fulfilling 3 orders, and checking the 2nd order, the `orderHashes` array will have a single element (the first order hash, or `bytes32(0)` if the first order was skipped) when calling `authorizeOrder` and 3 elements (each respective order hash, or `bytes32(0)` for any skipped orders) when calling `validateOrder`.

Note that the `offer` and `consideration` arrays provided to the zone will have any criteria items resolved and all current amounts derived from the original start and end amounts.

```sol Solidity
struct ZoneParameters {
    bytes32 orderHash;
    address fulfiller;
    address offerer;
    SpentItem[] offer;
    ReceivedItem[] consideration;
    bytes extraData;
    bytes32[] orderHashes;
    uint256 startTime;
    uint256 endTime;
    bytes32 zoneHash;
}

// Before executing token transfers
function authorizeOrder(
    ZoneParameters calldata zoneParameters
) external returns (bytes4 authorizeOrderMagicValue)
  
// After executing token transfers
function validateOrder(
    ZoneParameters calldata zoneParameters
) external returns (bytes4 validateOrderMagicValue)
```

### getSeaportMetadata

```sol Solidity
function getSeaportMetadata()
        external
        view
        returns (
            string memory name,
            Schema[] memory schemas // map to Seaport Improvement Proposal IDs
                                    // https://github.com/ProjectOpenSea/SIPs
        )
```

## Contract Hooks

Contract orders (`OrderType` of `CONTRACT`) enable contract offerers that implement the compliant interface to dynamically generate Seaport orders via `generateOrder` and to perform any additional validation or processing after token transfers are complete via `ratifyOrder`. Contract orders are particularly useful for protocols and other contracts that are interested in dynamically participating as an automated buyer or seller in Seaport-powered marketplaces.

Contract orders are not signed offchain like standard Seaport orders, but instead are constructed by the fulfiller to adhere to the requirements of the contract offerer. Contract offerers will generally implement a `previewOrder` function that takes some subset of the full order and returns the missing components of that order. Example: an NFT pool contract that implements a bonding curve to buy and sell NFTs according to an algorithmic process would implement a `previewOrder` function that takes some amount of tokens as the `offer` and returns the full order including the NFTs that would be received back as the `consideration`.

When fulfilling a contract order, the fulfiller provides an `offer` representing the minimum number of items and amounts that need to be supplied by the contract offerer as well as a `consideration` representing the maximum number of items and amounts that the contract offerer may require. The fulfiller may also provide `extraData` which will be supplied to the contract offerer as additional context.

Seaport will supply the original `offer`, `consideration`, and `extraData` arguments to the contract offerer. The contract offerer will process the request, modifying state or performing additional calls where relevant, and return a modified `offer` and `consideration` array where the `offer` array contains at least as many items or amounts of those items and the `consideration` array returns no more than the original items or amounts. If the contract offerer does not return compliant arrays, the fulfillment will revert. If the call to `generateOrder` reverts, the fulfillment will revert unless the `fulfillAvailableOrders` or `fulfillAvailableAdvancedOrders` method is used, in which case the order will be skipped.

For more information on contract orders, see the [relevant documentation in the Seaport repository](https://github.com/ProjectOpenSea/seaport/blob/main/docs/SeaportDocumentation.md#contract-orders).

### ContractOffererInterface

```sol
interface ContractOffererInterface {
    function generateOrder(
        address fulfiller,
        SpentItem[] calldata minimumReceived,
        SpentItem[] calldata maximumSpent,
        bytes calldata context
    )
        external
        returns (SpentItem[] memory offer, ReceivedItem[] memory consideration);

    function ratifyOrder(
        SpentItem[] calldata offer,
        ReceivedItem[] calldata consideration,
        bytes calldata context,
        bytes32[] calldata orderHashes,
        uint256 contractNonce
    ) external returns (bytes4 ratifyOrderMagicValue);

    function previewOrder(
        address caller,
        address fulfiller,
        SpentItem[] calldata minimumReceived,
        SpentItem[] calldata maximumSpent,
        bytes calldata context
    )
        external
        view
        returns (SpentItem[] memory offer, ReceivedItem[] memory consideration);

    function getSeaportMetadata()
        external
        view
        returns (
            string memory name,
            Schema[] memory schemas // map to Seaport Improvement Proposal IDs
                                    // https://github.com/ProjectOpenSea/SIPs
        );
}
```

## Item Hooks

While zone and contract hooks are triggered before and after executing token transfers, item hooks are triggered mid-execution, typically triggered from calls to `safeTransferFrom`. They are not a formal construct within Seaport, but can still be utilized for accomplishing more complex stateful operations requiring additional logic. A key limitation of item hooks is that the amount of data that can be supplied is inherently limited. Furthermore, they are more opaque than zone and contract hooks.

These take 3 different flavors:

* Synthetic tokens: supplying an item with a token that does not adhere to formal semantics but instead performs custom logic, the order can trigger an external hook
* Receive fallback: selecting a recipient of a native token transfer with a receive function that performs additional logic, it can trigger an external hook (though it can't provide any additional data)
* ERC-1155 onReceived fallback: functions similarly to the native token receive fallback but allows for passing through additional data

Before reaching for item hooks, it is strongly encouraged to explore zone or contract hooks as a workable alternative due to their increased flexibility, interoperability, and clarity of purpose.

## Seaport Improvement Proposals

To facilitate discovery and interaction with hooks, a set of standards called Seaport Improvement Proposals (SIPs) are maintained at [https://github.com/ProjectOpenSea/SIPs](https://github.com/ProjectOpenSea/SIPs).

Relevant SIPs for hook authors to consider include:

* [SIP-5](https://github.com/ProjectOpenSea/SIPs/blob/main/SIPS/sip-5.md): how to signal which SIPs are implemented by the Seaport hook via `getSeaportMetadata`
* [SIP-6](https://github.com/ProjectOpenSea/SIPs/blob/main/SIPS/sip-6.md): how to encode `extraData` as to support multiple concurrent SIPs

Authors of hooks should review existing SIPs to determine if there is an existing standard they can implement for their particular use case. If one does not exist, the authors are encouraged to propose a new SIP via pull request so that OpenSea and other interested parties can integrate with Seaport orders using the hook.

Hook authors are encouraged to join the [Seaport Working Group Discord](https://discord.gg/ADXcTXpqry) to engage in discussion related to their hooks and corresponding SIPs.




# SeaDrop

An overview of the SeaDrop protocol and how it is used for NFT Primary Drops.

<Image align="center" width="75% " src="https://files.readme.io/649bcca-seadrop-banner.png" />

## Overview

SeaDrop is a smart contract protocol for primary drops on EVM-compatible blockchains. The types of drops supported are public drops, Merkle Tree-based allowlists, server-signed mints, and token-gated drops. An implementing token contract should contain the methods to interface with SeaDrop through an authorized user such as an Owner or Administrator.

Our [SeaDrop](https://github.com/ProjectOpenSea/seadrop/blob/main/src/ERC721SeaDrop.sol) protocol contract provides the latest in NFT Primary Drop functionality, including:

* Extending [ERC721A](https://www.erc721a.org/) to make minting multiple tokens in a single transaction gas-efficient
* Support for a public sale and multiple pre sales using [Merkle Tree](https://en.wikipedia.org/wiki/Merkle_tree) -based allowlists and server-signed mints
* All the functionality needed to integrate with OpenSea’s Drops program.

Many creators find that they require some special functionality on their smart contracts for their drops. The SeaDrop repository has an extension for an implementation of a [random offset](https://github.com/ProjectOpenSea/seadrop/blob/main/src/extensions/ERC721SeaDropRandomOffset.sol) contract. If you require functionality not available in our pre-made contracts, feel free to extend ERC721SeaDrop and add additional functionality. To ensure users have a seamless experience minting your drop on OpenSea, please do not modify any minting functionality.

## Notable Links

* [SeaDrop Repo](https://github.com/ProjectOpenSea/seadrop)
* [Metrics](https://dune.com/opensea_team/seadrop)

## Deploying a SeaDrop-compatible contract

To deploy a SeaDrop-compatible custom contract, start with [ERC721SeaDrop](https://github.com/ProjectOpenSea/seadrop/blob/main/src/ERC721SeaDrop.sol). Clone the repository and install Foundry with the instructions in the ReadMe. To deploy the contract, run

```powershell Shell script
forge create --rpc-url $RPC_URL --private-key $PRIV_KEY --constructor-args "ExampleToken" "ExTkn" \\[0x00005EA00Ac477B1030CE78506496e8C2dE24bf5]
```

If you don’t need to make any customizations, deploy ERC721SeaDrop as-is with the constructor argument of `allowedSeaDrop` of [`0x00005EA00Ac477B1030CE78506496e8C2dE24bf5`](https://etherscan.io/address/0x00005ea00ac477b1030ce78506496e8c2de24bf5). This will allow the SeaDrop contract permission to mint on your token contract. If you've already deployed your contract without setting the `allowedSeaDrop` in the constructor, you can call `updateAllowedSeaDrop`, available on the token contract interface.

If you have or would like to deploy an upgradeable contract, see the [readme in src-upgradeable](https://github.com/ProjectOpenSea/seadrop/tree/main/src-upgradeable#readme) for more details. For technical questions related to the SeaDrop minting experience and capabilities, you can reference our [Developer FAQ](https://docs.google.com/document/d/11JsrL0FxkMu24M_eHpe3uSyo6lJpdtfDumY4erRkbcQ/edit#heading=h.xlech4bra20s).





# MCP

Connect your AI tools to OpenSea using the Model Context Protocol (MCP), an open standard that lets AI assistants interact with the OpenSea marketplace and blockchain data.

> 🚧 Beta Access Required
>
> OpenSea MCP is currently in beta. We're gradually onboarding developers to ensure a smooth experience and gather feedback to improve the platform. [Request an access token using this form](https://opensea.notion.site/24e162eb75d9807b82f0f13cf139e254?pvs=105).

### What is OpenSea MCP?

OpenSea MCP is a hosted server that gives AI tools secure access to OpenSea's comprehensive NFT marketplace data, token information, and blockchain analytics. It's designed to work seamlessly with popular AI assistants like ChatGPT, Cursor, Claude, and Chorus.

### Why use OpenSea MCP?

* **Easy setup** — Connect through a simple URL configuration
* **Real-time marketplace data** — Access live NFT prices, collections, and token information
* **Comprehensive blockchain coverage** — Support for Ethereum, Polygon, Base, Solana and other major chains
* **Optimized for AI** — Built specifically for AI agents with efficient data formatting and natural language search

### What can you do with OpenSea MCP?

* **Research NFT collections** — Get floor prices, volume data, and trending collections across multiple blockchains
* **Analyze tokens and cryptocurrencies** — Look up ERC-20 tokens, meme coins, and get real-time price data
* **Check wallet balances** — View NFT holdings and token balances for any wallet address
* **Get swap quotes** — Calculate token swap prices and gas estimates for DeFi transactions
* **Track market trends** — Identify trending NFT collections and monitor trading activity
* **Search marketplace data** — Use AI-powered search to find specific NFTs, collections, or tokens

<br />

## Getting Started

### Connect through your AI tool

To connect OpenSea MCP to your AI assistant, use one of these connection methods:

### Streamable HTTP (Recommended)

* URL: `https://mcp.opensea.io/mcp`
* JSON config:

```json
{
    "mcpServers": {
      "OpenSea": {
        "url": "https://mcp.opensea.io/mcp",
         "headers": {
           "Authorization": "Bearer ACCESS_TOKEN"
         }
      }
    }
}
```

If your client does not support custom headers, the access token can be provided in-line:

`https://mcp.opensea.io/ACCESS_TOKEN/mcp`

### SSE (Server-Sent Events)

* URL: [`https://mcp.opensea.io/sse`](https://opensea-mcp.example.com/sse)
* JSON config:

```json
{
    "mcpServers": {
      "OpenSea": {
        "url": "https://mcp.opensea.io/sse",
        "headers": {
          "Authorization": "Bearer ACCESS_TOKEN"
        }
      }
    }
}
```

If your client does not support custom headers, the access token can be provided in-line:

`https://mcp.opensea.io/ACCESS_TOKEN/sse`

Request an Access Token [here](https://opensea.notion.site/24e162eb75d9807b82f0f13cf139e254?pvs=105)

### Quick Start Examples

Once connected, try these prompts to explore OpenSea MCP capabilities:

1. "What's the floor price of Bored Ape Yacht Club?"
2. "Show me trending NFT collections on Ethereum"
3. "Get information about the BONK token on Solana"
4. "Check the NFT balance for wallet 0x123..."
5. "Find NFT collections related to gaming"

### Sample Project

Prefer a working app? Try the Next.js + Vercel AI SDK starter preconfigured with OpenSea MCP:\
[https://github.com/ProjectOpenSea/opensea-mcp-next-sample](https://github.com/ProjectOpenSea/opensea-mcp-next-sample)

## Supported Tools

Now that you have installed the OpenSea MCP, let's explore how AI assistants can use OpenSea MCP tools to search, analyze, and interact with blockchain and marketplace data.

These tools work seamlessly together through prompts, and their real power comes from combining them. With a single prompt, you can search for collections, check token prices, analyze wallet holdings, and get swap quotes across multiple blockchains.

<Table>
  <thead>
    <tr>
      <th>
        Name
      </th>

      <th>
        Description
      </th>

      <th>
        Sample prompts
      </th>
    </tr>
  </thead>

  <tbody>
    <tr>
      <td>
        **search**
      </td>

      <td>
        AI-powered search across OpenSea marketplace data. The AI agent analyzes your query and uses multiple GraphQL endpoints to find relevant results.
      </td>

      <td>
        "Find BONK token on Solana"\
        "Show me trending NFTs"\
        "Search for gaming NFT collections"\
        "Find Pudgy Penguins collection"
      </td>
    </tr>

    <tr>
      <td>
        **fetch**
      </td>

      <td>
        Retrieve full details of a specific OpenSea entity by its unique identifier with maximum data including activity, analytics, offers, and all other available information.
      </td>

      <td>
        "Get details for entity abc123"
      </td>
    </tr>

    <tr>
      <td>
        **search\_collections**
      </td>

      <td>
        Search for NFT collections by name, description, or metadata. Returns minimal information (slug + name) for context efficiency.
      </td>

      <td>
        "Search for Azuki collections"\
        "Find art NFT collections on Ethereum"
      </td>
    </tr>

    <tr>
      <td>
        **get\_collections**
      </td>

      <td>
        Retrieve detailed information about multiple NFT collections at once. Supports lightweight includes like `recent_sales`, `sample_items`, `top_holders`, `basic_stats`, and `attributes`.
      </td>

      <td>
        "Get details for boredapeyachtclub"\
        "Show me stats for cryptopunks with trading activity"\
        "What's the floor price of doodles-official?"
      </td>
    </tr>

    <tr>
      <td>
        **search\_items**
      </td>

      <td>
        Search for individual NFT items/tokens across OpenSea. Returns minimal information (id + name + collection) for context efficiency.
      </td>

      <td>
        "Find Bored Ape #1234"\
        "Search for rare traits in Azuki"\
        "Look for NFTs priced under 0.1 ETH"
      </td>
    </tr>

    <tr>
      <td>
        **get\_items**
      </td>

      <td>
        Retrieve detailed information about multiple NFT items at once. Supports includes like `recent_activity`, `active_offers`, and `ownership_info`.
      </td>

      <td>
        "Get details for BAYC token 5678"\
        "Show me CryptoPunk #100 with price history"\
        "Check the owner of this NFT at 0x123..."
      </td>
    </tr>

    <tr>
      <td>
        **search\_tokens**
      </td>

      <td>
        Search for cryptocurrencies and tokens by name or symbol, including ERC-20 tokens and meme coins. Returns minimal information (id + name + symbol) for context efficiency.
      </td>

      <td>
        "Find USDC token"\
        "Search for PEPE coin"\
        "Look up SHIB token address"
      </td>
    </tr>

    <tr>
      <td>
        **get\_tokens**
      </td>

      <td>
        Retrieve detailed information about multiple cryptocurrencies/tokens at once, including current prices.
      </td>

      <td>
        "Get info for USDT at 0xdac17f..."\
        "Show WETH token with price history"\
        "What's the contract for DAI?"
      </td>
    </tr>

    <tr>
      <td>
        **get\_token\_swap\_quote**
      </td>

      <td>
        Get a swap quote and blockchain actions needed to perform a token swap. Requires sufficient wallet balance to cover amount and gas fees.
      </td>

      <td>
        "Quote swap 1 ETH to USDC"\
        "How much WETH can I get for 1000 USDT?"\
        "Calculate gas for swapping tokens"
      </td>
    </tr>

    <tr>
      <td>
        **get\_token\_balances**
      </td>

      <td>
        Retrieve token balances for a specific wallet address with USD values and detailed currency metadata. Supports filtering by contracts and sorting by various metrics.
      </td>

      <td>
        "Check token balances for 0x123..."\
        "Show my wallet's token portfolio"
      </td>
    </tr>

    <tr>
      <td>
        **get\_nft\_balances**
      </td>

      <td>
        Retrieve all NFTs owned by a specific wallet address with metadata, collection details, current listings, and offers. Sortable by price, recency, or rarity.
      </td>

      <td>
        "Show NFTs owned by 0x789..."\
        "What NFTs does snoop.eth own?"\
        "Check my NFT collection"
      </td>
    </tr>

    <tr>
      <td>
        **get\_activity**
      </td>

      <td>
        Retrieve trading activity (sales, transfers, listings) for collections, items, profiles, or tokens. Supports pagination and timeframe filtering.
      </td>

      <td>
        "Show recent sales for Bored Apes"\
        "Get trading history for wallet 0x123..."\
        "Find all USDC transfer activity"
      </td>
    </tr>

    <tr>
      <td>
        **get\_top\_collections**
      </td>

      <td>
        Retrieve top NFT collections with stats explaining why they're top-ranked. Filter by category, chains, verification status and sort by various metrics.
      </td>

      <td>
        "Show top NFT collections by volume"\
        "What are the highest floor price collections?"\
        "Top trending collections today"
      </td>
    </tr>

    <tr>
      <td>
        **get\_trending\_collections**
      </td>

      <td>
        Retrieve trending NFT collections with stats explaining why they're trending. Filter by category, chains, and specify timeframes (ONE\_HOUR, ONE\_DAY, SEVEN\_DAYS, THIRTY\_DAYS).
      </td>

      <td>
        "Show trending NFTs in the last hour"\
        "What collections are hot this week?"\
        "Find collections trending on Polygon"
      </td>
    </tr>

    <tr>
      <td>
        **get\_top\_tokens**
      </td>

      <td>
        Retrieve top cryptocurrencies and tokens sorted by ONE\_DAY\_VOLUME in descending order. Filter by chains to identify highest volume tokens.
      </td>

      <td>
        "Show top tokens by daily volume"\
        "What are the most traded tokens on Ethereum?"\
        "Find high volume meme coins"
      </td>
    </tr>

    <tr>
      <td>
        **get\_trending\_tokens**
      </td>

      <td>
        Retrieve trending cryptocurrencies and tokens sorted by ONE\_DAY\_PRICE\_CHANGE in descending order. Filter by chains to identify tokens with highest price increases.
      </td>

      <td>
        "Show tokens with biggest gains today"\
        "What cryptocurrencies are pumping?"\
        "Find trending tokens on Base"
      </td>
    </tr>

    <tr>
      <td>
        **get\_profile**
      </td>

      <td>
        Retrieve comprehensive profile information for a wallet address including basic details and optionally additional data like NFT holdings, trading activity, listings, offers, balances, and favorites.
      </td>

      <td>
        "Show profile for wallet 0xabc..."\
        "Get trading activity for vitalik.eth"\
        "Check complete portfolio for this address"
      </td>
    </tr>

    <tr>
      <td>
        **account\_lookup**
      </td>

      <td>
        Look up account information by ENS name, wallet address, or username. Resolves ENS names to addresses and finds usernames associated with addresses.
      </td>

      <td>
        "Look up vitalik.eth"\
        "Find username for wallet 0x123..."\
        "Resolve ENS name to address"
      </td>
    </tr>

    <tr>
      <td>
        **get\_chains**
      </td>

      <td>
        Retrieve a list of all blockchain networks supported by OpenSea with chain identifiers and display names.
      </td>

      <td>
        "What chains does OpenSea support?"\
        "Show me all available blockchains"\
        "List supported networks"
      </td>
    </tr>
  </tbody>
</Table>

<br />

### Common Use Cases

**Market Research:**

"What are the top gaming NFT collections by volume on Polygon?"

**Portfolio Analysis:**

"Show me all NFTs and tokens owned by wallet 0x123... and calculate total portfolio value"

**Trading Preparation:**

"Check if I have enough USDC to buy this NFT and calculate the swap from ETH if needed"

**Trend Monitoring:**

"Find NFT collections that are trending in the last 24 hours with floor price under 1 ETH"

**Token Discovery:**

"Search for new meme coins on Ethereum and show their current prices"

### Chain Support

OpenSea MCP supports all of the blockchains supported on the OpenSea web front-end.

When using tools, you can specify the chain parameter to filter results to a specific blockchain.

### Best Practices

1. **Use natural language** - The AI-powered search understands context, so describe what you're looking for naturally
2. **Combine tools** - Get comprehensive insights by using multiple tools together
3. **Specify chains** - When looking for specific blockchain data, include the chain name
4. **Check balances first** - Before requesting swap quotes, verify wallet has sufficient tokens
5. **Use collection slugs** - For specific collections, use their OpenSea slug (e.g., 'boredapeyachtclub')
6. **Leverage includes parameters** - Many tools support optional 'includes' arrays for additional data (activity, analytics, offers, etc.)
7. **Specify amounts correctly** - For swaps, use native units (ETH/SOL) not smallest units (wei/lamports)

### Rate Limits and Performance

* Most queries return results within 1-3 seconds
* Rate limits apply per access token
* Use pagination for large result sets
* Cursor-based pagination available for trending and top collections/tokens

### Error Handling

The MCP server provides clear error messages:

* Invalid addresses or contract addresses
* Unsupported chains
* Rate limit exceeded
* Insufficient token balance for swaps

For questions, feedback or support, contact [mcp-support@opensea.io](mailto:mcp-support@opensea.io).

[Request an access token here.](https://opensea.notion.site/24e162eb75d9807b82f0f13cf139e254?pvs=105)
