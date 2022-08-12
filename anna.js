import {TwitterClient} from "twitter-api-client";
import dotenv from "dotenv";
import { runBot } from "./functions.js";
dotenv.config()


const annaClient = new TwitterClient({
  apiKey: process.env.API_KEY_A,
  apiSecret: process.env.API_KEY_SECRET_A,
  accessToken: process.env.OAUTH_TOKEN_A,
  accessTokenSecret: process.env.OAUTH_TOKEN_SECRET_A
})

const annaScreenName = "abryant240";

await runBot(annaClient, 'anna', annaScreenName, true, 'BoysClubCrypto')
