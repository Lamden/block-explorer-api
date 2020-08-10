'use strict';

/**
 * An asynchronous bootstrap function that runs before
 * your application gets started.
 *
 * This gives you an opportunity to set up your data model,
 * run jobs, or perform some special logic.
 *
 * See more details here: https://strapi.io/documentation/3.0.0-beta.x/concepts/configurations.html#bootstrap
 */

 /******* MONGO DB CONNECTION INFO **/
const DBUSER = process.env.DBUSER || 'myUserAdmin'
const DBPWD = process.env.DBPWD || 'dbadmin'
const connectionString = `mongodb://${DBUSER}:${DBPWD}@127.0.0.1:27017/block-explorer?authSource=admin`


var wipeOnStartup = process.env.WIPE === 'yes' ? true : false;

const validators = require('types-validate-assert')
const { validateTypes } = validators;

const isLamdenKey = ( key ) => {
    if (validateTypes.isStringHex(key) && key.length === 64) return true;
    return false;
};

const databaseLoader = (https, db, models) => {
    let currBlockNum = 1;
    let checkNextIn = 0;
    let maxCheckCount = 10;
    let alreadyCheckedCount = 0;
    const route_getBlockNum = '/blocks?num='
    const route_getLastestBlock = '/latest_block'
    let lastestBlockNum = 0;
    let currBatchMax = 0;
    let batchAmount = 25;
    let timerId;

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

    const send = (url, callback) => {
        https.get(url, (resp) => {
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

    const storeBlock = async (blockInfo) => {
        if (typeof blockInfo.error === 'undefined' && typeof blockInfo.number !== 'undefined'){
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

            let blockTxList = []
            if (typeof blockInfo.subblocks !== 'undefined'){
                blockInfo.subblocks.forEach(sb => {
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

                    sb.transactions.forEach(tx => {
                        sb.numOfTransactions = sb.numOfTransactions + 1;
                        block.numOfTransactions = block.numOfTransactions + 1;
                        blockTxList.push(tx.hash)
                        subblockTxList.push(tx.hash)

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
                                    value: typeof s.value === 'string' ? s.value : JSON.stringify(s.value)
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

            if (blockInfo.number === currBatchMax) {
                currBlockNum = currBatchMax
                timerId = setTimeout(checkForBlocks, 0);
            }
        }
    }

    const getBlock_MN = (blockNum) => {
        send(`${strapi.config.lamden.masternode()}${route_getBlockNum}${blockNum}`, storeBlock)
    }

    const getLatestBlock_MN = () => {
        return new Promise((resolve, reject) => {
            const returnRes = async (res) => {

                resolve(res)
            }
            send(`${strapi.config.lamden.masternode()}${route_getLastestBlock}`, returnRes)
        })
    }

    const checkForBlocks = async () => {
        let response = await getLatestBlock_MN()

        if (!response.error){
            lastestBlockNum = response.number
            if (lastestBlockNum < currBlockNum || wipeOnStartup){
                await wipeDB();
                wipeOnStartup = false;
            }else{
                console.log('lastestBlockNum: ' + lastestBlockNum)
                console.log('currBlockNum: ' + currBlockNum)
                if (lastestBlockNum === currBlockNum){
                    if (alreadyCheckedCount < maxCheckCount) alreadyCheckedCount = alreadyCheckedCount + 1;
                    checkNextIn = 500 * alreadyCheckedCount;
                    timerId = setTimeout(checkForBlocks, checkNextIn);
                }
    
                if (lastestBlockNum > currBlockNum){
                    currBatchMax = currBlockNum + batchAmount;
                    if (currBatchMax > lastestBlockNum) currBatchMax = lastestBlockNum;
                    if (currBatchMax > 25) currBatchMax + 25
                    for (let i = currBlockNum + 1; i <= currBatchMax; i++) {
                        console.log('getting block: ' + i)
                        getBlock_MN(i)
                    }
                }
    
                if (lastestBlockNum < currBlockNum) {
                    wipeDB();
                    timerId = setTimeout(checkForBlocks, 10000);
                }
            }
        }else{
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

module.exports = () => {
    const https = require('https');
    const mongoose = require('mongoose');

    mongoose.connect(connectionString, {useNewUrlParser: true, useUnifiedTopology: true}, (error) => {

        if(error) console.log(error)
        else{
            console.log("connection successful");

            var transactions = new mongoose.Schema({
                hash:  String,
                result: String,
                contractName: String,
                functionName: String,
                stampsUsed: Number,
                status:   Number,
                transaction:  String, 
                state: String,
                blockNum: Number,
                subBlockNum: Number,
                nonce: Number,
                processor: String,
                sender: String,
                stampsSupplied: Number,
                kwargs: String,
                timestamp: Date,
                signature: String,
                numOfStateChanges: Number
            });

            var blocks = new mongoose.Schema({
                hash: String,
                blockNum:  Number, 
                previous:   String,
                numOfSubBlocks: Number,
                numOfTransactions: Number,
                transactions: String,
                rawBlock: String
            });

            var subblocks = new mongoose.Schema({
                blockNum:  Number,
                inputHash: String,
                merkleLeaves:  String, 
                prevBlockHash:   String,
                signatures: String,
                subBlockNum: Number,
                numOfTransactions: Number,
                transactions: String
            });

            var subblockSigs = new mongoose.Schema({
                blockNum:  Number,
                subBlockNum: Number,
                signature: String,
                signer: String
            });

            var state = new mongoose.Schema({
                hash: String,
                txNonce: Number,
                blockNum:  Number,
                subBlockNum: Number,
                rawKey: String,
                contractName: String,
                variableName: String,
                key: String,
                keyIsAddress: Boolean,
                keyContainsAddress: Boolean,
                keys: String,
                value: String
            });

            var Blocks = mongoose.model('Blocks', blocks, 'blocks');
            var Subblocks = mongoose.model('Subblocks', subblocks, 'subblocks');
            var Transactions =mongoose.model('Transactions', transactions, 'transactions');
            var State = mongoose.model('State', state, 'state');
            var SubblockSigs = mongoose.model('SubblockSigs', subblockSigs, 'subblockSigs'); 
        
            databaseLoader(https, mongoose, {Blocks, Transactions, State, Subblocks, SubblockSigs});
        }
    });
    
};

