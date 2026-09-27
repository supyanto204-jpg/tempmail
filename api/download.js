// ==============================================================================
// api/download.js — Universal Video + Audio Downloader
// Support: TikTok, YouTube, Instagram, X/Twitter, Reddit, Facebook, +1000 situs
// ==============================================================================
const axios = require('axios');

// ==============================================================================
// HTTP CLIENT
// ==============================================================================
const httpClient = axios.create({
    timeout: 12000,
    headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json, text/plain, */*',
        'Accept-Language': 'en-US,en;q=0.9'
    }
});

// ==============================================================================
// MAIN HANDLER
// ==============================================================================
module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') return res.status(200).end();

    try {
        const { url } = req.query;
        if (!url) return res.status(400).json({ error: 'URL required' });

        const platform = detectPlatform(url);
        console.log(`[DL] ${platform} → ${url}`);

        let result = null;
        let lastError = null;

        // Coba platform-specific handler dulu
        try {
            if (platform === 'tiktok') result = await videoTikTok(url);
            else if (platform === 'youtube') result = await videoYouTube(url);
            else if (platform === 'reddit') result = await videoReddit(url);
            else if (platform === 'instagram') result = await videoInstagram(url);
            else if (platform === 'twitter') result = await videoTwitter(url);
            else if (platform === 'facebook') result = await videoFacebook(url);
        } catch (e) {
            console.log('Primary handler gagal:', e.message);
            lastError = e;
        }

        // Fallback ke cobalt universal
        if (!result) {
            try {
                result = await videoCobalt(url);
            } catch (e) {
                console.log('Cobalt fallback gagal:', e.message);
                lastError = e;
            }
        }

        if (!result || !result.links || result.links.length === 0) {
            throw lastError || new Error('Gagal download. Coba URL lain.');
        }

        res.json(result);

    } catch (err) {
        console.error('[DL ERROR]', err.message);
        res.status(500).json({
            error: err.response?.data?.message || err.message
        });
    }
};

// ==============================================================================
// DETECT PLATFORM
// ==============================================================================
function detectPlatform(url) {
    if (/tiktok\.com|vt\.tiktok|vm\.tiktok/i.test(url)) return 'tiktok';
    if (/youtube\.com|youtu\.be/i.test(url)) return 'youtube';
    if (/instagram\.com/i.test(url)) return 'instagram';
    if (/twitter\.com|x\.com/i.test(url)) return 'twitter';
    if (/reddit\.com|redd\.it/i.test(url)) return 'reddit';
    if (/facebook\.com|fb\.watch/i.test(url)) return 'facebook';
    return 'unknown';
}

// ==============================================================================
// TIKTOK — video + audio
// ==============================================================================
async function videoTikTok(url) {
    const api = `https://www.tikwm.com/api/?url=${encodeURIComponent(url)}&hd=1`;
    const r = await httpClient.get(api);
    const data = r.data;

    if (!data || data.code !== 0 || !data.data) {
        throw new Error(data?.msg || 'Gagal ambil TikTok');
    }

    const d = data.data;
    const links = [];

    if (d.hdplay) links.push({ label: 'Video HD (No Watermark)', url: d.hdplay, type: 'MP4' });
    if (d.play && d.play !== d.hdplay) links.push({ label: 'Video SD', url: d.play, type: 'MP4' });
    if (d.wmplay) links.push({ label: 'Video (Watermark)', url: d.wmplay, type: 'MP4' });
    if (d.music) links.push({ label: 'Audio Only', url: d.music, type: 'MP3' });

    return {
        title: d.title || 'TikTok Video',
        author: d.author?.nickname ? '@' + d.author.nickname : '',
        thumbnail: d.cover || d.origin_cover || '',
        duration: d.duration ? d.duration + 's' : '',
        video: d.hdplay || d.play || '',
        audio: d.music || '',
        links: links
    };
}

// ==============================================================================
// YOUTUBE — video + audio via cobalt
// ==============================================================================
async function videoYouTube(url) {
    const instances = [
        { url: 'https://co.wuk.sh/api/json', body: { url, vQuality: '720', isAudioOnly: false, aFormat: 'mp3' } },
        { url: 'https://api.cobalt.tools/api/json', body: { url, vQuality: '720', isAudioOnly: false, aFormat: 'mp3' } },
        { url: 'https://cobalt-api.kwiatekmiki.com/', body: { url, videoQuality: '720' } }
    ];

    for (const inst of instances) {
        try {
            console.log(`YouTube via ${inst.url}`);
            const r = await httpClient.post(inst.url, inst.body, {
                headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' }
            });
            const data = r.data;

            if (data.status === 'stream' || data.status === 'redirect') {
                return {
                    title: data.filename || 'YouTube Video',
                    links: [{ label: 'Video (MP4)', url: data.url, type: 'MP4' }]
                };
            }

            if (data.status === 'picker' && Array.isArray(data.picker)) {
                const links = data.picker.map(p => ({
                    label: p.type || 'Download',
                    url: p.url,
                    type: (p.type || '').toUpperCase()
                }));
                return { title: 'YouTube Video', links };
            }

            if (data.url) {
                return {
                    title: 'YouTube Video',
                    links: [{ label: 'Video (MP4)', url: data.url, type: 'MP4' }]
                };
            }
        } catch (e) {
            console.log(`Cobalt ${inst.url} gagal:`, e.message);
        }
    }
    throw new Error('Semua server YouTube gagal');
}

// ==============================================================================
// INSTAGRAM — via cobalt
// ==============================================================================
async function videoInstagram(url) {
    // Coba douyin.wtf dulu
    try {
        const api = `https://api.douyin.wtf/api/hybrid/video_data?url=${encodeURIComponent(url)}&minimal=true`;
        const r = await httpClient.get(api);
        if (r.data && r.data.data && r.data.data.url) {
            const d = r.data.data;
            return {
                title: d.desc || 'Instagram Media',
                author: d.author?.nickname || '',
                thumbnail: d.cover || '',
                links: [{ label: 'Video (MP4)', url: d.url, type: 'MP4' }]
            };
        }
    } catch (e) {
        console.log('IG douyin.wtf gagal:', e.message);
    }

    // Fallback cobalt
    return await videoCobalt(url);
}

// ==============================================================================
// TWITTER / X — via cobalt
// ==============================================================================
async function videoTwitter(url) {
    return await videoCobalt(url);
}

// ==============================================================================
// REDDIT — video direct
// ==============================================================================
async function videoReddit(url) {
    try {
        const jsonUrl = url.replace(/\/$/, '') + '.json';
        const r = await httpClient.get(jsonUrl, {
            headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Bot/1.0)' }
        });

        const post = r.data[0]?.data?.children?.[0]?.data;
        if (post) {
            if (post.is_video && post.media?.reddit_video?.fallback_url) {
                return {
                    title: post.title || 'Reddit Video',
                    author: post.author ? 'u/' + post.author : '',
                    thumbnail: post.thumbnail || '',
                    links: [{ label: 'Video (MP4)', url: post.media.reddit_video.fallback_url, type: 'MP4' }]
                };
            }

            if (post.url && /\.(mp4|webm)$/i.test(post.url)) {
                return {
                    title: post.title || 'Reddit Video',
                    author: post.author ? 'u/' + post.author : '',
                    thumbnail: post.thumbnail || '',
                    links: [{ label: 'Video', url: post.url, type: 'MP4' }]
                };
            }
        }
    } catch (e) {
        console.log('Reddit gagal:', e.message);
    }

    throw new Error('Reddit video gak tersedia');
}

// ==============================================================================
// FACEBOOK — via cobalt
// ==============================================================================
async function videoFacebook(url) {
    return await videoCobalt(url);
}

// ==============================================================================
// COBALT UNIVERSAL — fallback semua platform
// ==============================================================================
async function videoCobalt(url) {
    const instances = [
        { url: 'https://co.wuk.sh/api/json', body: { url, isAudioOnly: false, vQuality: '720' } },
        { url: 'https://api.cobalt.tools/api/json', body: { url, isAudioOnly: false } },
        { url: 'https://cobalt-api.kwiatekmiki.com/', body: { url } }
    ];

    for (const inst of instances) {
        try {
            console.log(`Cobalt via ${inst.url}`);
            const r = await httpClient.post(inst.url, inst.body, {
                headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' }
            });
            const data = r.data;

            if (data.status === 'stream' || data.status === 'redirect') {
                return {
                    title: data.filename || 'Media',
                    links: [{ label: 'Video (MP4)', url: data.url, type: 'MP4' }]
                };
            }

            if (data.status === 'picker' && Array.isArray(data.picker)) {
                const links = data.picker.map(p => ({
                    label: p.type || 'Download',
                    url: p.url,
                    type: (p.type || '').toUpperCase()
                }));
                return { title: 'Media', links };
            }

            if (data.url) {
                return {
                    title: 'Media',
                    links: [{ label: 'Video (MP4)', url: data.url, type: 'MP4' }]
                };
            }
        } catch (e) {
            console.log(`Cobalt ${inst.url} gagal:`, e.message);
        }
    }

    throw new Error('Semua server gagal');
}
