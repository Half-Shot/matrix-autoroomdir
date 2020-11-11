const axios = require('axios');
const ROOM_PARTS = require('./roomparts.json');
const BRIDGE_ACCESS_TOKEN = process.env.BRIDGE_ACCESS_TOKEN;
const USER_ACCESS_TOKEN = process.env.USER_ACCESS_TOKEN;

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
    // Check auth
    const whoamiBridge = (await bridgeClient.get("/_matrix/client/r0/account/whoami")).data;
    const whoamiUser = (await userClient.get("/_matrix/client/r0/account/whoami")).data;
    console.log(whoamiBridge, whoamiUser);

    // Run cycle
    for (const iterator of ROOM_PARTS) {
        const alias = `#xmpp_${iterator.replace('@', '_')}:matrix.org`;
        const [ room_id ] = (await bridgeClient.post(`/_matrix/client/r0/join/${encodeURIComponent(alias)}`, {})).data;
        const powerLevels = (await bridgeClient.get(`/_matrix/client/r0/rooms/${encodeURIComponent(room_id)}/state/m.room.power_levels/`)).data;
        console.log(alias);
        console.log(powerLevels);
    }
}

main().then(() => {
    console.log("Script finished");
}).catch((e) => {
    console.error("Script failed:", e);
})
