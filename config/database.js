module.exports = ({ env }) => ({
  defaultConnection: 'default',
  connections: {
    default: {
      connector: 'mongoose',
      settings: {
        host: '127.0.0.1',
        srv: false,
        port: 27017,
        database: 'block-explorer',
        username: env('DB_USER', ''),
        password: env('DB_PASS', ''),
      },
      options: {
        authenticationDatabase: env('ADMIN_DB'),
        ssl: false,
      },
    },
  },
});