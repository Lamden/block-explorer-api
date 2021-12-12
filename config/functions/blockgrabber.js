'use strict';
const https = require('https');
const http = require('http');
const validators = require('types-validate-assert')
const { validateTypes } = validators;
const mongoose = require('mongoose');
let db = mongoose;
const genesis_contracts = require('../genesis_contracts.json')
let DEBUG_ON = process.env.DEBUG_ON || false
const INITIAL_STAMPS = parseInt(process.env.INITIAL_STAMPS) || 13

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
    //if (process.env.WIPE === 'yes')  wipeOnStartup = true;
}
console.log({RE_PARSE_BLOCKS: process.env.RE_PARSE_BLOCKS, DEBUG_ON: process.env.DEBUG_ON})
var reParseBlocks = false;
if (typeof process.env.RE_PARSE_BLOCKS !== "undefined") {
	if (process.env.RE_PARSE_BLOCKS === "yes") reParseBlocks = true;
}

// Checks a hash to see if it's a Lamden Public or Private key
const isLamdenKey = ( key ) => {
    if (validateTypes.isStringHex(key) && key.length === 64) return true;
    return false;
};

const databaseLoader = () => {

    const START_AT_BLOCK_NUMBER = 0
    let models = strapi.config.mongooseModels

	let currBlockNum = START_AT_BLOCK_NUMBER;
	let checkNextIn = 0;
	let maxCheckCount = 10;
	let alreadyCheckedCount = 0;
	const route_getBlockNum = "/blocks?num=";
	const route_getLastestBlock = "/latest_block";
	let lastestBlockNum = 0;
	let currBatchMax = 0;
	let batchAmount = 50;
	let timerId;

	async function setInitalState(){
		let states = await models.State.find({})
		if (states.length === 0) {
			console.log("Setting initial State")
			await new models.State({
				hash:  "genesis_stamp_ratio",
				txNonce: 0,
				blockNum: 0,
				subBlockNum: 0,
				rawKey: "stamp_cost.S:value",
				contractName: "stamp_cost",
				variableName: "S",
				key: "value",
				value: INITIAL_STAMPS
			}).save()
		}
		let contracts = await models.Contracts.find({})
		if (contracts.length === 0) {
			console.log("Setting initial Contracts")
			genesis_contracts.forEach(async (contract)=>{
				await new models.State({
					blockNum: 0,
					subBlockNum: 0,
					hash:  "genesis_"+contract.name,
					sender: "",
					contractName: contract.name,
					totalStamps: 0,
					developer: "",
					compiled: "",
					submitted: "",
					owner: contract.owner,
					code: contract.code,
					timestamp: 0
				}).save()
			})
		}
	}

	const wipeDB = async (force = false) => {
		console.log("-----WIPING DATABASE-----");
		if (wipeOnStartup || force){
			await db.models.Blocks.deleteMany({}).then((res) => console.log(res));
			console.log("Blocks DB wiped");
		}
		await db.models.Subblocks.deleteMany({}).then((res) =>
			console.log(res)
		);
		console.log("Subblocks DB wiped");
		await db.models.SubblockSigs.deleteMany({}).then((res) =>
			console.log(res)
		);
		console.log("SubblockSigs DB wiped");
		await db.models.State.deleteMany({}).then(async (res) => {
			console.log(res)
			await setInitalState();
		});
		console.log("State DB wiped");
		await db.models.Transactions.deleteMany({}).then((res) =>
			console.log(res)
		);
		console.log("Transactions DB wiped");
		await db.models.Stamps.deleteMany({}).then((res) =>
			console.log(res)
		);
		console.log("Stamps DB wiped");
		await db.models.Contracts.deleteMany({}).then((res) =>
			console.log(res)
		);
		console.log("Contracts DB wiped");
		await db.models.CurrentState.deleteMany({}).then((res) =>
			console.log(res)
		);
		console.log("CurrentState DB wiped");

		currBlockNum = START_AT_BLOCK_NUMBER;

		console.log(`Set currBlockNum = ${START_AT_BLOCK_NUMBER}`);
		
		timerId = setTimeout(checkForBlocks, 500);
	};

	const sendBlockRequest = (url) => {
		return new Promise((resolve) => {
			let protocol = http;
			if (url.includes("https://")) protocol = https;
			protocol
				.get(url, (resp) => {
					let data = "";
					resp.on("data", (chunk) => {
						data += chunk;
					});
					resp.on("end", () => {
						try {
							// console.log(data);
							resolve(JSON.parse(data));
						} catch (err) {
							console.error("Error: " + err);
							resolve({ error: err.message });
						}
					});
				})
				.on("error", (err) => {
					console.error("Error: " + err.message);
					resolve({ error: err.message });
				});
		});
	};

	const processBlock = async (blockInfo) => {
		if (
			typeof blockInfo.error === "undefined" &&
			typeof blockInfo.number !== "undefined"
		) {
			let hasBlockInDB = false
			let blockNum = blockInfo.number.__fixed__ ? parseInt(blockInfo.number.__fixed__) : blockInfo.number;
			let block = await models.Blocks.findOne({blockNum})
			if (!block){
				console.log("Block doesn't exists, adding new BLOCK model")
				
				block = await new models.Blocks({
					rawBlock: JSON.stringify(blockInfo),
					blockNum,
					hash: blockInfo.hash,
					previous: blockInfo.previous,
					numOfSubBlocks: 0,
					numOfTransactions: 0,
					transactions: JSON.stringify([])
				});
			}else{
				hasBlockInDB = true
				console.log("Block already exists, not adding BLOCK model")
			}

			console.log(
				"processing block " + blockNum + " - ",
				block.hash
			);

			let blockTxList = [];
			if (typeof blockInfo.subblocks !== "undefined") {
				blockInfo.subblocks.forEach(async (sb) => {
					block.numOfSubBlocks = block.numOfSubBlocks + 1;
					let subblockTxList = [];
					let subblock = await new models.Subblocks({
						blockNum,
						inputHash: sb.input_hash,
						merkleLeaves: JSON.stringify(sb.merkle_leaves),
						prevBlockHash: sb.previous,
						signatures: JSON.stringify(sb.signatures),
						subBlockNum: sb.subblock,
						numOfTransactions: 0,
						transactions: JSON.stringify([])
					});

					sb.signatures.forEach(async (sig) => {
						await new models.SubblockSigs({
							blockNum,
							subBlockNum: sb.subblock,
							signature: sig.signature,
							signer: sig.signer
						}).save();
					});
					// console.log(sb.transactions);
					let hashesProcessed  = []
                    sb.transactions.forEach( async (tx) => {
						if (!hashesProcessed.includes(tx.hash)){
							hashesProcessed.push(tx.hash)
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
							let transaction = await new models.Transactions({
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
							
							if (transaction.contractName === "submission" && 
								transaction.functionName === "submit_contract" &&  
								parseInt(tx.status) === 0){
								await new models.Contracts({
									blockNum: blockInfo.number,
									subBlockNum: sb.subblock,
									hash:  tx.hash,
									sender: tx.transaction.payload.sender,
									timestamp: new Date(tx.transaction.metadata.timestamp * 1000),
									contractName: tx.transaction.payload.kwargs.name
								}).save()
							}
							
							// parse and store the state changes from each transaction in the database
							if (Array.isArray(tx.state)){
								tx.state.forEach(async (s) => {
									transaction.numOfStateChanges = transaction.numOfStateChanges + 1
									let state = await new models.State({
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
									
									if (["__code__", "__developer__", "__compiled__",  "__owner__", "__submitted__"].includes(state.variableName)){
										let contractInfo = await models.Contracts.findOne({contractName: state.contractName})
										if (contractInfo){
											const property = state.variableName.replace(/__/g,"")
											await models.Contracts.updateOne({contractName: state.contractName}, {
												[property]: state.value || ""
											});
										}
									}
	
									await state.save();

									// determine the stamps costs for each contracts methods and store the min, max, average and stats
									let currState = await models.CurrentState.findOne({
										rawKey: s.key
									})

									if (!currState){
										await new models.CurrentState({
											rawKey: s.key,
											contractName: s.key.split(":")[0].split(".")[0],
											variableName: s.key.split(":")[0].split(".")[1],
											key: s.key.split(/:(.+)/)[1],
											value: s.value,
											blockNum: blockInfo.number,
											subBlockNum: sb.subblock,
											txHash: tx.hash
										}).save()
									}else{
										// Only update the current state if this update is at a higher block/subblock
										if  (blockInfo.number > currState.blockNum ||  
											(blockInfo.number === currState.blockNum && sb.subblock > blockInfo.subBlockNum)
											){
												await models.CurrentState.updateOne({rawKey: s.key}, {
													value: s.value,
													blockNum: blockInfo.number,
													subBlockNum: sb.subblock,
													txHash: tx.hash
												});
											}
									}
								})
							}
							// determine the stamps costs for each contracts methods and store the min, max, average and stats
							let stampInfo = await models.Stamps.findOne({contractName: transaction.contractName, functionName: transaction.functionName})
							if (!stampInfo){
								await new models.Stamps({
									contractName: transaction.contractName,
									functionName: transaction.functionName,
									avg: transaction.stampsUsed,
									max: transaction.stampsUsed,
									min: transaction.stampsUsed,
									numOfTxs: 1,
									total: transaction.stampsUsed
								}).save()
							}else{
								await models.Stamps.updateOne({contractName: transaction.contractName, functionName: transaction.functionName}, {
									min: transaction.stampsUsed < stampInfo.min ?  transaction.stampsUsed : stampInfo.min,
									max: transaction.stampsUsed > stampInfo.max ? transaction.stampsUsed : stampInfo.max,
									numOfTxs: stampInfo.numOfTxs + 1,
									total: stampInfo.total + transaction.stampsUsed,
									avg: Math.ceil((stampInfo.total + transaction.stampsUsed) / (stampInfo.numOfTxs + 1))
								});
							}
	
							await transaction.save();
						}
                    })
					subblock.transactions = JSON.stringify(subblockTxList);
					await subblock.save();
				});
			}
			block.transactions = JSON.stringify(blockTxList);
			await block.save(function(err) {
				if (err) console.log(err);
				console.log("saved " + blockNum);
			});
			if (blockNum === currBatchMax) {
				currBlockNum = currBatchMax;
				timerId = setTimeout(checkForBlocks, 0);
			}
		}
	};

	const getBlock_MN = (blockNum, timedelay = 0) => {
		return new Promise(resolver => {
			setTimeout(async () => {
				const block_res = await sendBlockRequest(`${strapi.config.lamden.masternode()}${route_getBlockNum}${blockNum}`);
				block_res.id = blockNum
				resolver(block_res);
			}, timedelay)
		})
	};

	const getLatestBlock_MN = () => {
		return new Promise((resolve, reject) => {
			const returnRes = async (res) => {
				resolve(res);
			};

			const res = sendBlockRequest(
				`${strapi.config.lamden.masternode()}${route_getLastestBlock}`
			);
			returnRes(res);
		});
	};

	const malformedBlock = (blockInfo) => {
        const validateValue = (value, name) => {
            if (isNaN(parseInt(value))) throw new Error(`'${name}' has malformed value ${JSON.stringify(value)}`)
        }

        const { number, subblocks } = blockInfo
        try{
            validateValue(number, 'number')
            if (Array.isArray(subblocks)) {
                for (let sb of subblocks){
                    const { transactions, subblock } = sb
                    
                    validateValue(subblock, 'subblock')
                    if (Array.isArray(transactions)) {
                        for (let tx of transactions){
                            const { stamps_used,  status, transaction } = tx
                            const { metadata,  payload } = transaction
                            const { timestamp } = metadata
                            const { nonce, stamps_supplied } = payload
                            validateValue(stamps_used, 'stamps_used')
                            validateValue(status, 'status')
                            validateValue(timestamp, 'timestamp')
                            validateValue(nonce, 'nonce')
                            validateValue(stamps_supplied, 'stamps_supplied')
                        }
                    }
                }
            }
        }catch(e){
            console.log({"Malformed Block":e})
            return true
        }
        return false
    }

	const checkForBlocks = async () => {
		const waitAndCheck = () => {
			console.log("Could not contact masternode, trying again in 10 seconds");
			timerId = setTimeout(checkForBlocks, 10000);
		}
        if(DEBUG_ON){
            console.log("checking")
		}
		
		let response = await getLatestBlock_MN();		

		if (response) {
			if (response.error){
				 waitAndCheck()
				 return
			}

			lastestBlockNum = response.number;

			if (lastestBlockNum.__fixed__) lastestBlockNum = parseInt(lastestBlockNum.__fixed__)
			if (lastestBlockNum < currBlockNum || wipeOnStartup || reParseBlocks) {
				await wipeDB();
				wipeOnStartup = false;
				reParseBlocks = false;
			} else {
                if (DEBUG_ON){
                    console.log("lastestBlockNum: " + lastestBlockNum);
                    console.log("currBlockNum: " + currBlockNum);
                }
				if (lastestBlockNum === currBlockNum) {
					if (alreadyCheckedCount < maxCheckCount)
						alreadyCheckedCount = alreadyCheckedCount + 1;
					checkNextIn = 200 * alreadyCheckedCount;
					timerId = setTimeout(checkForBlocks, checkNextIn);
				}

				let to_fetch = [];
				if (lastestBlockNum > currBlockNum) {
					currBatchMax = currBlockNum + batchAmount;
					if (currBatchMax > lastestBlockNum)
						currBatchMax = lastestBlockNum;
					if (currBatchMax > batchAmount) currBatchMax + batchAmount;

					let blocksToGetCount = 1

					for (let i = currBlockNum + 1; i <= currBatchMax; i++) {
						// Get the raw block data from the internal database
						let block = await db.models.Blocks.findOne({ blockNum: i })
                        let blockData = null;
						
						// If there was somethin then check to make sure it is a proper block and not malformed
                        if (block){
							const { rawBlock } = block
							let blockInfo = JSON.parse(rawBlock)
                            if (blockInfo){
								// If it's good then use this block data instead of getting it from the maternode
								if (!malformedBlock(blockInfo)) {
									blockData = blockInfo
								// If it was malformed then delete the bad block from the database. 
								// not setting "blockData" here will make the logic get it from the Masternode below
								}else{
                                    console.log(`Block ${i}: Malformed block in database, deleting it!`)
                                    await db.models.Blocks.deleteOne({ blockNum: i })
                                }
                            }
                        }
						
						// If we didn't get block data from the database (above)
                        if (blockData === null){
							
							// Create time delay to get the block info (to prevernt getting rate limted)
                            const timedelay = blocksToGetCount * 100;
							// Get blockData from the masternode
							// This is a promise that will get awaited below in Promise.all
							blockData = getBlock_MN(i, timedelay)
                            blocksToGetCount = blocksToGetCount + 1
						}
						
						// Add this Blockdata and blockNum (id) to a list
                        to_fetch.push({id: i, blockData});
					}

					if (to_fetch.length > 0) {
						// Sort the list by id (blockNum) so all our blocks can be processed in order
						to_fetch.sort((a, b) => a.id - b.id);
						// await the masternode results of all the blocks we needed (if any)
                        let processed = await Promise.all(to_fetch.map(b => b.blockData));
						
						// Loop through the blockData in order and process it
                        for (let blockData of processed) {
							// If any blocks are malformed then
							// 1) Don't process it
                            if (malformedBlock(blockData)) {
								console.log({blockData})
								await new models.Blocks({ 
									rawBlock: JSON.stringify(blockData),
									blockNum: blockData.id,
									hash: "malformedBlock",
									previous: "malformedBlock",
									numOfSubBlocks: 0,
									numOfTransactions: 0,
									transactions: JSON.stringify([])
								}).save()	
								console.log("saved " + blockData.id);			
                            }else{
								// If the block is fine process it
                                await processBlock(blockData);
                            }
                        }
                    }else{
                        timerId = setTimeout(checkForBlocks, 10000);
                    }
				}

				if (lastestBlockNum < currBlockNum) {
					//await wipeDB(true);
					timerId = setTimeout(checkForBlocks, 10000);
				}
			}
		} else {
			waitAndCheck()
		}
	};

	models.Blocks.findOne()
		.sort({ blockNum: -1 })
		.then(async (res) => {
			if (res) currBlockNum = res.blockNum ? res.blockNum : 0;
			else currBlockNum = 0;
			await setInitalState();
			timerId = setTimeout(checkForBlocks, 0);
		});
};

module.exports = () => {
    db.connect(connectionString, {useNewUrlParser: true, useUnifiedTopology: true}, (error) => {
        if(error) console.log(error)
        else{
            console.log("connection successful");
            databaseLoader();
        }
    });
};


