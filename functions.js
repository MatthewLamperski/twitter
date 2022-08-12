import {TwitterClient} from "twitter-api-client";
import {readFile, writeFile, appendFile} from "fs";


export const randomTime = () => {
  return (Math.random() + 0.94).toFixed(2)
}

// Returns a random DM from the bank of dms, given a name
const pickRandomMessage = (name) => {
  const questionBank = [
    `Hi ${name}, I run a web3 syndicate called WAGMI Ventures. We do 1-2 deals per month focused on Seed and Series A, and invest alongside blue-chip VCs like a16z, USV, Coinbase Ventures, Dragonfly, and others. Can I add you to our investor deal distribution email? If so, what email works best?`,
    `Hi ${name}, I run a web3 syndicate called WAGMI Ventures. We do about one to two deals per month focused on Seed and Series A. Can I add you to our investor deal distribution email? If so, what email works best?`,
    `Hi ${name}, I run a web3 syndicate called WAGMI Ventures focused on Seed and Series A startups. We do about one to two deals per month and invest alongside top tier VCs. Can I add you to our investor deal distribution email? If so, what email works best?`
  ]
  return questionBank[Math.floor(Math.random()*questionBank.length)];
}

// Function to sleep for a certain number of milliseconds
export const sleep = ms => new Promise(r => setTimeout(r, ms));

// Checks if you can DM this person, accepts twitter client, a source (screen name), and a target account
export const canDM = async (client, source, target) => {
  return new Promise((resolve, reject) => {
    client.accountsAndUsers.friendshipsShow({
      source_screen_name: source,
      target_id: target
    })
      .then((res) => {
        resolve(res.relationship.source.can_dm)
      })
      .catch(err => reject(err))
  })
}

// Gets a list of followers of a given account (target), w/ optional cursor
export const getAccountFollowers = async (client, target, cursor) => {
  return new Promise((resolve, reject) => {
    client.accountsAndUsers.followersList({
      screen_name: target,
      ...(cursor !== 0 ? {cursor} : {})
    })
      .then(res => {
        resolve(res)
      })
      .catch(err => reject(err))
  })
}

// Gets a list of a users that a given account (target) is following, w/ optional cursor
export const getAccountFollowing = async (client, target, cursor) => {
  return new Promise((resolve, reject) => {
    client.accountsAndUsers.friendsList({
      screen_name: target,
      ...(cursor !== 0 ? {cursor} : {})
    })
      .then(res => {
        resolve(res)
      })
      .catch(err => reject(err))
  })
}

// Gets a list of sent/received direct messages given a client, w/ optional cursor
export const getDMs = async (client, target, cursor) => {
  return new Promise((resolve, reject) => {
    client.directMessages.eventsList({
      count: 100,
      ...(cursor ? {cursor} : {})
    })
      .then(res => resolve(res))
      .catch(err => reject(err))
  })
}

// Returns whether an account has already been manually messaged, meaning sent a DM
// that did NOT come from the bot
export const alreadyManuallyMessaged = async (id) => {
  return new Promise((resolve, reject) => {
    readFile('ids.txt', 'utf8', (err, data) => {
      if (err) {
        console.log(`[ERROR] Couldn't read from ids.txt \n${JSON.stringify(err, null, 2)}`)
        reject(err)
      } else {
        let ids = JSON.parse(data)
        resolve(ids.includes(id))
      }
    })
  })
}

// Returns whether an account has already been auto-messaged, meaning send a DM
// that DID come from a bot
export const alreadyAutoMessaged = async (id) => {
  return new Promise((resolve, reject) => {
    readFile('dms.txt', 'utf8', (err, data) => {
      if (err) {
        console.log(`[ERROR] Couldn't read from dms.txt \n${JSON.stringify(err, null, 2)}`)
        reject(err)
      } else {
        const lines = data.split('\n')
        const userObjs = lines.map(line => ({name: line.split(',')[1], id_str: line.split(',')[line.split(',').length - 1]}))
        resolve(userObjs.map(userObj => userObj.id_str).includes(id))
      }
    })
  })
}

// Sends a DM to the given user (with a given name) from the given client
export const sendDM = async (client, id, name) => {
  return new Promise(async (resolve, reject) => {
    const message = pickRandomMessage(name)
    let user, err
    try {
      let dm = await client.directMessages.eventsNew({
        event: {
          type: 'message_create',
          message_create: {
            target: {
              recipient_id: id,
            },
            message_data: {
              text: message
            }
          }
        }
      })
      resolve(dm)
    } catch (err) {
      console.log(`[ERROR] Could not send DM to ${name}/${id} \n${JSON.stringify(err, null, 2)}`)
      reject(err)
    }
  })
}

// Gets next cursor from txt file, given which account
// TODO Make cursor files {name}cursor.txt
export const getNextCursor = async (botName) => {
  return new Promise((resolve, reject) => {
    let fileName = `${botName}Cursor.txt`
    readFile(fileName, 'utf8', (err, data) => {
      if (err) {
        console.log(`[ERROR] Could not read from ${fileName}. \n${JSON.stringify(err, null, 2)}`)
        reject(err)
      } else {
        resolve(JSON.parse(data).next_cursor)
      }
    })
  })
}

// Writes the next cursor to the given bot's cursor file
export const writeNextCursor = async (botName, next_cursor) => {
  return new Promise((resolve, reject) => {
    let fileName = `${botName}Cursor.txt`
    writeFile(fileName, `${JSON.stringify({next_cursor}, null, 1)}`, (err) => {
      if (err) {
        console.log(`[ERROR] Could not write to ${fileName} \n${JSON.stringify(err, null, 3)}`)
        reject(err)
      } else {
        resolve()
      }
    })
  })
}

// Appends rejected user to rejectedFollowers.txt
export const appendRejected = async (user) => {
  return new Promise((resolve, reject) => {
    appendFile('rejectedFollowers.txt', `[REJECTED],${user.name},${user.id_str}\n`, (err) => {
      if (err) {
        console.log(`[ERROR] Could not append rejected user (${JSON.stringify(user)}) to rejectedFollowers.txt \n${JSON.stringify(err, null, 2)}`)
        reject(err)
      } else {
        resolve()
      }
    })
  })
}

// Appends line when direct message sent
export const appendMessaged = async (user) => {
  return new Promise((resolve, reject) => {
    appendFile('dms.txt', `[DM],${user.name},${user.id_str}\n`, (err) => {
      if (err) {
        console.log(`Couldn't write DM to user (${user.name}/${user.id_str}) to file out.txt`)
        reject()
      } else {
        resolve()
      }
    })
  })
}

export const runBot = async (client, bot_name, bot_screen_name, following, target_name) => {
  while (true) {
    let next_cursor, users, res;
    try {
      next_cursor = await getNextCursor(bot_name)
      if (following) {
        res = await getAccountFollowing(client, target_name, next_cursor)
      } else {
        res = await getAccountFollowers(client, target_name, next_cursor)
      }
      users = res.users;
      next_cursor = res.next_cursor
    } catch (err) {
      console.log(`[ERROR] Couldn't get ${target_name}'s ${following ? 'following list' : 'followers list'} \n${JSON.stringify(err, null, 2)}`)
      process.exit(1)
      break
    }
    for (const user of users) {
      let can_dm, already_manually_messaged, already_auto_messaged;

      try {
        already_auto_messaged = await alreadyAutoMessaged(user.id_str)
        already_manually_messaged = await alreadyManuallyMessaged(user.id_str)
      } catch (err) {
        console.log(`[ERROR] Couldn't verify whether user (${JSON.stringify(user)}) has been auto-messaged/manually messaged.`)
        process.exit(1)
        break
      }

      if (!already_manually_messaged && !already_auto_messaged) {
        try {
          can_dm = await canDM(client, bot_screen_name, user.id_str)
          if (can_dm) {
            const sleeping = randomTime()
            console.log(`[SLEEP] Sleeping for ${sleeping} minutes... DMing ${user.name}`)
            await sleep(sleeping * 60 * 1000)
            let dm = await sendDM(client, user.id_str, user.name.split(' ')[0])
            console.log(`[DM] ${user.name.split(' ')[0]}`)
            await appendMessaged(user);
          } else {
            console.log(`[INFO] Rejected ${user.name} because we can't DM them...`)
            try {
              await appendRejected(user)
            } catch (err) {
              process.exit(1)
              break
            }
          }
        } catch (err) {
          process.exit(1)
          break
        }
      } else {
        console.log(`[INFO] Rejected ${user.name} because they were already messaged...`)
        try {
          await appendRejected(user)
        } catch (err) {
          process.exit(1)
          break
        }
      }

    }

    if (next_cursor === '0' || next_cursor === 0) {
      console.log(`[FIN] Next cursor was registered as ${next_cursor}. List completed.`)
      process.exit(1)
    }

    try {
      await writeNextCursor(bot_name, next_cursor)
    } catch (err) {
      console.log(`[ERROR] Could not write next cursor to file (${next_cursor})`)
    }
    console.log('[LOOP]')
  }
}

export const printCurrentAccountHandle = async (client) => {
  client.accountsAndUsers.accountSettings()
    .then(res => console.log(`[INFO] Account settings: \n${JSON.stringify(res, null, 2)}`))
    .catch(err => console.log(`[ERROR] ${JSON.stringify(err, null, 2)}`))
}
