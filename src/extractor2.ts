import { createDecipheriv } from "crypto"

const EVP_BytesToKey = require("evp_bytestokey")
const m3u8 = require("m3u8-parser")

import { JSDOM } from "jsdom"

const getQualities = async (d_source: DecryptedSource) => {
    const parser = new m3u8.Parser()
    const manifest = await fetch(d_source.file).then(r => r.text())
    parser.push(manifest)

    const host = d_source.file.slice(0, d_source.file.lastIndexOf("/"))

    const response: VideoSource = {
        name: d_source.name,
        type: d_source.type,
        qualities: parser.manifest.playlists
            .sort((a: M3U8Playlist, b: M3U8Playlist) =>
                a.attributes.RESOLUTION.height < b.attributes.RESOLUTION.height
                    ? 1
                    : -1
            )
            .map((p: M3U8Playlist) => ({
                url: `${host}/${p.uri}`,
                name: `${p.attributes.RESOLUTION.height}p`,
            })),
    }

    return response
}

const getSources = async (sourceId: string) => {
    const sourceUrl = `https://rapid-cloud.co/ajax/embed-6/getSources?id=${sourceId}`

    const sources: ServerSourceResponse = await fetch(sourceUrl)
        .then(res => res.json())
        .catch(console.error)
    if (!sources) throw { custom: true, message: "Failed to get sources" }

    //////////////////////////////////////////////////////////////////////////////////

    let d_sources: DecryptedSource[] =
        typeof sources.sources == "string"
            ? await decipher<DecryptedSource[]>(sources.sources)
            : sources.sources

    let d_backups: DecryptedSource[] =
        typeof sources.sourcesBackup == "string"
            ? await decipher<DecryptedSource[]>(sources.sourcesBackup)
            : sources.sourcesBackup

    const response: AnimeResource = {
        source: await Promise.all(
            d_sources.map(async s => await getQualities(s))
        ),
        backupSource: await Promise.all(
            d_backups.map(async s => await getQualities(s))
        ),
        tracks: sources.tracks,
        intro: {
            start: sources.intro?.start || -1,
            end: sources.intro?.end || -1,
        },
        outro: {
            start: sources.outro?.start || -1,
            end: sources.outro?.end || -1,
        },
    }

    return response
}

const getSourceId = async (serverId: string) => {
    const epSourceUrl = `${process.env.SOURCES_URL}${serverId}`

    const embedResp: { link: string } | undefined = await fetch(epSourceUrl)
        .then(res => res.json())
        .catch(console.error)
    if (!embedResp) throw { custom: true, message: "Failed to get sources" }

    const _sourceUrl = new URL(embedResp.link).pathname.split("/")
    return _sourceUrl[_sourceUrl.length - 1]
}

const getServerIds = async (id: number) => {
    const serverUrl = `${process.env.SERVERS_URL}${id}`

    const serverResp: { status: Boolean; html: string } | undefined =
        await fetch(serverUrl)
            .then(res => res.json())
            .catch(console.error)
    if (!serverResp) throw { custom: true, message: "Failed to get servers" }

    //////////////////////////////////////////////////////////////////////////////////

    const dom = new JSDOM(serverResp.html).window.document
    const subServers = Array.from(
        dom.querySelectorAll(".servers-sub .server-item")
    ).map(s => s?.getAttribute("data-id"))
    const dubServers = Array.from(
        dom.querySelectorAll(".servers-dub .server-item")
    ).map(s => s?.getAttribute("data-id"))

    return { sub: subServers[0], dub: dubServers[0] }
}

export const VideoFromEpId = async (id: number) => {
    const serverIds = await getServerIds(id)

    return {
        sub: serverIds.sub
            ? await getSources(await getSourceId(serverIds.sub))
            : undefined,
        dub: serverIds.dub
            ? await getSources(await getSourceId(serverIds.dub))
            : undefined,
    }
}

const decipher = async <T>(str: string) => {
    const password = await fetch(process.env.PASSWORD_URL as string).then(res =>
        res.text()
    )
    const sources = Buffer.from(str, "base64")

    const salt = sources.subarray(8, 16)
    const ciphered = sources.subarray(16, sources.length)

    const result = EVP_BytesToKey(password, salt, 32 * 8, 16)
    let decipher = createDecipheriv("aes-256-cbc", result.key, result.iv)
    const decoded = Buffer.concat([decipher.update(ciphered), decipher.final()])
    const json: T = JSON.parse(decoded.toString("utf8")) as T
    return json
}
