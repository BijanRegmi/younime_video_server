import express from "express"
import { videosFromUrl } from "./extractor"
import { config } from "dotenv"
import { redisClient } from "./redis"
import { VideoFromEpId } from "./extractor2"

config()

const app = express()
const port = 5891

app.use((req, _res, next) => {
    console.log(`==> ${req.method} ${req.originalUrl}`)
    next()
})

app.get("/e1", async (req, res) => {
    const id = req.query.id?.toString()
    if (!id) return res.json([])

    const cachedResp = await redisClient.get(id)
    if (cachedResp) return res.json(JSON.parse(cachedResp))

    const url = `${process.env.SOURCE_BASE}/${id}`

    await videosFromUrl(url)
        .then(({ response, expire }) => {
            redisClient.set(id, JSON.stringify(response), {
                EX: expire,
            })

            return res.json(response)
        })
        .catch(err => {
            console.error(err)
            return res.status(400).json({ message: err })
        })
})

app.get("/e2", async (req, res) => {
    const id = req.query.id?.toString()
    if (!id) return res.json([])

    const cachedResp = await redisClient.get(id)
    if (cachedResp) return res.json(JSON.parse(cachedResp))

    await VideoFromEpId(Number(id))
        .then(response => {
            redisClient.set(id, JSON.stringify(response), {
                EX: 14000,
            })

            return res.json(response)
        })
        .catch(err => {
            console.error(err)
            if (err.custom)
                return res.status(400).json({ message: err.message })
            else
                return res.status(500).json({ message: "Something went wrong" })
        })
})

app.listen(port, async () => {
    await redisClient
        .connect()
        .then(() => console.log("==> Redis server connected"))
    console.log(`==> Server Running at port ${port}`)
})
