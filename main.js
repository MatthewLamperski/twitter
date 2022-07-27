import {Client, auth} from 'twitter-api-sdk'
import { TwitterClient } from 'twitter-api-client'
import dotenv from "dotenv"
import fetch from "node-fetch";
dotenv.config()

// const client = new Client(BEARER)
// const authClient = new auth.OAuth2User({
//   client_id: process.env.API_KEY,
//   client_secret: process.env.API_KEY_SECRET,
//   callback: "http://127.0.0.1:3000/callback",
//   scopes: [""]
// })

const twitterClient = new TwitterClient({
  apiKey: process.env.API_KEY,
  apiSecret: process.env.API_KEY_SECRET,
  accessToken: process.env.OAUTH_TOKEN_GRAHAM,
  accessTokenSecret: process.env.OAUTH_TOKEN_GRAHAM_SECRET,
})

const headers = {
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${process.env.BEARER}`
}


const createSignature = async () => {



}

async function main() {

  twitterClient.directMessages.eventsList()
    .then(res => {
      console.log(res.events[0])
      const sender_id = res.events[0].sender_id
      const recipient_id = res.events[0].message_create.target.recipient_id
      twitterClient.accountsAndUsers.usersLookup({
        user_id: recipient_id
      })
        .then(res => console.log(JSON.stringify(res, null, 2)))
        .catch(err => console.log(err))
    })
    .catch(err => console.log(err))

}

main()
