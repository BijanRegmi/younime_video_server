import express from "express"
import { videosFromUrl } from "./extractor"
import { config } from "dotenv"
import { redisClient } from "./redis"

config()

const app = express()
const port = 3000

app.get("/:id", async (req, res) => {
    const id = req.params.id

    const cachedResp = await redisClient.get(id)
    if (cachedResp) return res.json(JSON.parse(cachedResp))

    const url = `${process.env.SOURCE_BASE}/${id}`

    const { response, expire } = await videosFromUrl(url)

    await redisClient.set(id, JSON.stringify(response), {
        EX: expire,
    })

    return res.json(response)
})

app.listen(port, async () => {
    await redisClient.connect().then(() => console.log("Redis connected"))
    console.log(`[Server]: I am running at https://localhost:${port}`)
})
