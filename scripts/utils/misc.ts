import { BigNumber } from "@ethersproject/bignumber";
import { ethers, network } from "hardhat"




export const deepCopy = (anObj: any): any => {
  return JSON.parse(JSON.stringify(anObj));
};





export const padStr = (str: string, desiredWidth = 25): string => {
  const numSpacesNeeded = desiredWidth - str.length;
  for (let idx = 0; idx < numSpacesNeeded; idx++) {
    str += " ";
  }
  return str;
};

export const getSpaces = (numSpaces = 0): string => {
  let spaceStr = "";
  for (let spaceCnt = 0; spaceCnt < numSpaces; spaceCnt++) {
    spaceStr += " ";
  }
  return spaceStr;
};





export namespace JSONBI {
  export const stringify = (value: any, 
               replacer?: ((this: any, key: string, value: any) => any) | undefined | null,
               space?: string | number | undefined): string =>
  {
    return JSON.stringify(value, _replacerBI, space)
  }
  
  export const parse = (text: string,
        reviver?: ((this: any, key: string, value: any) => any) | undefined): any =>
  {
    return JSON.parse(text, _reviverBI)
  }

  const _replacerBI = (key: string, value: any): string => 
  {
    if (typeof value === 'bigint') {
      return value.toString() + 'n'
    }
    return value
  }

  const _reviverBI = (key: string, value: any): any =>
  {
    
    if (typeof value === "string" && /^\d+n$/.test(value)) {
      return BigInt(value.slice(0, value.length - 1));
    }
    return value
  }
}





export const getBlockNumber = async ():Promise<number> => 
{
  return Number(await network.provider.send("eth_blockNumber"));
}


export async function mineBlocks(_options: {blocksToMine?: number, verbose?: boolean} = {}): Promise<number> {
  const options = {
    blocksToMine: 1,
    verbose: false,
    ... _options
  }

  const start = Number(await network.provider.send("eth_blockNumber"));

  for (let idx = 0; idx < options.blocksToMine; idx++) {
    await network.provider.send("evm_mine");
  }

  const end = Number(await network.provider.send("eth_blockNumber"));
  if (options.verbose) {
    console.log(`Mined ${options.blocksToMine} blocks (start=${start}, end=${end}, diff=${end-start})`)
  }

  return end
}
