import express from "express";
import cors from "cors"
import dotenv from "dotenv"
import { MongoClient } from "mongodb";

const app = express();
dotenv.config()
app.use(cors());
app.use(express.json())

const mongoClient = new MongoClient(process.env.MONGO_URI)

const promisse = await mongoClient.connect()

console.log(promisse)

app.listen(5000, () => { console.log("Server running in port: 5000") })