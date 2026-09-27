// ==============================================================================
// api/download.js — Universal File Downloader
// Support: Video, Photo, Audio, APK, Document, File (any URL)
// ==============================================================================
const axios = require('axios');
const path = require('path');

// ==============================================================================
// HTTP CLIENT
// ==============================================================================
const httpClient = axios.create({
    timeout: 15000,
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

        // Platform-specific handler
        const handlers = {
            tiktok: [videoTikTok, videoCobalt],
            youtube: [videoYouTube, videoCobalt],
            instagram: [videoInstagram, videoCobalt],
            twitter: [videoTwitter, videoCobalt],
            reddit: [videoReddit, videoCobalt],
            facebook: [videoFacebook, videoCobalt],
            pinterest: [imagePinterest, videoCobalt],
            spotify: [audioSpotify, videoCobalt],
            soundcloud: [audioSoundCloud, videoCobalt],
            apk: [directDownload],
            github: [directDownload],
            direct: [directDownload]
        };

        const list = handlers[platform] || [directDownload, videoCobalt];

        for (const fn of list) {
            try {
                console.log(`Coba ${fn.name}...`);
                result = await fn(url);
                if (result && result.links && result.links.length > 0) {
                    console.log(`✅ ${fn.name} berhasil`);
                    break;
                }
                result = null;
            } catch (e) {
                console.log(`❌ ${fn.name} gagal:`, e.message);
            }
        }

        if (!result || !result.links || result.links.length === 0) {
            throw new Error('Gak bisa download dari URL ini. Pastikan link valid.');
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
// DETECT PLATFORM / FILE TYPE
// ==============================================================================
function detectPlatform(url) {
    const lower = url.toLowerCase();

    // Direct file extensions
    if (/\.apk(\?|$)/i.test(lower)) return 'apk';
    if (/\.(jpg|jpeg|png|gif|webp|bmp|svg|ico)(\?|$)/i.test(lower)) return 'direct';
    if (/\.(mp3|wav|flac|m4a|aac|ogg|opus)(\?|$)/i.test(lower)) return 'direct';
    if (/\.(mp4|mkv|webm|mov|avi|flv|wmv|m4v)(\?|$)/i.test(lower)) return 'direct';
    if (/\.(pdf|doc|docx|xls|xlsx|ppt|pptx|txt|zip|rar|7z|tar|gz)(\?|$)/i.test(lower)) return 'direct';

    // Platforms
    if (/tiktok\.com|vt\.tiktok|vm\.tiktok/i.test(lower)) return 'tiktok';
    if (/youtube\.com|youtu\.be/i.test(lower)) return 'youtube';
    if (/instagram\.com/i.test(lower)) return 'instagram';
    if (/twitter\.com|x\.com/i.test(lower)) return 'twitter';
    if (/reddit\.com|redd\.it/i.test(lower)) return 'reddit';
    if (/facebook\.com|fb\.watch/i.test(lower)) return 'facebook';
    if (/pinterest\.com|pin\.it/i.test(lower)) return 'pinterest';
    if (/spotify\.com/i.test(lower)) return 'spotify';
    if (/soundcloud\.com/i.test(lower)) return 'soundcloud';
    if (/github\.com|githubusercontent/i.test(lower)) return 'github';

    return 'direct';
}

// ==============================================================================
// DIRECT DOWNLOAD — any URL
// ==============================================================================
async function directDownload(url) {
    console.log('Direct download:', url);

    // HEAD request dulu buat cek tipe
    let contentType = '';
    let contentLength = 0;
    let filename = '';

    try {
        const head = await httpClient.head(url, {
            maxRedirects: 5,
            validateStatus: function(s) { return s < 400; }
        });

        contentType = head.headers['content-type'] || '';
        contentLength = parseInt(head.headers['content-length'] || '0');
        filename = extractFilename(url, head.headers['content-disposition']);
    } catch (e) {
        console.log('HEAD gagal, coba GET:', e.message);
        // Fallback: GET head kecil
        try {
            const get = await httpClient.get(url, {
                responseType: 'stream',
                maxRedirects: 5
            });
            contentType = get.headers['content-type'] || '';
            contentLength = parseInt(get.headers['content-length'] || '0');
            filename = extractFilename(url, get.headers['content-disposition']);
            if (get.data && get.data.destroy) get.data.destroy();
        } catch (e2) {
            throw new Error('URL gak bisa diakses: ' + e2.message);
        }
    }

    // Tentukan tipe
    let type = 'FILE';
    let label = 'Download';

    if (contentType.includes('video/')) {
        type = 'MP4';
        label = 'Video';
    } else if (contentType.includes('image/')) {
        type = 'IMG';
        label = 'Gambar';
    } else if (contentType.includes('audio/')) {
        type = 'MP3';
        label = 'Audio';
    } else if (contentType.includes('application/pdf')) {
        type = 'PDF';
        label = 'PDF Document';
    } else if (contentType.includes('application/zip')) {
        type = 'ZIP';
        label = 'ZIP Archive';
    } else if (contentType.includes('application/vnd.android.package-archive')) {
        type = 'APK';
        label = 'Android APK';
    } else if (/\.apk(\?|$)/i.test(url)) {
        type = 'APK';
        label = 'Android APK';
    } else if (/\.(mp4|mkv|webm|mov)(\?|$)/i.test(url)) {
        type = 'MP4';
        label = 'Video';
    } else if (/\.(jpg|jpeg|png|gif|webp)(\?|$)/i.test(url)) {
        type = 'IMG';
        label = 'Gambar';
    } else if (/\.(mp3|wav|m4a|flac)(\?|$)/i.test(url)) {
        type = 'MP3';
        label = 'Audio';
    } else if (/\.(pdf)(\?|$)/i.test(url)) {
        type = 'PDF';
        label = 'PDF';
    } else if (/\.(zip|rar|7z)(\?|$)/i.test(url)) {
        type = 'ZIP';
        label = 'Archive';
    }

    return {
        title: filename || 'File',
        author: formatBytes(contentLength),
        links: [
            {
                label: label,
                url: url,
                type: type,
                filename: filename,
                size: contentLength,
                sizeFormatted: formatBytes(contentLength)
            }
        ]
    };
}

// ==============================================================================
// TIKTOK
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

    // Slideshow photos
    if (d.images && Array.isArray(d.images)) {
        d.images.forEach(function(img, i) {
            links.push({ label: `Foto ${i + 1}`, url: img, type: 'IMG' });
        });
    }

    return {
        title: d.title || 'TikTok Media',
        author: d.author?.nickname ? '@' + d.author.nickname : '',
        thumbnail: d.cover || d.origin_cover || '',
        duration: d.duration ? d.duration + 's' : '',
        links: links
    };
}

// ==============================================================================
// YOUTUBE
// ==============================================================================
async function videoYouTube(url) {
    const instances = [
        { url: 'https://co.wuk.sh/api/json', body: { url, vQuality: '720', isAudioOnly: false, aFormat: 'mp3' } },
        { url: 'https://api.cobalt.tools/api/json', body: { url, vQuality: '720', isAudioOnly: false, aFormat: 'mp3' } },
        { url: 'https://cobalt-api.kwiatekmiki.com/', body: { url, videoQuality: '720' } }
    ];

    for (const inst of instances) {
        try {
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
                return {
                    title: 'YouTube Media',
                    links: data.picker.map(function(p) {
                        return { label: p.type || 'Download', url: p.url, type: (p.type || '').toUpperCase() };
                    })
                };
            }
            if (data.url) {
                return { title: 'YouTube Video', links: [{ label: 'Video (MP4)', url: data.url, type: 'MP4' }] };
            }
        } catch (e) {
            console.log(`Cobalt ${inst.url} gagal:`, e.message);
        }
    }
    throw new Error('Semua server YouTube gagal');
}

// ==============================================================================
// INSTAGRAM
// ==============================================================================
async function videoInstagram(url) {
    try {
        const api = `https://api.douyin.wtf/api/hybrid/video_data?url=${encodeURIComponent(url)}&minimal=true`;
        const r = await httpClient.get(api);
        if (r.data && r.data.data) {
            const d = r.data.data;
            const links = [];
            if (d.url) links.push({ label: 'Video (MP4)', url: d.url, type: 'MP4' });
            if (d.images && Array.isArray(d.images)) {
                d.images.forEach(function(img, i) {
                    links.push({ label: `Foto ${i + 1}`, url: img, type: 'IMG' });
                });
            }
            if (links.length > 0) {
                return {
                    title: d.desc || 'Instagram Media',
                    author: d.author?.nickname || '',
                    thumbnail: d.cover || '',
                    links: links
                };
            }
        }
    } catch (e) {
        console.log('IG gagal:', e.message);
    }
    return await videoCobalt(url);
}

// ==============================================================================
// TWITTER
// ==============================================================================
async function videoTwitter(url) {
    return await videoCobalt(url);
}

// ==============================================================================
// REDDIT
// ==============================================================================
async function videoReddit(url) {
    const jsonUrl = url.replace(/\/$/, '') + '.json';
    const r = await httpClient.get(jsonUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Bot/1.0)' }
    });

    const post = r.data[0]?.data?.children?.[0]?.data;
    if (!post) throw new Error('Reddit post gak ketemu');

    const links = [];

    if (post.is_video && post.media?.reddit_video?.fallback_url) {
        links.push({ label: 'Video (MP4)', url: post.media.reddit_video.fallback_url, type: 'MP4' });
    }
    if (post.url && /\.(mp4|webm)$/i.test(post.url)) {
        links.push({ label: 'Video', url: post.url, type: 'MP4' });
    }
    if (post.url && /\.(jpg|jpeg|png|gif|webp)$/i.test(post.url)) {
        links.push({ label: 'Gambar', url: post.url, type: 'IMG' });
    }
    if (post.gallery_data && post.media_metadata) {
        const items = post.gallery_data.items || [];
        items.forEach(function(item, i) {
            const media = post.media_metadata[item.media_id];
            if (media?.s?.u) {
                const imgUrl = media.s.u.replace(/&amp;/g, '&');
                links.push({ label: `Foto ${i + 1}`, url: imgUrl, type: 'IMG' });
            }
        });
    }

    if (links.length === 0) throw new Error('Reddit media gak tersedia');

    return {
        title: post.title || 'Reddit Media',
        author: post.author ? 'u/' + post.author : '',
        thumbnail: post.thumbnail || '',
        links: links
    };
}

// ==============================================================================
// FACEBOOK
// ==============================================================================
async function videoFacebook(url) {
    return await videoCobalt(url);
}

// ==============================================================================
// PINTEREST
// ==============================================================================
async function imagePinterest(url) {
    let finalUrl = url;
    if (/pin\.it/i.test(url)) {
        try {
            const r = await httpClient.get(url, { maxRedirects: 5 });
            finalUrl = r.request?.res?.responseUrl || url;
        } catch (e) {}
    }

    const r = await httpClient.get(finalUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)' }
    });

    const html = r.data;
    const ogImage = html.match(/<meta[^>]*property="og:image"[^>]*content="([^"]+)"/i);
    const ogVideo = html.match(/<meta[^>]*property="og:video"[^>]*content="([^"]+)"/i);
    const title = html.match(/<meta[^>]*property="og:title"[^>]*content="([^"]+)"/i);

    const links = [];
    if (ogVideo) links.push({ label: 'Video', url: ogVideo[1], type: 'MP4' });
    if (ogImage) links.push({ label: 'Gambar HD', url: ogImage[1], type: 'IMG' });

    if (links.length === 0) throw new Error('Pinterest media gak ketemu');

    return {
        title: title ? title[1] : 'Pinterest Media',
        thumbnail: ogImage ? ogImage[1] : '',
        links: links
    };
}

// ==============================================================================
// SPOTIFY (metadata only — buat full track butuh premium)
// ==============================================================================
async function audioSpotify(url) {
    // Spotify gak bisa didownload tanpa premium, skip ke cobalt
    return await videoCobalt(url);
}

// ==============================================================================
// SOUNDCLOUD
// ==============================================================================
async function audioSoundCloud(url) {
    return await videoCobalt(url);
}

// ==============================================================================
// COBALT UNIVERSAL — fallback
// ==============================================================================
async function videoCobalt(url) {
    const instances = [
        { url: 'https://co.wuk.sh/api/json', body: { url, isAudioOnly: false, vQuality: '720' } },
        { url: 'https://api.cobalt.tools/api/json', body: { url, isAudioOnly: false } },
        { url: 'https://cobalt-api.kwiatekmiki.com/', body: { url } },
        { url: 'https://cobalt-api.ayo.tf/', body: { url } }
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
                return {
                    title: 'Media',
                    links: data.picker.map(function(p) {
                        return { label: p.type || 'Download', url: p.url, type: (p.type || '').toUpperCase() };
                    })
                };
            }
            if (data.url) {
                return {
                    title: 'Media',
                    links: [{ label: 'Download', url: data.url, type: 'FILE' }]
                };
            }
        } catch (e) {
            console.log(`Cobalt ${inst.url} gagal:`, e.message);
        }
    }

    throw new Error('Semua server cobalt gagal');
}

// ==============================================================================
// HELPERS
// ==============================================================================
function extractFilename(url, contentDisposition) {
    // Coba dari content-disposition
    if (contentDisposition) {
        const match = contentDisposition.match(/filename\*?=(?:UTF-8''|")?([^";]+)/i);
        if (match) {
            try {
                return decodeURIComponent(match[1].replace(/"/g, ''));
            } catch (e) {
                return match[1].replace(/"/g, '');
            }
        }
    }

    // Fallback dari URL
    try {
        const pathname = new URL(url).pathname;
        const parts = pathname.split('/').filter(Boolean);
        const last = parts[parts.length - 1];
        if (last && last.includes('.')) {
            return decodeURIComponent(last.split('?')[0]);
        }
    } catch (e) {}

    return 'file';
}

function formatBytes(bytes) {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}
