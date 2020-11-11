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
    },
    method: 'post'
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
        console.log("Handling", alias);
        console.log("Joining room");
        let joinResult;
        let roomId;
        try {
            joinResult = await userClient.post(`/_matrix/client/r0/join/${encodeURIComponent(alias)}`);
        } catch (ex) {
            if (ex.response.data.errcode === 'M_FORBIDDEN') {
                console.log(`Skipping ${alias}, forbidden`);
                continue;
                // console.log("Room is invite-only, inviting first.");
                // console.log("Joining bridge...");
                // const bridgeJoinResult = await bridgeClient.post(`/_matrix/client/r0/join/${encodeURIComponent(alias)}`);
                // roomId = bridgeJoinResult.data.room_id;
                // console.log("Inviting user");
                // await bridgeClient.post(`/_matrix/client/r0/rooms/${encodeURIComponent(roomId)}/invite`, { user_id: userId });
                // console.log("Joining room (again)");
                // joinResult = await userClient.post(`/_matrix/client/r0/join/${encodeURIComponent(alias)}`);
            }
            if (ex.response.data.errcode === 'M_NOT_FOUND') {
                console.log(`Skipping ${alias}, not found`);
                continue;
            }
            throw ex;
        }
        roomId = joinResult.data.room_id;

        assert(roomId);
        console.log("Fetching PLs");
        const powerLevels = (await bridgeClient.get(`/_matrix/client/r0/rooms/${encodeURIComponent(roomId)}/state/m.room.power_levels/`)).data;
        if (powerLevels.users[userId] !== MIN_PL_FOR_DIRECTORY) {
            powerLevels.users[userId] = MIN_PL_FOR_DIRECTORY;
            console.log("Applying PLs");
            // Put the new PLs
            await bridgeClient.put(`/_matrix/client/r0/rooms/${encodeURIComponent(roomId)}/state/m.room.power_levels/`, powerLevels);
        }

        for(let i = 0; i < 3; i++) {
            console.log("Setting directory");
            await new Promise((r) => setTimeout(r, 5000)); // Wait a bit for the change to propagate over federation.
            try {
                await userClient.put(`/_matrix/client/r0/directory/list/room/${encodeURIComponent(roomId)}`, {
                    visibility: "public",
                });
                break;
            } catch (ex) {
                console.log("Setting directory failed", ex);
            }
            console.log("Trying again in 5s")
        }

        // Reset the PLs
        console.log("Removing PLs");
        delete powerLevels.users[userId];
        await bridgeClient.put(`/_matrix/client/r0/rooms/${encodeURIComponent(roomId)}/state/m.room.power_levels/`, powerLevels);
        console.log("Leaving");
        await userClient.post(`/_matrix/client/r0/rooms/${encodeURIComponent(roomId)}/leave`, {});
    }
}

main().then(() => {
    console.log("Script finished");
}).catch((e) => {
    console.error("Script failed:", e);
})
