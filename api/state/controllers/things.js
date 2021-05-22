
const { sanitizeEntity } = require('strapi-utils');

const removeID = (obj) => {
    try{ delete obj.id }catch(e){}
    try{ delete obj.keyIsAddress }catch(e){}
    try{ delete obj.keyContainsAddress }catch(e){}
    try{ delete obj.keys }catch(e){}
    return obj
}
const removeOther = (obj) => {
    try{ delete obj.txNonce }catch(e){}
    try{ delete obj.subBlockNum }catch(e){}
    try{ delete obj.rawKey }catch(e){}
    try{ delete obj.contractName }catch(e){}
    try{ delete obj.variableName }catch(e){}
    return obj
}
const addMeta = async (result, contractName, values = undefined) => {
    let key = result.key.includes(':') ? result.key.split(":")[0] : result.key
    if (typeof values === 'undefined'){
        values = await strapi.query('state').model.findOne({ rawKey: `${contractName}.S:${key}` }).then(res => res.value)
    }
        
    const queryMeta = async (getMeta) => {
        let meta =  await strapi.query('state').model.find({ rawKey: `${contractName}.S:${key}:${getMeta}` })
        .sort({blockNum: -1, txNonce: -1})
        .limit(1)

        try{
            if (meta[0] && !result.uid) result.uid = JSON.parse(meta[0].keys)[0]
            else return meta[0].value
        }catch (e){
            return undefined
        }
    }

    let returnResult =  await Promise.all(values.map(async (value) => {
        if (value === 'meta_items'){
            let metaItems = await queryMeta(value)
            await Promise.all(metaItems.map(async (item) => {
                let metaValue = await queryMeta(`meta:${item}`)
                result[item] = metaValue
            }))
        }else{
            let metaValue = await queryMeta(value)
            if (typeof metaValue === 'undefined') metaValue = null
            result[value] = await queryMeta(value)
        }
    }))
    return returnResult
}


module.exports = {
    owned: async (ctx) => {
        const { contractName, owner } = ctx.params
        let reclimit = parseInt(ctx.query.limit) || 5
        if (reclimit > 5) reclimit = 5
        let offset = parseInt(ctx.query.offset) || 0;
        let reverse = -1
        if (typeof ctx.query.reverse !== 'undefined') {
            if (ctx.query.reverse === 'true') reverse = 1
        }
        
        var match = { $match : { contractName, variableName: "S", key: { $regex: /:owner$/ }, value: owner}}
        var sort1 = { $sort: { key: 1, blockNum: -1, txNonce: -1 }}
        var group = { $group: { _id: "$key", "blockNum": {$max: "$blockNum"}}}
        var sort2 = { $sort: { value: reverse }}
        var skip = { $skip: offset }
        var limit = { $limit: reclimit}
        var project = { $project: {key: "$_id", "_id": 0}}
        let count = { $count : "count"}
        let dataPipeline = [match, sort1, group, sort2, skip, limit,  project]
        let countPipeline = [match, sort1, group, sort2, project, count]
        let facet = { $facet: {data: dataPipeline, "count": countPipeline}}
        let collation = { locale : "en_US", numericOrdering : true }

        let results = await strapi.query('state').model
            .aggregate([facet])
            .collation(collation)

        let returnList =  await Promise.all(results[0].data.map(async (result) => {
            let sanny = removeID(sanitizeEntity(result, { model: strapi.models.state }))
            await addMeta(
                sanny, 
                contractName
            )

            sanny.owner = owner
            delete sanny.value
            delete sanny.key
            return removeOther(sanny)

        }))  
        return {
            data: returnList,
            count: results[0].count[0] ? results[0].count[0].count : 0
        }
    },
    recent: async (ctx) => {
        const { contractName } = ctx.params
        let reclimit = parseInt(ctx.query.limit) || 5
        if (reclimit > 5) reclimit = 5;
        let offset = parseInt(ctx.query.offset) || 0

        let stateResults = await strapi.query('state').model.find({ 
            contractName,
            variableName: "S",
            key: { $regex: /:thing$/ },
        }, { "id": 0, "_id": 0, "__v": 0})
        .sort({blockNum: -1, txNonce: -1})
        .skip(offset)
        .limit(reclimit)
        
        return await Promise.all(stateResults.map(async (result) => {
            let sanny = removeID(sanitizeEntity(result, { model: strapi.models.state }))
            await addMeta(
                sanny, 
                contractName
            )
            delete sanny.key
            delete sanny.value
            return removeOther(sanny)         
        }))  
    },
    liked: async (ctx) => {
        const { contractName } = ctx.params
        let reclimit = parseInt(ctx.query.limit) || 5
        if (reclimit > 5) reclimit = 5
        let offset = parseInt(ctx.query.offset) || 0;
        let reverse = -1
        if (typeof ctx.query.reverse !== 'undefined') {
            if (ctx.query.reverse === 'true') reverse = 1
        }
        
        var match = { $match : { contractName, variableName: "S", key: { $regex: /:likes$/ }}}
        var sort1 = { $sort: { key: 1, blockNum: -1, txNonce: -1 }}
        var group = { $group: { _id: "$key", "value": {$first: "$value"}}}
        var sort2 = { $sort: { value: reverse }}
        var skip = { $skip: offset }
        var limit = { $limit: reclimit}
        var project = { $project: {key: "$_id", "likes": "$value", "_id": 0}}
        let count = { $count : "count"}
        let dataPipeline = [match, sort1, group, sort2, skip, limit,  project]
        let countPipeline = [match, sort1, group, sort2, project, count]
        let facet = { $facet: {data: dataPipeline, "count": countPipeline}}
        let collation = { locale : "en_US", numericOrdering : true }

        let results = await strapi.query('state').model
            .aggregate([facet])
            .collation(collation)

        let returnList =  await Promise.all(results[0].data.map(async (result) => {
            await addMeta(
                result, 
                contractName
            )
            delete result.key
            return result
        }))  

        return {
            data: returnList.filter(res => res.likes > 0),
            count: results[0].count[0] ? results[0].count[0].count : 0
        }
    },
    forSale: async (ctx) => {
        const { contractName } = ctx.params
        let reclimit = parseInt(ctx.query.limit) || 5
        if (reclimit > 5) reclimit = 5
        let offset = parseInt(ctx.query.offset) || 0;
        let reverse = -1
        if (typeof ctx.query.reverse !== 'undefined') {
            if (ctx.query.reverse === 'true') reverse = 1
        }
        
        var match = { $match : { contractName, variableName: "S", key: { $regex: /:price:amount$/ }}}
        var sort1 = { $sort: { key: 1, blockNum: -1, txNonce: -1 }}
        var group = { $group: { _id: "$key", "value": {$first: "$value"}}}
        var sort2 = { $sort: { value: reverse }}
        var skip = { $skip: offset }
        var limit = { $limit: reclimit}
        var match2 = { $match: { 'value': {$gt: 0} } }
        var project = { $project: {key: "$_id", "price:amount": "$value", "_id": 0}}
        let count = { $count : "count"}
        let dataPipeline = [match, sort1, group, sort2, skip, limit, match2, project]
        let countPipeline = [match, sort1, group, sort2, match2, project, count]
        let facet = { $facet: {data: dataPipeline, "count": countPipeline}}
        let collation = { locale : "en_US", numericOrdering : true }

        let results = await strapi.query('state').model
            .aggregate([facet])
            .collation(collation)

        let returnList =  await Promise.all(results[0].data.map(async (result) => {
            await addMeta(
                result,  
                contractName
            )
            delete result.key
            return result
        }))  

        return {
            data: returnList,
            count: results[0].count[0] ? results[0].count[0].count : 0
        }
    },
    getOne: async (ctx) => {
        const { uid, contractName } = ctx.params

        let thingResult = await strapi.query('state').model.findOne({ 
            contractName,
            variableName: 'S',
            key: uid,
        }, { "id": 0, "_id": 0, "__v": 0})

        let sanny = removeID(sanitizeEntity(thingResult, { model: strapi.models.state }))

        if (sanny){
            await addMeta(
                sanny, 
                contractName,
                sanny.value
            )
            delete sanny.key
            delete sanny.value
            return removeOther(sanny)
        }else{
            return null
        }

    },
    created: async (ctx) => {
        let { contractName, creator } = ctx.params
        let reclimit = parseInt(ctx.query.limit) || 5
        if (reclimit > 5) reclimit = 5
        let offset = parseInt(ctx.query.offset) || 0;
        let reverse = -1
        if (typeof ctx.query.reverse !== 'undefined') {
            if (ctx.query.reverse === 'true') reverse = 1
        }
        
        var match = { $match : { contractName, variableName: "S", key: { $regex: /:creator$/ }, value: creator}}
        var sort1 = { $sort: { key: 1, blockNum: -1, txNonce: -1 }}
        var group = { $group: { _id: "$key", "blockNum": {$max: "$blockNum"}}}
        var sort2 = { $sort: { value: reverse }}
        var skip = { $skip: offset }
        var limit = { $limit: reclimit}
        var project = { $project: {key: "$_id", "_id": 0}}
        let count = { $count : "count"}
        let dataPipeline = [match, sort1, group, sort2, skip, limit,  project]
        let countPipeline = [match, sort1, group, sort2, project, count]
        let facet = { $facet: {data: dataPipeline, "count": countPipeline}}
        let collation = { locale : "en_US", numericOrdering : true }

        let results = await strapi.query('state').model
            .aggregate([facet])
            .collation(collation)
        let returnList =  await Promise.all(results[0].data.map(async (result) => {
            let sanny = removeID(sanitizeEntity(result, { model: strapi.models.state }))
            await addMeta(
                sanny, 
                contractName
            )

            sanny.creator = creator
            delete sanny.value
            delete sanny.key
            return removeOther(sanny)

        }))  
        return {
            data: returnList,
            count: results[0].count[0] ? results[0].count[0].count : 0
        }
    },
    likedOne: async (ctx) => {
        let { contractName, account, uid } = ctx.params

        let stateResults = await strapi.query('state').model.findOne({ 
            contractName,
            variableName: 'S',
            key: `liked:${uid}:${account}`
        }, { "id": 0, "_id": 0, "__v": 0})
        .sort({blockNum: -1, txNonce: -1})  
        
        return {value: !stateResults ? false : true}
    }
}