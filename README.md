# Running the Lamden Block Explorer API Locally

## Dependancies
Install [MongoDB](https://www.mongodb.com/)


## Install Block-Explorer-API
``` bash
git clone https://github.com/Lamden/block-explorer-api.git
cd block-explorer-api
npm install

```

### Edit masternode config
```bash
nano config/custom.json

{
  "masternodes": ["http://167.172.126.5:18080"]
}

```

### Edit mongo connection string
```bash
nano config/functions/bootstrap.js

>> const connectionString = "YOUR CONNECTION STRING"
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
