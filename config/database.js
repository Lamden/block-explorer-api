module.exports = ({ env }) => ({
  "defaultConnection": "default",
  "connections": {
    "default": {
      "connector": "mongoose",
      "settings": {
        "database": "block-explorer",
        "host": "127.0.0.1",
        "srv": false,
        "port": 27017,
        "username": "myUserAdmin",
        "password": "dbadmin"
      },
      "options": {
        "authenticationDatabase": "admin"
      }
    }
  }
});