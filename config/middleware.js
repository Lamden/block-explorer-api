module.exports = {
    load: {
      before: ['cors'],
      order: [
        'cors',
      ]
    },
    settings: {
        cors:{
            enabled: true,
            origin: '*'
        }
    }
  };