
const mongoose = require('mongoose');

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
    value: mongoose.Schema.Types.Mixed
});

var contracts = new mongoose.Schema({
    contractName: String,
    hash: String,
    blockNum:  Number,
    subBlockNum: Number,
    totalStamps: Number,
    timestamp: Number,
    sender: String,
    code: String, 
    developer: String, 
    compiled: mongoose.Schema.Types.Mixed,  
    owner: String, 
    submitted: mongoose.Schema.Types.Mixed
});

var stamps = new mongoose.Schema({
    contractName: String,
    functionName: String,
    max: Number,
    min: Number,
    avg: Number,
    numOfTxs: Number,
    total: Number
});

var currentState = new mongoose.Schema({
    rawKey: String,
    contractName: String,
    variableName: String,
    key: String,
    value: mongoose.Schema.Types.Mixed,
    blockNum: Number,
    subBlockNum: Number,
    txHash: String
}); 

var Blocks = mongoose.model('Blocks', blocks, 'blocks');
var Subblocks = mongoose.model('Subblocks', subblocks, 'subblocks');
var Transactions =mongoose.model('Transactions', transactions, 'transactions');
var State = mongoose.model('State', state, 'state');
var SubblockSigs = mongoose.model('SubblockSigs', subblockSigs, 'subblockSigs'); 
var Contracts = mongoose.model('Contracts', contracts, 'contracts'); 
var Stamps = mongoose.model('Stamps', stamps, 'stamps'); 
var CurrentState = mongoose.model('CurrentState', currentState, 'currentState'); 

module.exports = () => ({Blocks, Subblocks, Transactions, State, SubblockSigs, Stamps, Contracts, CurrentState});