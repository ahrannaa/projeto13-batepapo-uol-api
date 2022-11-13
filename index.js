import express from "express";
import cors from "cors"
import dotenv from "dotenv"
import { MongoClient } from "mongodb";

const app = express();
dotenv.config()
app.use(cors());
app.use(express.json())

const mongoClient = new MongoClient(process.env.MONGO_URI)

// Tentando se conectar com o banco e tratar possiveis erros de conexão com try/catch.
try {
    await mongoClient.connect()
    console.log("MongoDB Conectado")
} catch (err) {
    console.log(err)
}
const db = mongoClient.db("dados"); // Criando o banco de dados e se ele já existir, entrando nele.
const collectionParticipants = db.collection("participants")//const global para criar e/ou entrar em uma coleção
const collectionMessages = db.collection("messages")//const global para criar e/ou entrar em uma coleção


app.post("/participants", async (req, res) => {
    const { name } = req.body

    if (!name) {
        res.sendStatus(422)
        return;
    }

    const message = {
        from: req.body.name,
        to: 'Todos',
        text: 'entra na sala...',
        type: 'status',
        time: 'HH:MM:SS'
    }

    try {
        await collectionParticipants.insertOne({ name, lastStatus: Date.now() })
        await collectionMessages.insertOne(message)
        res.sendStatus(201)
    } catch (err) {
        console.log(err)
        res.sendStatus(500)
    }
    return;
})

app.get("/participants", async (req, res) => {

    try {
        const participants = await collectionParticipants.find().toArray()
        res.send(participants)
    } catch (err) {
        console.log(err)
        res.sendStatus(500)
    }

})



app.listen(5000, () => { console.log("Server running in port: 5000") })