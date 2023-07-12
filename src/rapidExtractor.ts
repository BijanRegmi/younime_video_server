import { createDecipheriv } from "crypto"
import { emptyAnimResource } from "./extractor2"

const EVP_BytesToKey = require("evp_bytestokey")
const m3u8 = require("m3u8-parser")

export class RapidExtractor {
    embedUrl: URL | undefined
    key: string = ""

    async init(url?: string) {
        this.key = (await this._getdecryptKey()) || ""
        if (url) this.embedUrl = new URL(url)
        return this
    }

    loadUrl(url: string) {
        this.embedUrl = new URL(url)
        return this
    }

    async extract(): Promise<AnimeResource> {
        if (!this.key || !this.embedUrl) return emptyAnimResource

        const origin = this.embedUrl.origin
        const id = this.embedUrl.pathname.split("/").pop()
        const jsonLink = `${origin}/ajax/embed-6/getSources?id=${id}`
        console.log(`==> Extracting m3u8 url: ${jsonLink}`)
        const response = await fetch(jsonLink)
            .then(res => res.json() as ServerSourceResponse)
            .catch(console.error)

        if (!response) return emptyAnimResource

        let decryptedSources: DecryptedSource[]

        if (
            (response.encrypted || typeof response.sources == "string") &&
            response.sources
        ) {
            decryptedSources = JSON.parse(
                await this.decipher(response.sources as string, this.key)
            )
        } else if (!response.sources) {
            decryptedSources = []
        } else {
            decryptedSources = response.sources as DecryptedSource[]
        }

        const retval: AnimeResource = {
            source:
                decryptedSources == undefined
                    ? []
                    : await Promise.all(decryptedSources.map(this.m3u8ToVideo)),
            tracks:
                decryptedSources == undefined
                    ? []
                    : response.tracks?.map(t => ({
                          src: t.file,
                          kind: t.kind || "captions",
                          srcLang: t.label,
                          label: t.label,
                          default: t.default,
                      })) || [],
            intro: {
                start: response.intro?.start || -1,
                end: response.intro?.end || -1,
            },
            outro: {
                start: response.outro?.start || -1,
                end: response.intro?.end || -1,
            },
        }
        return retval
    }

    async m3u8ToVideo(source: DecryptedSource) {
        const parser = new m3u8.Parser()
        const manifest = await fetch(source.file).then(r => r.text())
        parser.push(manifest)

        const host = source.file.slice(0, source.file.lastIndexOf("/"))

        const response: VideoSource = {
            name: source.name,
            type: source.type,
            qualities: parser.manifest.playlists
                .sort((a: M3U8Playlist, b: M3U8Playlist) =>
                    a.attributes.RESOLUTION.height <
                    b.attributes.RESOLUTION.height
                        ? -1
                        : 1
                )
                .map((p: M3U8Playlist) => ({
                    url: `${host}/${p.uri}`,
                    name: `${p.attributes.RESOLUTION.height}p`,
                })),
        }

        return response
    }

    async decipher(input: string, key: string) {
        const sources = Buffer.from(input, "base64")

        const salt = sources.subarray(8, 16)
        const ciphered = sources.subarray(16, sources.length)

        const result = EVP_BytesToKey(key, salt, 32 * 8, 16)
        const decipher = createDecipheriv("aes-256-cbc", result.key, result.iv)

        const decoded = Buffer.concat([
            decipher.update(ciphered),
            decipher.final(),
        ])

        return decoded.toString("utf8")
    }

    async _getdecryptKey() {
        return await fetch(process.env.KEY_URL as string)
            .then(res => res.text())
            .catch(console.error)
    }
}
