import { TwitterClient } from "twitter-api-client";
import dotenv from "dotenv";
import { runBot } from "./functions.js";
dotenv.config()

const tannerClient = new TwitterClient({
  apiKey: process.env.API_KEY_T,
  apiSecret: process.env.API_KEY_SECRET_T,
  accessToken: process.env.OAUTH_TOKEN_T,
  accessTokenSecret: process.env.OAUTH_TOKEN_SECRET_T,
});

const tannerScreenName = "TannerGesek";

await runBot(tannerClient, 'tanner', tannerScreenName, true, 'metajamasia')
