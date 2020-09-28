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

### Create JWT token
1. Generate a secure token.
```bash
openssl rand 64 | base64
```
2. Create .env file in root of the block-explorer-api directory
```bash
nano .env
```
3. Add token info (ctrl-x, "y" to exit and save)
```javascript
ADMIN_JWT_SECRET=token_generated_above
URL=http://127.0.0.1/api
```

## Run
```
npm run develop
```

## Run with PM2
1. Download PM2
```bash
npm install pm2 -g
```
2. Run with PM2
```bash
pm2 start npm --name "block-explorer-api" -- run prod-nowipe
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


