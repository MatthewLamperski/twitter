import {Client, auth} from 'twitter-api-sdk'
import { TwitterClient } from 'twitter-api-client'
import dotenv from "dotenv"
import fetch from "node-fetch";
import {writeFile, readFile} from 'fs'
import * as fs from "fs";
import cron from 'node-cron'
dotenv.config()

// const client = new Client(BEARER)
// const authClient = new auth.OAuth2User({
//   client_id: process.env.API_KEY,
//   client_secret: process.env.API_KEY_SECRET,
//   callback: "http://127.0.0.1:3000/callback",
//   scopes: [""]
// })

const sleep = ms => new Promise(r => setTimeout(r, ms));

const twitterClient = new TwitterClient({
  apiKey: process.env.API_KEY,
  apiSecret: process.env.API_KEY_SECRET,
  accessToken: process.env.OAUTH_TOKEN_GRAHAM,
  accessTokenSecret: process.env.OAUTH_TOKEN_GRAHAM_SECRET,
})

// Checks if you can DM this person
const canDM = async (id) => {
  return new Promise((resolve, reject) => {
    twitterClient.accountsAndUsers.friendshipsShow({
      source_screen_name: 'dj_paulie_p',
      target_id: id
    })
      .then((res) => {
        resolve(res.relationship.source.can_dm)
      })
      .catch(err => reject(err))
  })
}

const getChrisFollowers = async (cursor) => {
  return new Promise((resolve, reject) => {
    twitterClient.accountsAndUsers.followersList({
      screen_name: 'crossriverbank',
      ...(cursor !== 0 ? {cursor} : {})
    })
      .then(res => {
        resolve(res)
      })
      .catch(err => reject(err))
  })
}


// Creates stats and writes to file. outdated
const createStats = () => {
  readFile('./out.txt', 'utf8', (err, data) => {
    if (err) {
      console.log("[ERROR]: " + JSON.stringify(err, null, 2))
    } else {
      const events = JSON.parse(data)
      const range = getDateRange(events)
      let earliest = new Date(range[0])
      let latest = new Date(range[1])
      let contents = `NUM_OF_EVENTS: ${events.length}, EARLIEST DATE: ${earliest.toDateString()}, LATEST DATE: ${latest.toDateString()} \n EVENTS: \n ${JSON.stringify(events, null, 2)}`
      writeFile('./out.txt', contents, err => {
        if (err) {
          console.log("[ERROR] Writing to file:", JSON.stringify(err, null, 2))
        } else {
          console.log("[INFO] Successfully written results to file. out.txt")
        }
      })
    }
  })
}

// Gets DMs from twitter starting from given cursor
const getDMs = async (cursor) => {
  return new Promise((resolve, reject) => {
    twitterClient.directMessages.eventsList({
      count: 100,
      ...(cursor ? {cursor} : {})
    })
      .then(res => resolve(res))
      .catch(err => reject(err))
  })
}

// Gets earliest and latest dates from array of DM events
const getDateRange = (events) => {
  let timestamps = events.map(event => Number(event.created_timestamp))
  let earliest = timestamps.sort((a, b) => a - b)[0]
  let latest = timestamps.sort((a, b) => b - a)[0]
  return [earliest, latest]
}

// Gets all events in out.txt
const getEvents = async () => {
  return new Promise((resolve, reject) => {
    readFile('out.txt', 'utf8', (err, data) => {
      if (err) {
        console.log('[ERROR]: ')
        reject(err)
      } else {
        let lines = data.split('\n')
        lines.shift()
        const newLines = lines.join('\n')
        resolve(JSON.parse(newLines))
      }
    })
  })
}

// Gets stats from out.txt
const getStats = () => {
  return new Promise((resolve, reject) => {
    readFile('out.txt', 'utf8', (err, data) => {
      if (err) {
        console.log("[ERROR]: ", JSON.stringify(err))
        reject(err)
      } else {
        let statsLine = data.split('\n')[0]
        resolve(JSON.parse(statsLine))
      }
    })
  })
}

// Checks if you have already messaged this person
const alreadyMessaged = async (id) => {
  return new Promise(async (resolve, reject) => {
    readFile('ids.txt', 'utf8', (err, data) => {
      if (err) {
        console.log("[ERROR]: ", JSON.stringify(err))
        reject(err)
      } else {
        let ids = JSON.parse(data)
        resolve(ids.includes(id))
      }
    })
  })
}

// Reads events from out.txt, writes ids of WAGMI recipients to ids.txt
const updateIDs = async () => {
  const events = await getEvents()
  const messages = events.filter(event => event.message_create.message_data.text.includes('WAGMI Ventures'))
  const messaged = messages.map(event => event.message_create.target.recipient_id)
  writeFile('ids.txt', JSON.stringify(messaged, null, 1), (err) => {
    if (err) {
      console.log("[ERROR] ", JSON.stringify(err))
    } else {
      console.log("[SUCCESS] Successfully updated ids.txt")
    }
  })
}

const sendDM = async (id, name) => {
  return new Promise(async (resolve, reject) => {
    const message = randomMessage(name)
    let user, err
    try {
      user = await twitterClient.accountsAndUsers.usersLookup({
        user_id: id
      })
      let dm = await twitterClient.directMessages.eventsNew({
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
    } catch (error) {
      reject(error)
    }
  })
}

const getSentFromDMS = async () => {
  return new Promise((resolve, reject) => {
    readFile('dms.txt', 'utf8', (err, data) => {
      if (err) {
        console.log("[ERROR] Couldn't read from dms.txt")
        reject(err)
      } else {
        const lines = data.split('\n')
        resolve(lines.map(line => ({name: line.split(',')[1], id_str: line.split(',')[line.split(',').length - 1]})))
      }
    })
  })
}

// Fetches DMs sent in past 30 days, outputs events to out.txt
async function updateDMs() {

  const stats = await getStats()
  let nextCursor = '1'
  let count = 0
  let events = []
  while (nextCursor) {
    try {
      count++
      console.log(`[INFO] Fetching page ${count}`)
      let res = await getDMs(nextCursor !== '1' ? nextCursor : undefined)
      nextCursor = res.next_cursor ? res.next_cursor : undefined
      events.push(...res.events)
    } catch (err) {
      if (err.statusCode === 429) {
        console.log("[ERROR] Rate limit exceeded")
        break
      } else {
        console.log("[ERROR] " + JSON.stringify(err, null, 2))
      }
    }
  }
  console.log(`Num of events: ${events.length}`)
  if (events.length > 0) {
    const range = getDateRange(events)
    let earliest = new Date(range[0])
    const oldStats = await getStats()
    const oldEvents = await getEvents()
    const newStats = JSON.stringify({
      nextCursor,
      numOfLoops: count + oldStats.numOfLoops,
      numEvents: events.length + oldStats.numEvents,
      earliest: earliest.toDateString(),
      latest: oldStats.latest,
      lastRequest: new Date().toTimeString(),
    })
    events = events.filter(event1 => !oldEvents.map(event => event.id).includes(event1.id))
    let contents = `${newStats}\n${JSON.stringify([...events, ...oldEvents], null, 2)}`
    writeFile('./out.txt', contents, err => {
      if (err) {
        console.log("[ERROR] Writing to file:", JSON.stringify(err, null, 2))
      } else {
        console.log("[INFO] Successfully written results to file. out.txt")
      }
    })
  }
  console.log('[INFO] Terminating program...')

}

const getFollowersFromFile = async () => {
  return new Promise(async (resolve, reject) => {
    readFile('chrisFollowers.txt', (err, data) => {
      if (err) {
        console.log(err)
        reject(err)
      } else {
        let {users, next_cursor} = JSON.parse(data)
        resolve({users, next_cursor,})
      }
    })
  })
}

const getNextCursor = async () => {
  return new Promise((resolve, reject) => {
    readFile('chrisFollowers.txt', 'utf8', (err, data) => {
      if (err) {
        reject(err)
      } else {
        resolve(JSON.parse(data).next_cursor)
      }
    })
  })
}

const randomMessage = (name) => {
  const questionBank = [
    `Hi ${name}, I started a Web3 syndicate called WAGMI Ventures. Can I add you to our investor deal distribution email? We do about a deal per month. If so, what email works best?`,
    `Hi ${name}, I run a web3 syndicate called WAGMI Ventures. We do about one to two deals per month focused on Seed and Series A. Can I add you to our investor deal distribution email? If so, what email works best?`,
    `Hi ${name}, I run a web3 syndicate called WAGMI Ventures focused on Seed and Series A startups. We do about one to two deals per month and invest alongside top tier VCs. Can I add you to our investor deal distribution email? If so, what email works best?`
  ]
  return questionBank[Math.floor(Math.random()*questionBank.length)];
}

const randomTime = () => {
  return (Math.random() + 0.5).toFixed(2)
}

const updateDMsAndIDs = async () => {
  return new Promise(async (resolve, reject) => {
    try {
      await updateDMs()
      await updateIDs()
      resolve()
    } catch (err) {
      reject(err)
    }
  })
}

const firstBatch = async () => {
  // try {
  //   await updateDMsAndIDs()
  // } catch (err) {
  //   console.log('[ERROR] Updating DMs/IDs ', JSON.stringify(err))
  // }
  while (true) {
    let next_cursor, users
    try {
      next_cursor = await getNextCursor()
      let res = await getChrisFollowers(next_cursor)
      users = res.users
      next_cursor = res.next_cursor
    } catch (err) {
      console.log("[ERROR]: Couldn't get Chris's followers, or getNextCursor() " + JSON.stringify(err))
      process.exit(1)
      break
    }
    for (const follower of users) {
      let can_dm, already_messaged, already_automessaged
      try {
        can_dm = await canDM(follower.id_str)
        already_messaged = await alreadyMessaged(follower.id_str)
        let automessaged = await getSentFromDMS()
        already_automessaged = automessaged.map(user => user.id_str).includes(follower.id_str)
      } catch (err) {
        console.log(`[ERROR] Couldn't verify ability to DM or couldn't see if we have already messaged user. ${JSON.stringify(err)}`)
        process.exit(1)
        break
      }
      if (can_dm && !already_messaged) {
        if (!already_automessaged) {
          // SEND DM
          try {
            const sleeping = randomTime()
            console.log(`[SLEEP] Sleeping for ${sleeping} minutes... DMing ${follower.name}`)
            await sleep(sleeping  * 60 * 1000)
            let dm = await sendDM(follower.id_str, follower.name.split(' ')[0])
            console.log(`[DM] ${follower.name.split(' ')[0]}`)
          } catch (err) {
            console.log(`[ERROR] Couldn't DM ${follower.name} ${follower.id_str}` + JSON.stringify(err))
            process.exit(1)
            break
          }
          try {
            await fs.promises.appendFile('dms.txt', `[DM],${follower.name},${follower.id_str}\n`)
          } catch (err) {
            console.log("[ERROR] Couldn't write to file (dms.txt)", JSON.stringify(err))
            process.exit(1)
          }
        } else {
          console.log(`[INFO] Was about to duplicate message to ${follower.name}, but skipped instead...`)
        }
      } else {
        if (!already_messaged) {
          console.log(`[INFO] Rejected ${follower.name} because they were already messaged...`)
        }
        try {
          await fs.promises.appendFile('rejectedFollowers.txt', `[REJECTED],${follower.name},${follower.id_str}\n`)
        } catch (err) {
          console.log("[ERROR] Couldn't write to file", JSON.stringify(err))
          process.exit(1)
        }
      }
    }

    try {
      await fs.promises.writeFile('chrisFollowers.txt', `${JSON.stringify({next_cursor}, null, 1)}`)
    } catch (err) {
      console.log("[ERROR] Could not write next cursor to file", next_cursor)
    }
    console.log('[LOOP]')
  }
}

firstBatch()

// updateDMsAndIDs()
