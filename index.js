import express from "express";
import cors from "cors"
import dotenv from "dotenv"
import { MongoClient } from "mongodb";
import joi from "joi";
import dayjs from "dayjs";


const participantsSchema = joi.object({
    name: joi.string().required().min(3)
})

const messagesSchema = joi.object({
    from: joi.string().required(),
    to: joi.string().required(),
    text: joi.string().required(),
    type: joi.string().valid("message", "private_message").required()

})

const app = express();
dotenv.config()
app.use(cors());
app.use(express.json())

const mongoClient = new MongoClient(process.env.MONGO_URI)

try {
    await mongoClient.connect()
    console.log("MongoDB Conectado")
} catch (err) {
    console.log(err)
}
const db = mongoClient.db("dados");
const collectionParticipants = db.collection("participants")
const collectionMessages = db.collection("messages")


app.post("/participants", async (req, res) => {
    const { name } = req.body

    const validation = participantsSchema.validate({ name }, { abortEarly: false })

    if (validation.error) {
        const erros = validation.error.details
            .map((detail) => detail.message)

        res.status(422).send(erros)
        return;
    }

    try {
        const participante = await collectionParticipants.findOne({ name })
        console.log(participante)

        if (participante != null) {
            res.status(409).send("nome do participante já existe")
            return;
        }


        const message = {
            from: req.body.name,
            to: 'Todos',
            text: 'entra na sala...',
            type: 'status',
            time: (dayjs().format('hh:mm:ss'))
        }


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

app.post("/messages", async (req, res) => {
    const message = {
        from: req.headers.user,
        to: req.body.to,
        text: req.body.text,
        type: req.body.type,
    }

    const validation = messagesSchema.validate(message, { abortEarly: false })

    if (validation.error) {
        const erros = validation.error.details.map((detail) =>
            detail.message)
        res.status(422).send(erros)
        return;
    }

    try {

        const participante = await collectionParticipants.findOne({ name: message.from })

        if (participante == null) {
            res.status(422).send("Faça o seu cadastro!")
            return;
        }

        await collectionMessages.insertOne({ ...message, time: dayjs().format('hh:mm:ss') })
        res.sendStatus(201)
    } catch (err) {
        console.log(err)
        res.sendStatus(500)
    }

})

app.get("/messages", async (req, res) => {
    const { user } = req.headers
    const limit = req.query.limit ? parseInt(req.query.limit) : 0

    try {
        const messages = await collectionMessages.find({ $or: [{ from: user }, { to: user }, { to: "Todos" }, { type: "message" }] })
            .sort({ _id: -1 }).limit(limit).toArray()
        res.send(messages)
    } catch (err) {
        console.log(err)
        res.sendStatus(500)
    }

})

app.post("/status", async (req, res) => {
    const { user } = req.headers

    try {

        const participante = await collectionParticipants.findOne({ name: user })

        if (participante == null) {
            res.sendStatus(404)
            return;
        }

        const filter = { name: participante.name }
        const updateDoc = {
            $set: {
                lastStatus: Date.now()
            },
        };

        await collectionParticipants.updateOne(filter, updateDoc, { upsert: false })
        res.sendStatus(200)
    } catch (err) {
        console.log(err)
        res.sendStatus(500)
    }


})

const removeParticipants = () => {
    setInterval(async () => {
        if (collectionParticipants != null) {
            try {
               const oneMinuteAgo = Date.now() - 1000;
               const result = await collectionParticipants.deleteMany({ lastStatus: { $lt: oneMinuteAgo }})

               if (result.deletedCount > 0) {
                console.log(`Deletei ${result.deletedCount} participantes`)
               }
            } catch (err) {
                console.log(err)
           }
        }
    }, 15000)
}

app.listen(5000, () => {
    removeParticipants()
    console.log("Server running in port: 5000")
})