'use strict';
const https = require('https');
const http = require('http');
const validators = require('types-validate-assert')
const { validateTypes } = validators;
const mongoose = require('mongoose');
let db = mongoose;

 /******* MONGO DB CONNECTION INFO **/
const DBUSER = process.env.DBUSER
const DBPWD = process.env.DBPWD
let connectionString = `mongodb://127.0.0.1:27017/block-explorer`

if (DBUSER) {
    connectionString = `mongodb://${DBUSER}:${DBPWD}@127.0.0.1:27017/block-explorer?authSource=admin`
}


// Supply the env variable WIPE=yes to wipe the mongodb database on startup
var wipeOnStartup = false;
if (typeof process.env.WIPE !== 'undefined') {
    if (process.env.WIPE === 'yes')  wipeOnStartup = true;
}

// Checks a hash to see if it's a Lamden Public or Private key
const isLamdenKey = ( key ) => {
    if (validateTypes.isStringHex(key) && key.length === 64) return true;
    return false;
};


// Main closure
const databaseLoader = (models) => {
    // The current block number the blockgrabber is aware of
    let currBlockNum = 0;
    // The latest block number retrieved from the masternode API
    let lastestBlockNum = 0;
    let checkNextIn = 0;

    // An accumulator for the amount of checks the script has done where no new blocks were encountered
    // The higher this number gets the longer it will wait inbetween checks
    let alreadyCheckedCount = 0;
    // When "alreadyCheckedCount" equals "maxCheckCount" then the script will stop adding time between checks
    // So if it adds 500ms for each increment of "alreadyCheckedCount" then if "maxCheckCount" equals 10 the
    // most the script will ever wait between checks is 5 seconds
    let maxCheckCount = 10;
    

    // Masternode API routes
    const route_getBlockNum = '/blocks?num='
    const route_getLastestBlock = '/latest_block'

    // The highst block number in the currently processing batch of blocks
    let currBatchMax = 0;
    // Amount of blocks to process at one time
    let batchAmount = 100;

    // timer used for calling/clearing checkForBlocks with a timeout
    let timerId;

    // Wipes the dababse if the environment variable WIPE is set to yes
    const wipeDB = async () => {
        console.log('-----WIPING DATABASE-----')
        await db.models.Blocks.deleteMany({}).then(res => console.log(res))
        console.log('Blocks DB wiped')
        await db.models.Subblocks.deleteMany({}).then(res => console.log(res))
        console.log('Subblocks DB wiped')
        await db.models.SubblockSigs.deleteMany({}).then(res => console.log(res))
        console.log('SubblockSigs DB wiped')
        await db.models.State.deleteMany({}).then(res => console.log(res))
        console.log('State DB wiped')
        await db.models.Transactions.deleteMany({}).then(res => console.log(res))
        console.log('Transactions DB wiped')
        currBlockNum = 0;
        console.log('Set currBlockNum = 0')
        timerId = setTimeout(checkForBlocks, 3000); 
    }

    // Sends requests to a masternode and provides the results to a callback function
    const send = (url, callback) => {
        let protocal = http
        if (url.includes('https://')) protocal = https

        protocal.get(url, (resp) => {
            let data = '';
        
            // A chunk of data has been recieved.
            resp.on('data', (chunk) => {
            data += chunk;
            });
        
            // The whole response has been received. Print out the result.
            resp.on('end', () => {

                try{
                    callback(JSON.parse(data))
                } catch (err){
                    console.log("Error: " + err.message);
                    callback({error: err.message})
                }               
            });
        }).on("error", (err) => {
            console.log("Error: " + err.message);
            callback({error: err.message})
        });
    }

    // This function parses the block results from the masternode into the database
    const storeBlock = async (blockInfo) => {
        if (typeof blockInfo.error === 'undefined' && typeof blockInfo.number !== 'undefined'){
            // parse and store the block information
            let block = new models.Blocks({
                rawBlock: JSON.stringify(blockInfo),
                blockNum:  blockInfo.number, 
                hash: blockInfo.hash,
                previous:   blockInfo.previous,
                numOfSubBlocks: 0,
                numOfTransactions: 0,
                transactions: JSON.stringify([])
            })

            console.log('processing block ' + blockInfo.number + ' - ', block.hash)
            
            // parse each subblock
            let blockTxList = []
            if (typeof blockInfo.subblocks !== 'undefined'){
                blockInfo.subblocks.forEach(sb => {
                    // store subblock information in the database
                    block.numOfSubBlocks = block.numOfSubBlocks + 1
                    let subblockTxList = []
                    let subblock = new models.Subblocks({
                        blockNum: blockInfo.number,
                        inputHash: sb.input_hash,
                        merkleLeaves:  JSON.stringify(sb.merkle_leaves), 
                        prevBlockHash:   sb.previous,
                        signatures: JSON.stringify(sb.signatures),
                        subBlockNum: sb.subblock,
                        numOfTransactions: 0,
                        transactions: JSON.stringify([])
                    })

                    sb.signatures.forEach(sig => {
                        new models.SubblockSigs({
                            blockNum: blockInfo.number,
                            subBlockNum: sb.subblock,
                            signature: sig.signature,
                            signer: sig.signer
                        }).save()
                    })
                    // parse each transaction contained in the subblock
                    sb.transactions.forEach( async tx => {
                        sb.numOfTransactions = sb.numOfTransactions + 1;
                        block.numOfTransactions = block.numOfTransactions + 1;
                        blockTxList.push(tx.hash)
                        subblockTxList.push(tx.hash)
                        
                        // store the transaction in the database

                        /* 
                            If you are using this script to grab transactions against a specific smart contract only,
                            then you can filter this logic by checking tx.transaction.payload.contract against the
                            contract name you want.
                        */
                        let transaction = new models.Transactions({
                            hash:  tx.hash,
                            result: tx.result, 
                            stampsUsed: tx.stamps_used,
                            status:   tx.status,
                            transaction:  JSON.stringify(tx.transaction) || undefined, 
                            state: JSON.stringify(tx.state) || undefined,
                            blockNum: blockInfo.number,
                            subBlockNum: sb.subblock,
                            contractName: tx.transaction.payload.contract,
                            functionName: tx.transaction.payload.function,
                            nonce: tx.transaction.payload.nonce,
                            processor: tx.transaction.payload.processor,
                            sender: tx.transaction.payload.sender,
                            stampsSupplied: tx.transaction.payload.stamps_supplied,
                            kwargs: JSON.stringify(tx.transaction.payload.kwargs),
                            timestamp: new Date(tx.transaction.metadata.timestamp * 1000),
                            signature: tx.transaction.metadata.signature,
                            numOfStateChanges: 0
                        })
                        
                        // parse and store the state changes from each transaction in the database
                        if (Array.isArray(tx.state)){
                            tx.state.forEach(s => {
                                transaction.numOfStateChanges = transaction.numOfStateChanges + 1
                                let state = new models.State({
                                    hash:  tx.hash,
                                    txNonce: tx.transaction.payload.nonce,
                                    blockNum: blockInfo.number,
                                    subBlockNum: sb.subblock,
                                    rawKey: s.key,
                                    contractName: s.key.split(":")[0].split(".")[0],
                                    variableName: s.key.split(":")[0].split(".")[1],
                                    key: s.key.split(/:(.+)/)[1],
                                    value: s.value
                                })

                                state.keyIsAddress = isLamdenKey(state.key)
                                state.keyContainsAddress = false
                                let stateKeys = []
                                if (state.key){
                                    state.key.split(":").forEach(k => {
                                        stateKeys.push(k)
                                        if (isLamdenKey(k)) state.keyContainsAddress = true
                                    })
                                }
                                state.keys = JSON.stringify(stateKeys)
                                state.save();
                            })
                        }

                        // determine the stamps costs for each contracts methods and store the min, max, average and stats
                        let stampInfo = await models.Stamps.findOne({contractName: transaction.contractName, functionName: transaction.functionName})
                        if (!stampInfo){
                            new models.Stamps({
                                contractName: transaction.contractName,
                                functionName: transaction.functionName,
                                avg: transaction.stampsUsed,
                                max: transaction.stampsUsed,
                                min: transaction.stampsUsed,
                                numOfTxs: 1
                            }).save()
                        }else{
                            await models.Stamps.updateOne({contractName: transaction.contractName, functionName: transaction.functionName}, {
                                min: transaction.stampsUsed < stampInfo.min ?  transaction.stampsUsed : stampInfo.min,
                                max: transaction.stampsUsed > stampInfo.max ? transaction.stampsUsed : stampInfo.max,
                                avg: Math.ceil((stampInfo.avg + transaction.stampsUsed) / 2 ),
                                numOfTxs: stampInfo.numOfTxs + 1
                            });
                        }

                        transaction.save();
                    })
                    subblock.transactions = JSON.stringify(subblockTxList);
                    subblock.save();
                })
            }
            block.transactions = JSON.stringify(blockTxList)
            block.save(function (err) {
                if (err) console.log(err);
                console.log('saved ' + blockInfo.number)
            });
            /*
                If the current block processed is equal to the maxBatch number then we have processed all the blocks
                in this batch and should trigger the script to check for more.
            */
            if (blockInfo.number === currBatchMax) {
                currBlockNum = currBatchMax
                timerId = setTimeout(checkForBlocks, 0);
            }
        }
    }

    // Call the "send" function to get the information about a specific blocknumber
    // Then call "storeBlock" to process the block information into the database
    const getBlock_MN = (blockNum) => {
        send(`${strapi.config.lamden.masternode()}${route_getBlockNum}${blockNum}`, storeBlock)
    }
    /*
        Call the "send" function to get the latest block number.
        Then call "returnRes" to see if it's higher than currBlockNum; which is the current highest block number
        this script knows about.
    */
    const getLatestBlock_MN = () => {
        return new Promise((resolve, reject) => {
            const returnRes = async (res) => {
                resolve(res)
            }
            send(`${strapi.config.lamden.masternode()}${route_getLastestBlock}`, returnRes)
        })
    }

    /*
        This is the main loop of the blockgrabber script.  It is a recursive function (it calls itself).
        This logic works along these lines:
        1) get the latest block from the masternode
            o - If the response is an error, wait 10 seconds and try again
        2) Set "lastestBlockNum" to the value of the masternode response
        3) If the blocknumber is LESS than the block number we know about then the blockchain was reset.
           so we should wipe the database and start grabbing blocks from blocknumber 0 ("currBlockNum" 
           reset in the "wipeDB" function)
           ** This would never happen on mainnet, but this logic is there for when testnet is reset. **
        4) If the "lastestBlockNum" EQUALS "currBlockNum" then there are no new blocks to process.
            o - "alreadyCheckedCount" will be incremented by 1 and then we will wait 500ms * alreadyCheckedCount
               before calling "checkForBlocks" again.  This is basically an internal rate limiter to prevent hammering
               the masternode in slow times.
        5) If the "lastestBlockNum" IS GREATER THAN "currBlockNum" then we have found new blocks that our script
           did not know about.
            o - set "currBatchMax" to the "currBlockNum" + "batchAmount" which will ensure that we only process the amount of blocks
                that is equal to "batchAmount"
            o - next if "currBatchMax" was actually higher than the amount of blocks we actually have to process then just set it to 
                "lastestBlockNum"
            o - next, get the block info from the masternode, and process the blocks inth the database starting from  "currBlockNum" + 1
                to the "currBatchMax"; delaying each call by 100ms to prevent getting ratelimited by the masternode.
        6) the "storeBlock" function has a check at the end that will call this function again when the last block in our batch has been
           processed.  In that case the logic starts all over again, the script eithe waits for more blocks to appear on the masternode or
           processes new blocks.
    */
    const checkForBlocks = async () => {
        // Get the lastest block nunmber from the masternode
        let response = await getLatestBlock_MN()

        // If there was an error in the response then wait and try again
        if (!response.error){
            // Set "lastestBlockNum" the block number from masternode response
            lastestBlockNum = response.number
            // If the masternode blocknumber was LESS than the last block we processed then WIPE the database and start
            // grabbing from 0.
            if (lastestBlockNum < currBlockNum || wipeOnStartup){
                await wipeDB();
                wipeOnStartup = false;
            }else{
                console.log('lastestBlockNum: ' + lastestBlockNum)
                console.log('currBlockNum: ' + currBlockNum)
                // If the masternode block number was EQUAL to the last block we processed then increment the
                // "alreadyCheckedCount" accumulator and call this function again in "alreadyCheckedCount" * 500ms.
                if (lastestBlockNum === currBlockNum){
                    if (alreadyCheckedCount < maxCheckCount) alreadyCheckedCount = alreadyCheckedCount + 1;
                    checkNextIn = 500 * alreadyCheckedCount;
                    timerId = setTimeout(checkForBlocks, checkNextIn);
                }
                
                // If If the masternode block number GREATER THAN the last block we processed then process the new blocks
                // into the database using our batching logic (descibed above).
                if (lastestBlockNum > currBlockNum){
                    currBatchMax = currBlockNum + batchAmount;
                    if (currBatchMax > lastestBlockNum) currBatchMax = lastestBlockNum;
                    if (currBatchMax > batchAmount) currBatchMax + batchAmount
                    for (let i = currBlockNum + 1; i <= currBatchMax; i++) {
                        let timedelay = (i - currBlockNum)
                        console.log('getting block: ' + i + " with delay of " + timedelay + 'ms')
                        setTimeout(() => getBlock_MN(i), 100 + timedelay);
                    }
                }
                
                // If the masternode blocknumber was LESS than the last block we processed then WIPE the database and start
                // grabbing from 0.
                if (lastestBlockNum < currBlockNum) {
                    wipeDB();
                    timerId = setTimeout(checkForBlocks, 10000);
                }
            }
        }else{
            // If there was an error contacting the masternode then try again in 10 seconds.
            // This logic was mainly for a multi-masternode setup where one might go offline.
            console.log('Could not contact masternode, trying again in 10 seconds')
            timerId = setTimeout(checkForBlocks, 10000);
        }
    }

    models.Blocks.findOne().sort({blockNum: -1})
    .then(async (res) => {
        if (res) currBlockNum = res.blockNum ? res.blockNum : 0;
        else currBlockNum = 0
        console.log('wipeOnStartup', wipeOnStartup)
        timerId = setTimeout(checkForBlocks, 0);
    })
}

/* 
    This is a module export for strapi. 
    If using this script outside of strapi:
        1) add an import of '../mongooseModels.js' into this script at the top
        2) alter the "databaseLoader" line below to accept the mongooseModels you imported instead of "strapi.config.mongooseModels"
        2) import this script into your project. Assuming it can connect to the mongodb database, it should start right away.
*/
module.exports = () => {
    db.connect(connectionString, {useNewUrlParser: true, useUnifiedTopology: true}, (error) => {
        if(error) console.log(error)
        else{
            console.log("connection successful");
            databaseLoader(strapi.config.mongooseModels);
        }
    });
};


