
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
const addMeta = async (result, values, contractName, variableName, replace) => {
    let raw = `${contractName}.${variableName}:`
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

    return await Promise.all(values.map(async (value) => {
        if (value === 'meta_items'){
            let metaItems = JSON.parse(await queryMeta(value))
            await Promise.all(metaItems.map(async (item) => {
                let metaValue = await queryMeta(`meta:${item}`)
                result[item] = JSON.parse(metaValue)
            }))
        }else{
            if (value === 'price:amount') result['price'] = await queryMeta(value)
            else result[value] = await queryMeta(value)
        }

    }))
}


module.exports = {
    owned: async (ctx) => {
        let { contractName, variableName } = ctx.request.body
        let { owner } = ctx.params
        let stateResults = await strapi.query('state').model.find({ 
            contractName,
            variableName,
            key: { $regex: /:owner$/ },
            value: ctx.params.owner
        }, { "id": 0, "_id": 0, "__v": 0})
        .sort({blockNum: -1, txNonce: -1})
        
        let returnList =  await Promise.all(stateResults.map(async (result) => {
            //console.log(result)
            if (result.keys.includes('owner')){
                let res =  await strapi.query('state').model.find({ 
                    rawKey: result.rawKey
                })
                .sort({blockNum: -1, txNonce: -1})
                .limit(1)
                if (res[0].value === owner){
                    let sanny = removeID(sanitizeEntity(res[0], { model: strapi.models.state }))
                    await addMeta(
                        sanny, 
                        ['name', 'thing', 'likes', 'description', 'price:amount', 'price:hold', 'meta_items'], 
                        contractName, 
                        variableName, 
                        'owner'
                    )
                    sanny.owner = sanny.value
                    delete sanny.value
                    return sanny
                }
            }
        }))  
        return returnList.filter((res) => res)
    },
    recent: async (ctx) => {
        const { contractName, variableName } = ctx.request.body
        const limit  = parseInt(ctx.query.limit) || 25
        const offset = parseInt(ctx.query.offset) || 0

        let stateResults = await strapi.query('state').model.find({ 
            contractName,
            variableName,
            key: { $regex: /:thing$/ },
        }, { "id": 0, "_id": 0, "__v": 0})
        .sort({blockNum: -1, txNonce: -1})
        .skip(offset)
        .limit(limit)
        
        return await Promise.all(stateResults.map(async (result) => {
            let sanny = removeID(sanitizeEntity(result, { model: strapi.models.state }))
            await addMeta(
                sanny, 
                ['name', 'likes', 'owner', 'description', 'price:amount', 'price:hold', 'meta_items'], 
                contractName, 
                variableName, 
                'thing'
            )
            sanny.thing = sanny.value
            delete sanny.key
            delete sanny.value
            return sanny          
        }))  
    },
    liked: async (ctx) => {
        const { contractName, variableName } = ctx.request.body
        let reclimit = parseInt(ctx.query.limit) || 20
        let offset = parseInt(ctx.query.offset) || 0;
        let reverse = -1
        if (typeof ctx.query.reverse !== 'undefined') {
            if (ctx.query.reverse === 'true') reverse = 1
        }
        
        var match = { $match : { contractName, variableName, key: { $regex: /:likes$/ }}}
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
                ['name', 'thing', 'owner', 'description', 'price:amount', 'price:hold', 'meta_items'], 
                contractName, 
                variableName, 
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
        const { contractName, variableName } = ctx.request.body
        let reclimit = parseInt(ctx.query.limit) || 20
        let offset = parseInt(ctx.query.offset) || 0;
        let reverse = -1
        if (typeof ctx.query.reverse !== 'undefined') {
            if (ctx.query.reverse === 'true') reverse = 1
        }
        
        var match = { $match : { contractName, variableName, key: { $regex: /:price:amount$/ }}}
        var sort1 = { $sort: { key: 1, blockNum: -1, txNonce: -1 }}
        var group = { $group: { _id: "$key", "value": {$first: "$value"}}}
        var sort2 = { $sort: { value: reverse }}
        var skip = { $skip: offset }
        var limit = { $limit: reclimit}
        var project = { $project: {key: "$_id", "price": "$value", "_id": 0}}
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
                ['name', 'thing', 'owner', 'description', 'likes', 'meta_items', 'price:hold'], 
                contractName, 
                variableName, 
                'price:amount'
            )
            delete result.key
            return result
        }))  

        return {
            data: returnList.filter(res => res.price > 0),
            count: results[0].count[0] ? results[0].count[0].count : 0
        }
    },
}