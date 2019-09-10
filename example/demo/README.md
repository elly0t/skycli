## Step 1: Set up

1. Install `skycli`:

```shell=bash
$ npm install -g @skygear/skycli@2.0.0-alpha.1
```

2. Set skygear controller location

```
$ skycli config set-cluster-server
? Cluster server endpoint: <controller_endpoint>
? Cluster api key: <api_key>
```

3. Check config

```shell=bash
$ skycli config view
┌──────────────────┬───────────────────────┐
│ Property         │ Value                 │
├──────────────────┼───────────────────────┤
│ Cluster Type     │ enterprise            │
├──────────────────┼───────────────────────┤
│ Cluster Endpoint │ <endpoint>            │
├──────────────────┼───────────────────────┤
│ Cluster API Key  │ <api key              │
├──────────────────┼───────────────────────┤
│ Account          │                       │
└──────────────────┴───────────────────────┘
```

4. Sign up as a new Skygear controller user:

```shell=bash
$ skycli auth signup
? Email: <email>
? Password: [input is hidden]
Sign up as <email>
```

5. Create a Skygear app for our project:

```shell=bash
$ skycli app create
? What is your app name? <appName>
Creating app...
Your API endpoint: hhttps://<appName>.staging.skygearapp.com/.
Your Client API Key: <api key>.
Your Master API Key: <master api key>.
Created app successfully!

? Do you want to setup the project folder now? Or you can do it later by `skycli app scaffold` command.
Setup now? (Y/n) n

To setup later, please run:
    skycli app scaffold
```

6. Navigate to `/frontend/main.js` and configure Skygear SDK with your app's endpoint and API key.

```js
skygear.defaultContainer.configure({
  endpoint: 'CHANGE_TO_YOUR_APPS_ENDPOINT',
  apiKey: 'CHANGE_TO_YOUR_APPS_API_KEY'
});
```

## Step 2: Set up database

1. Create an account on https://www.mongodb.com/cloud/atlas
1. And create a cluster (M0 Sandbox is free).
1. Set Cluster Name (e.g. `skygear-demo`).
1. Then click security tab and create database user.
1. Set IP Whitelist
   1. Click "ADD IP ADDRESS"
   2. CLick "ALLOW ACCESS FROM ANYWHERE"
1. Back to "Overview" tab, and find detail connect information by click "connect" button.
1. Add your mongo DB connection string to your Skygear Secret:

   a. through skycli:
   `skycli secret create MONGO_DB_URL mongodb+srv://<user>:<password>@<hostname>/test?retryWrites=true`

   b. through [Skygear Portal](https://portal.staging.skygear.dev/log-in) with your Skygear user credentials. Once logged in, you can add/delete secrets under the Secret Management section in your app.

1. `skycli app deploy --cloud-code after_signup`

## Step 3 (optional): Play with frontend locally

1. Go to frontend folder

```
$ cd frontend
$ npm install
```

2. Update app endpoint in main.js if you haven't done so
3. Run locally

```
$ npm start
```

4. Open browser, and type in url `http://localhost:8080`
5. Log in and sign up will work as Skygear comes with an auth backend service. The auth functions are called through Skygear SDK in `frontend/main.js`
6. Other backend functions like write blog won't work, as they are not deployed yet

## Step 4: Write blog

1. Go back to the `demo` directory and ensure there exists a `skygear.yaml` config file.
1. To deploy, run:

```
skycli app deploy
```
