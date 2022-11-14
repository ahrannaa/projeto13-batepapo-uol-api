import express from "express";
import cors from "cors"
import dotenv from "dotenv"
import { MongoClient, ObjectId } from "mongodb";
import joi from "joi";
import dayjs from "dayjs";


const participantsSchema = joi.object({
    name: joi.string().required()
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
        const participant = await collectionParticipants.findOne({ name })

        if (participant != null) {
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

        const participant = await collectionParticipants.findOne({ name: message.from })

        if (participant == null) {
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

        const participant = await collectionParticipants.findOne({ name: user })

        if (participant == null) {
            res.sendStatus(404)
            return;
        }

        const filter = { name: participant.name }
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

app.delete("/messages/:id", async (req, res) => {
    const { user } = req.headers
    const { id } = req.params;

    try {
        const message = await collectionMessages.findOne({ _id: ObjectId(id) })
        if (message != null) {
            if (message.from === user) {
                await collectionMessages.deleteOne({ _id: ObjectId(id) })
                res.send("mensagem apagada com sucesso!")
            } else {
                res.status(401).send("Não autorizado!")
            }
        } else {
            res.status(404).send("Essa mensagem não existe")
        }

    } catch (err) {
        console.log(err)
        res.sendStatus(500)
    }
})

app.put("/messages/:id", async (req, res) => {
    const { id } = req.params;
    const messageToUpdate = {
        from: req.headers.user,
        to: req.body.to,
        text: req.body.text,
        type: req.body.type,
    }

    const validation = messagesSchema.validate(messageToUpdate, { abortEarly: false })

    try {
        if (validation.error) {
            const erros = validation.error.details.map((detail) =>
                detail.message)
            res.status(422).send(erros)
            return;
        }

        const participant = await collectionParticipants.findOne({ name: messageToUpdate.from })

        if (participant == null) {
            res.sendStatus(404)
            return;
        }

        const message = await collectionMessages.findOne({ _id: ObjectId(id) })

        const filter = { _id: ObjectId(id) }
        const updateDoc = { $set: messageToUpdate };

        if (message != null) {
            if (message.from === messageToUpdate.from) {
                await collectionMessages.updateOne(filter, updateDoc, { upsert: false })
                res.sendStatus(200)

            } else {
                res.status(401).send("Não autorizado!")
            }

        } else {
            res.status(404).send("Essa mensagem não existe")
        }

    } catch (err) {
        console.log(err)
        res.sendStatus(500)
    }
})

const removeParticipants = () => {
    setInterval(async () => {
        if (collectionParticipants != null) {
            try {
                const tenSecondsAgo = Date.now() - 10000;
                const participantsToDelete = await collectionParticipants.find({ lastStatus: { $lt: tenSecondsAgo } }).toArray()

                if (participantsToDelete.length > 0) {
                    const names = participantsToDelete.map((participant) => participant.name)
                    await collectionParticipants.deleteMany({ name: { $in: names } })

                    names.forEach(async (name) => {
                        const message = {
                            from: name,
                            to: 'Todos',
                            text: 'sai da sala...',
                            type: 'status',
                            time: (dayjs().format('hh:mm:ss'))
                        }
                        await collectionMessages.insertOne(message)
                    })
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