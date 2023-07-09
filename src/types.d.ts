interface Quality {
    url: string
    name: string
}

interface VideoSource {
    name: string
    type: string
    qualities: Quality[]
}

interface AnimeResource {
    source: VideoSource[]
    backupSource?: VideoSource[]
    tracks: Track[]
    intro: { start: number; end: number }
    outro: { start: number; end: number }
}

interface M3U8Playlist {
    attributes: {
        NAME: string
        RESOLUTION: { width: number; height: number }
        BANDWIDTH: number
        "PROGRAM-ID": number
    }
    uri: string
    timeline: number
}

///////////////////////////////////////////////////////////

type EncryptedSource = string
type DecryptedSource = { file: string; type: string; name: string }
type Track = {
    src: string
    label: string
    kind: string
    srcLang: string
    default?: boolean
}

interface ServerSourceResponse {
    sources?: EncryptedSource | DecryptedSource[]
    sourcesBackup?: EncryptedSource | DecryptedSource[]
    tracks?: { file: string; label: string; kind: string; default?: boolean }[]
    encrypted?: Boolean
    intro?: { start: number; end: number }
    outro?: { start: number; end: number }
    server?: number
}
