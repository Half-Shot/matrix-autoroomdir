const axios = require('axios');
const assert = require('assert').strict;
const ROOM_PARTS = require('./roomparts.json');
const BRIDGE_ACCESS_TOKEN = process.env.BRIDGE_ACCESS_TOKEN;
const USER_ACCESS_TOKEN = process.env.USER_ACCESS_TOKEN;
const MIN_PL_FOR_DIRECTORY = 50; // technically this is the same as m.room.canonical_alias for the room

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
    const userId = whoamiUser.user_id;
    assert(userId);
    console.log(whoamiBridge, whoamiUser);

    // Run cycle
    for (const iterator of ROOM_PARTS) {
        const alias = `#xmpp_${iterator.replace('@', '_')}:matrix.org`;

        const joinResult = await bridgeClient.post(`/_matrix/client/r0/join/${encodeURIComponent(alias)}`, {});
        const roomId = joinResult.data.room_id;

        assert(roomId);
        const powerLevels = (await bridgeClient.get(`/_matrix/client/r0/rooms/${encodeURIComponent(roomId)}/state/m.room.power_levels/`)).data;
        powerLevels.users[userId] = MIN_PL_FOR_DIRECTORY;

        // Put the new PLs
        await bridgeClient.put(`/_matrix/client/r0/rooms/${encodeURIComponent(roomId)}/state/m.room.power_levels/`, powerLevels);
        for(let i = 0; i < 3; i++) {
            await new Promise((r) => setTimeout(r, 10000)); // Wait a bit for the change to propagate over federation.
            try {
                await userClient.put(`/_matrix/client/r0/directory/list/room/${encodeURIComponent(alias)}`, {
                    visibility: "public",
                });
                break;
            } catch (ex) {
                console.log("Setting directory failed", ex);
            }
            console.log("Trying again in 10s")
        }

        // Reset the PLs
        delete powerLevels.users[userId];
        await bridgeClient.put(`/_matrix/client/r0/rooms/${encodeURIComponent(roomId)}/state/m.room.power_levels/`, powerLevels);
    }
}

main().then(() => {
    console.log("Script finished");
}).catch((e) => {
    console.error("Script failed:", e);
})
