import { createClient } from "redis"

export const redisClient = createClient({
    username: `${process.env.REDISUSER}`,
    password: `${process.env.REDISPASSWORD}`,
    socket: {
        host: `${process.env.REDISHOST}`,
        port: Number(process.env.REDISPORT) || 6379,
    },
})
