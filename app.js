const axios = require('axios');
const BRIDGE_ACCESS_TOKEN = process.env.BRIDGE_ACCESS_TOKEN;
const USER_ACCESS_TOKEN = process.env.USER_ACCESS_TOKEN;
const ROOM_PARTS = [
]

const bridgeClient = axios.create({
    baseURL: process.env.BRIDGE_URL,
    headers: {
        'Authorization': `Bearer ${BRIDGE_ACCESS_TOKEN}`
    }
});

const userClient = axios.create({
    baseURL: process.env.CLIENT_URL,
    headers: {
        'Authorization': `Bearer ${USER_ACCESS_TOKEN}`
    }
});

async function main() {
    const whoamiBridge = await bridgeClient.get("/_matrix/client/r0/account/whoami");
    const whoamiUser = await userClient.get("/_matrix/client/r0/account/whoami");
    console.log(whoamiBridge, whoamiUser);
}

main().then(() => {
    console.log("Script finished");
}).catch((e) => {
    console.error("Script failed:", e);
})
