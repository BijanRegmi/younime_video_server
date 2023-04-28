import { createCipheriv, createDecipheriv } from "crypto"
import { JSDOM } from "jsdom"
const m3u8 = require("m3u8-parser")

interface Source {
    source: { file: string; label: string; type: string }[]
    source_bk: { file: string; label: string; type: string }[]
    track: { tracks: { file: string; kind: string }[] }
}

interface Playlist {
    attributes: {
        NAME: string
        RESOLUTION: { width: number; height: number }
        BANDWIDTH: number
        "PROGRAM-ID": number
    }
    uri: string
    timeline: number
}

const getKeys = async (serverUrl: URL) => {
    const c = await fetch(serverUrl, {
        headers: { Referer: "https://gogoanime.cl/" },
    }).then(_ => _.text())
    const document = new JSDOM(c).window.document

    const iv = document
        .querySelector("div.wrapper")
        ?.getAttribute("class")
        ?.split("-")[1]
    const secretKey = document
        .querySelector("body[class]")
        ?.getAttribute("class")
        ?.split("-")[1]
    const decryptionKey = document
        .querySelector("div.videocontent")
        ?.getAttribute("class")
        ?.split("-")[1]
    const data = document
        .querySelector("script[data-value]")
        ?.getAttribute("data-value")

    if (!iv || !secretKey || !decryptionKey || !data) throw "Insufficient data"

    return {
        iv: Buffer.from(iv, "utf8"),
        sKey: Buffer.from(secretKey, "utf8"),
        dKey: Buffer.from(decryptionKey, "utf8"),
        data,
    }
}

export async function videosFromUrl(baseUrl: string) {
    const basePage = await JSDOM.fromURL(baseUrl).then(c => c.window.document)
    const embeddedString = basePage
        .querySelector(".anime_muti_link>ul>li:nth-child(2)>a")
        ?.getAttribute("data-video")
        ?.slice(2)
    const embeddedURL = new URL(`http://${embeddedString}`)

    const id = embeddedURL.searchParams.get("id")
    if (!id) throw "Invalid embeddedUrl"

    const { iv, sKey, dKey, data } = await getKeys(embeddedURL)

    const decodedData = decrypt(data, sKey, iv)
    const queryPart = decodedData.slice(decodedData.indexOf("&") + 1)

    const host = "https://" + embeddedURL.host
    const eId = encrypt(id, sKey, iv)

    const params = new URLSearchParams(queryPart)
    const sourcesUrl =
        host +
        "/encrypt-ajax.php?id=" +
        encodeURIComponent(eId) +
        "&" +
        params.toString() +
        `&alias=${id}`

    const headers = new Headers()
    headers.set("X-Requested-With", "XMLHttpRequest")
    headers.set("Referer", embeddedURL.toString())

    const resp: { data: string } = await fetch(sourcesUrl, { headers }).then(
        res => res.json()
    )
    const sources_decrypted = decrypt(resp.data, dKey, iv)

    const sources: Source = JSON.parse(sources_decrypted)
    const hlsUrls = [
        ...sources.source.filter(s => s.type == "hls").map(s => s.file),
        ...sources.source_bk.filter(s => s.type == "hls").map(s => s.file),
    ]
    const response = await Promise.all(
        hlsUrls.map(async url => await getSources(url))
    )

    const link_expires = params.get("expires")
    const expire = link_expires
        ? parseInt(link_expires) - Math.round(new Date().getTime() / 1000)
        : 7200

    return { response, expire }
}

const getSources = async (m3u8Url: string) => {
    const parser = new m3u8.Parser()
    const manifest = await fetch(m3u8Url).then(r => r.text())
    parser.push(manifest)

    const host = m3u8Url.slice(0, m3u8Url.lastIndexOf("/"))

    const src: { url: string; name: string } = parser.manifest.playlists.map(
        (p: Playlist) => ({
            url: `${host}/${p.uri}`,
            name: p.attributes.NAME,
        })
    )

    return src
}

const encrypt = (str: string, key: Buffer, iv: Buffer) => {
    let cipher = createCipheriv("aes-256-cbc", key, iv)
    cipher.update(str, "utf8", "base64")
    return cipher.final("base64")
}

const decrypt = (str: string, key: Buffer, iv: Buffer) => {
    let decipher = createDecipheriv("aes-256-cbc", key, iv)
    let part1 = decipher.update(str, "base64", "utf8")
    return part1 + decipher.final("utf8")
}
