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



const databaseLoader = (http, db, models) => {
    let processingBlocks = false;
    let nextBlockNum = 2;
    let checkNextIn = 0;
    let alreadyCheckedCount = 0;
    const url_getBlockNum = 'http://167.172.126.5:18080/blocks?num='
    let query_maxBlock = db.models.Blocks.find().sort({blockNum : -1}).limit(1)
    const send = (url, callback) => {
        http.get(url, (resp) => {
            let data = '';
        
            // A chunk of data has been recieved.
            resp.on('data', (chunk) => {
            data += chunk;
            });
        
            // The whole response has been received. Print out the result.
            resp.on('end', () => {
                callback(JSON.parse(data))
            });
        }).on("error", (err) => {
            console.log("Error: " + err.message);
            doneProcessingBlock();
        });
    }

    const doneProcessingBlock = () => {
        checkNextIn = 0;
        processingBlocks = false;
    }

    const storeBlock = (blockInfo) => {
        //console.log(blockInfo);
        if (typeof blockInfo.error === 'undefined' && typeof blockInfo.blockNum !== 'undefined'){
            console.log('processing block ' + blockInfo.blockNum)
            let block = new models.Blocks({
                blockNum:  blockInfo.blockNum, 
                hash: blockInfo.hash,
                previous:   blockInfo.previous,
                numOfSubBlocks: 0,
                numOfTransactions: 0,
                transactions: JSON.stringify([])
            })
            let blockTxList = []
            if (typeof blockInfo.subBlocks !== 'undefined'){
                blockInfo.subBlocks.forEach(sb => {
                    block.numOfSubBlocks = block.numOfSubBlocks + 1
                    let subblockTxList = []
                    let subblock = new models.Subblocks({
                        blockNum: blockInfo.blockNum,
                        inputHash: sb.inputHash,
                        merkleLeaves:  JSON.stringify(sb.merkleLeaves), 
                        prevBlockHash:   sb.prevBlockHash,
                        signatures: JSON.stringify(sb.signatures),
                        subBlockNum: sb.subBlockNum,
                        numOfTransactions: 0,
                        transactions: JSON.stringify([])
                    })

                    sb.transactions.forEach(tx => {
                        sb.numOfTransactions = sb.numOfTransactions + 1;
                        block.numOfTransactions = block.numOfTransactions + 1;
                        blockTxList.push(tx.hash)
                        subblockTxList.push(tx.hash)
                        let transaction = new models.Transactions({
                            hash:  tx.hash, 
                            stampsUsed: tx.stampsUsed,
                            status:   tx.status,
                            transaction:  JSON.stringify(tx.transaction) || undefined, 
                            state: JSON.stringify(tx.state) || undefined,
                            blockNum: blockInfo.blockNum,
                            subBlockNum: sb.subBlockNum,
                            contractName: tx.transaction.payload.contractName,
                            functionName: tx.transaction.payload.functionName,
                            nonce: tx.transaction.payload.nonce,
                            processor: tx.transaction.payload.processor,
                            sender: tx.transaction.payload.sender,
                            stampsSupplied: tx.transaction.payload.stampsSupplied,
                            kwargs: tx.transaction.payload.kwargs,
                            timestamp: tx.transaction.metadata.timestamp,
                            signature: tx.transaction.metadata.signature,
                            numOfStateChanges: 0
                        })
                        
                        tx.state.forEach(s => {
                            transaction.numOfStateChanges = transaction.numOfStateChanges + 1
                            new models.State({
                                hash:  tx.hash,
                                blockNum: blockInfo.blockNum,
                                subBlockNum: sb.subBlockNum,
                                rawKey: s.key,
                                contractName: s.key.split(":")[0].split(".")[0],
                                variableName: s.key.split(":")[0].split(".")[1],
                                key: s.key.split(/:(.+)/)[1],
                                value: s.value,
                            }).save();
                        })
                        transaction.save();
                    })
                    subblock.transactions = JSON.stringify(subblockTxList);
                    subblock.save();
                })
            }
            block.transactions = JSON.stringify(blockTxList)
            block.save(function (err) {
                if (err) console.log(err);
                console.log('saved ' + blockInfo.blockNum)
                doneProcessingBlock();
            });
            alreadyCheckedCount = 0;
        }else{
            checkNextIn = 5000;
            doneProcessingBlock() 
        }
    }

    const getNextBlock = (nextBlockNum) => {
        console.log('checking block ' + nextBlockNum)
        send(url_getBlockNum + nextBlockNum, storeBlock)
    }
  
    // Timer to check pending transacations
    let timerId = setTimeout(function checkForBlocks() {
        if(!processingBlocks){
            processingBlocks = true;
            query_maxBlock.then(res => {
                if (res.length > 0) nextBlockNum = res[0].blockNum + 1
                getNextBlock(nextBlockNum)
            })
        }else{
            console.log('already checked ' + alreadyCheckedCount)
            checkNextIn = 1000 * alreadyCheckedCount;
            if (alreadyCheckedCount < 10 ) alreadyCheckedCount = alreadyCheckedCount + 1
        }
        timerId = setTimeout(checkForBlocks, checkNextIn);
    }, 0);
}

module.exports = () => {
    const http = require('http');
    const mongoose = require('mongoose');
    mongoose.connect('mongodb://myUserAdmin:dbadmin@127.0.0.1:27017/block-explorer?authSource=admin', {useNewUrlParser: true, useUnifiedTopology: true}, (error) => {

        if(error) console.log(error)
        else{
            console.log("connection successful");

            var transactions = new mongoose.Schema({
                hash:  String,
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
                transactions: String
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

            var state = new mongoose.Schema({
                hash: String,
                blockNum:  Number,
                subBlockNum: Number,
                rawKey: String,
                contractName: String,
                variableName: String,
                key: String,
                value: String
            });

            var Blocks = mongoose.model('Blocks', blocks, 'blocks');
            var Subblocks = mongoose.model('Subblocks', subblocks, 'subblocks');
            var Transactions =mongoose.model('Transactions', transactions, 'transactions');
            var State = mongoose.model('State', state, 'state');
        
            databaseLoader(http, mongoose, {Blocks, Transactions, State, Subblocks});
        }
    });
    
};


