
const { sanitizeEntity } = require('strapi-utils');

const removeID = (obj) => {
    try{
       delete obj.id
       delete obj.keyIsAddress
       delete obj.keyContainsAddress
       delete obj.keys
    }catch(e){}
    return obj
}
const addMeta = async (result, values, contractName, replace) => {
    values.push('meta_items')
    let raw = `${contractName}.S:`
    const queryMeta = async (getMeta) => {
        let meta =  await strapi.query('state').model.find({ 
            rawKey: `${raw}${result.key.replace(`:${replace}`, `:${getMeta}`)}`
        })

        .sort({blockNum: -1, txNonce: -1})
        .limit(1)
        try{
            if (meta[0] && !result.uid) result.uid = JSON.parse(meta[0].keys)[0]
            if (getMeta === 'price:amount') return parseFloat(meta[0].value, 8)
            if (getMeta === 'likes') return parseInt(meta[0].value)
            else return meta[0].value
        }catch (e){
            return undefined
        }
    }

    let returnResult =  await Promise.all(values.map(async (value) => {
        if (value === 'meta_items'){
            let metaItems = JSON.parse(await queryMeta(value))
            await Promise.all(metaItems.map(async (item) => {
                let metaValue = await queryMeta(`meta:${item}`)
                result[item] = JSON.parse(metaValue)
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
        let reclimit = parseInt(ctx.query.limit) || 20
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

        console.log(results)

        let returnList =  await Promise.all(results[0].data.map(async (result) => {
            console.log(result)
            let uid = result.key.split(":")[0]
            let res =  await strapi.query('state').model.findOne({ 
                rawKey: `${contractName}.S:${uid}`
            })
            let sanny = removeID(sanitizeEntity(result, { model: strapi.models.state }))
            await addMeta(
                sanny, 
                JSON.parse(res.value), 
                contractName, 
                'owner'
            )

            sanny.owner = owner
            delete sanny.value
            return sanny

        }))  
        return {
            data: returnList,
            count: results[0].count[0] ? results[0].count[0].count : 0
        }
    },
    recent: async (ctx) => {
        const { contractName } = ctx.params
        const limit  = parseInt(ctx.query.limit) || 25
        const offset = parseInt(ctx.query.offset) || 0

        let stateResults = await strapi.query('state').model.find({ 
            contractName,
            variableName: "S",
            key: { $regex: /:thing$/ },
        }, { "id": 0, "_id": 0, "__v": 0})
        .sort({blockNum: -1, txNonce: -1})
        .skip(offset)
        .limit(limit)
        
        return await Promise.all(stateResults.map(async (result) => {
            let sanny = removeID(sanitizeEntity(result, { model: strapi.models.state }))
            await addMeta(
                sanny, 
                ['name', 'likes', 'owner', 'description', 'price:amount', 'price:hold'], 
                contractName, 
                'thing'
            )
            sanny.thing = sanny.value
            delete sanny.key
            delete sanny.value
            return sanny          
        }))  
    },
    liked: async (ctx) => {
        const { contractName } = ctx.params
        let reclimit = parseInt(ctx.query.limit) || 20
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
                ['name', 'thing', 'owner', 'description', 'price:amount', 'price:hold'], 
                contractName, 
                'likes'
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
        let reclimit = parseInt(ctx.query.limit) || 20
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
        var project = { $project: {key: "$_id", "price:amount": "$value", "_id": 0}}
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
                ['name', 'thing', 'owner', 'description', 'likes', 'meta_items'], 
                contractName, 
                'price:amount'
            )
            delete result.key
            result['price:amount'] = JSON.parse(result['price:amount'])
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
        let values = thingResult.value.replace(/\[|\]|\"/g,'').split(',')
        if (!values.includes("meta_items")) values.push("meta_items")

        thingResult.key = thingResult.key + ":"

        let sanny = removeID(sanitizeEntity(thingResult, { model: strapi.models.state }))
        await addMeta(
            sanny, 
            values, 
            contractName, 
            ''
        )
        delete sanny.key
        return sanny
    },
    created: async (ctx) => {
        let { contractName, variableName } = ctx.request.body
        let { creator } = ctx.params

        let stateResults = await strapi.query('state').model.find({ 
            contractName,
            variableName,
            key: { $regex: /:creator$/ },
            value: creator
        }, { "id": 0, "_id": 0, "__v": 0})
        .sort({blockNum: -1, txNonce: -1})
        
        return await Promise.all(stateResults.map(async (result) => {
            let sanny = removeID(sanitizeEntity(result, { model: strapi.models.state }))
            await addMeta(
                sanny, 
                ['name', 'likes', 'owner', 'thing', 'description', 'price:amount', 'price:hold'], 
                contractName, 
                'creator'
            )
            sanny.creator = sanny.value
            delete sanny.key
            delete sanny.value
            return sanny          
        }))  
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