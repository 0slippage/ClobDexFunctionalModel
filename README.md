# Perp. DEX Functional Prototyping Solidity Model (Incomplete)

This model includes a unique base15 price-index-tree CLOB implemenation.

The most mature code is the price-index-tree, which is also most thoroughly
tested. The base15 implemenation is sub-optimal, but yields performance similar
to IP unavailable at the time of development.

The CLOB supports a variety of different order expressions with limit, market,
post-only and TIF optionality.

PnL / Collateral checks are incomplete along with mark price and index price
behaviors. Also incomplete is x-margining and liquidation.

# Testing
npm run test-hardhat

Note: Sometimes tests fail and need to be re-run a 2nd time (fail 1/2 way
through with bounds error or other anomaly). Recommend following in event of 
this:
  1. npm run clean
  2. npm build-hardhat
  3. npm test-hardhat
