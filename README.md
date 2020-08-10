# Running the Lamden Block Explorer API Locally

## Dependancies
Install [MongoDB](https://www.mongodb.com/)


## Install Block-Explorer-API
``` bash
git clone https://github.com/Lamden/block-explorer-api.git
cd block-explorer-api
npm install

```

### Create lamden config with masternode info
```bash 
nano config/lamden.js
module.exports = ({ env }) => ({
  masternodes: ["https://masternode-01.lamden.io", "https://masternode-02.lamden.io"]
});

```

## Run
```
npm run develop
```

## Admin Console
Login to the admin console at http://localhost:1337/admin

## Extra Config

### Set Route permissinos
- Navigate to [set the user permissions](http://localhost:1337/admin/plugins/users-permissions/roles)
- Click "Public"
- Under Application click "Select All" beside each Section
- Deselect "count", "create" and "delete" for each Section
- Click "Save"
